import { authoring } from '../src/agent.js';
import { flightTime } from '../src/models/projectile.js';
import { PROJECTILE_QUESTIONS } from '../src/questions/projectile.js';
import {
  createSession,
  sessionApply,
  sessionDestroy,
  sessionRestoreOriginal,
  sessionSetTime,
  sessionUpdateParams,
} from '../src/questions/session.js';
import type { SceneDocument, SceneOperation } from '../src/agent.js';
import type { QuestionSession } from '../src/questions/session.js';
import { fmt } from './format.js';

// 一页可同时开多个相互隔离的题板：每个题板 = 一个 QuestionSession（情境图文档）
// + 一个同参数 v–t 图文档（projectile-speed-graph@1）。两个文档共享同一套
// params：会话侧的任何变更成功后，同一组 ops 镜像到图文档——两边校验规则
// 完全相同，镜像不可能出现单边拒绝，一旦出现只说明实现漂移，故显式报错。

const PARAM_KEYS = ['h', 'u', 'g', 't'] as const;

const PANEL_HTML = `
  <div class="qp-head">
    <select class="q-select" aria-label="题目"></select>
    <span class="mode-badge" aria-live="polite"></span>
    <button type="button" class="q-unlock">修改条件</button>
    <button type="button" class="q-restore" hidden>恢复原题</button>
  </div>
  <p class="q-goal"></p>
  <div class="qp-view stage" data-view="scene"></div>
  <div class="qp-view stage" data-view="graph">
    <p class="qp-caption">v–t 图（同一快照的第二视图，游标与上方情境图同一 t）</p>
  </div>
  <form class="qp-controls">
    <div class="qp-fields">
      <label>h（m）<input class="in-h" type="number" min="0" max="100" step="any" /></label>
      <label>u（m/s）<input class="in-u" type="number" min="0" max="40" step="any" /></label>
      <label>g（m/s²）<input class="in-g" type="number" min="1" max="20" step="any" /></label>
      <label>主题
        <select class="in-theme">
          <option value="illustrated@2">A · 轻质感插画</option>
          <option value="linework@1">B · 精确线描</option>
        </select>
      </label>
    </div>
    <div class="qp-time">
      <label class="block">t（s）<input class="in-t" type="range" min="0" step="0.001" /></label>
      <div class="row">
        <button type="button" class="btn-play">播放</button>
        <button type="button" class="btn-reset">重置</button>
        <select class="in-rate" aria-label="播放速率">
          <option value="0.5">0.5×</option>
          <option value="1" selected>1×</option>
          <option value="2">2×</option>
        </select>
      </div>
    </div>
  </form>
  <p class="p-status" role="status" aria-live="polite"></p>
  <p class="p-readout"></p>
  <ol class="q-steps"></ol>
`;

function pick<T extends HTMLElement>(root: HTMLElement, sel: string, kind: { new(): T }): T {
  const found = root.querySelector(sel);
  if (!(found instanceof kind)) throw new Error(`panel missing ${sel}`);
  return found;
}

function fmtVec(v: { x: number; y: number }): string {
  return `(${fmt(v.x)}, ${fmt(v.y)})`;
}

function renderInto(container: HTMLElement, document_: SceneDocument, status: HTMLElement): void {
  const rendered = authoring.renderScene({ document: document_ });
  if (!rendered.ok) {
    status.textContent = rendered.errors[0]?.message ?? '绘制失败';
    return;
  }
  // Parse only OUR serializer output; never use this route for arbitrary user SVG.
  const parsed = new DOMParser().parseFromString(rendered.svg, 'image/svg+xml');
  if (parsed.querySelector('parsererror')) throw new Error('SVG serialization failed');
  const svg = document.importNode(parsed.documentElement, true);
  const caption = container.querySelector('.qp-caption');
  container.replaceChildren(...(caption !== null ? [svg, caption] : [svg]));
}

class ProjectilePanel {
  private session!: QuestionSession;
  private graphDoc!: SceneDocument;
  private graphDerived!: Record<string, unknown>;
  private playing = false;
  private rafId = 0;
  private wallBase = 0;
  private tBase = 0;
  private resumeOnVisible = false;

  private readonly els: {
    select: HTMLSelectElement;
    badge: HTMLSpanElement;
    unlock: HTMLButtonElement;
    restore: HTMLButtonElement;
    goal: HTMLParagraphElement;
    sceneView: HTMLElement;
    graphView: HTMLElement;
    h: HTMLInputElement;
    u: HTMLInputElement;
    g: HTMLInputElement;
    t: HTMLInputElement;
    theme: HTMLSelectElement;
    rate: HTMLSelectElement;
    play: HTMLButtonElement;
    reset: HTMLButtonElement;
    status: HTMLParagraphElement;
    readout: HTMLParagraphElement;
    steps: HTMLOListElement;
  };

  constructor(
    root: HTMLElement,
    private readonly slot: string,
    initialQuestionId: string,
  ) {
    root.innerHTML = PANEL_HTML;
    this.els = {
      select: pick(root, '.q-select', HTMLSelectElement),
      badge: pick(root, '.mode-badge', HTMLSpanElement),
      unlock: pick(root, '.q-unlock', HTMLButtonElement),
      restore: pick(root, '.q-restore', HTMLButtonElement),
      goal: pick(root, '.q-goal', HTMLParagraphElement),
      sceneView: pick(root, '[data-view="scene"]', HTMLDivElement),
      graphView: pick(root, '[data-view="graph"]', HTMLDivElement),
      h: pick(root, '.in-h', HTMLInputElement),
      u: pick(root, '.in-u', HTMLInputElement),
      g: pick(root, '.in-g', HTMLInputElement),
      t: pick(root, '.in-t', HTMLInputElement),
      theme: pick(root, '.in-theme', HTMLSelectElement),
      rate: pick(root, '.in-rate', HTMLSelectElement),
      play: pick(root, '.btn-play', HTMLButtonElement),
      reset: pick(root, '.btn-reset', HTMLButtonElement),
      status: pick(root, '.p-status', HTMLParagraphElement),
      readout: pick(root, '.p-readout', HTMLParagraphElement),
      steps: pick(root, '.q-steps', HTMLOListElement),
    };
    for (const q of PROJECTILE_QUESTIONS) {
      const opt = document.createElement('option');
      opt.value = q.id;
      opt.textContent = q.title;
      this.els.select.append(opt);
    }
    this.els.select.value = initialQuestionId;
    this.bind();
    this.selectQuestion(initialQuestionId);
  }

  private bind(): void {
    this.els.select.addEventListener('change', () => this.selectQuestion(this.els.select.value));
    this.els.play.addEventListener('click', () => {
      if (this.playing) this.stopClock(); else this.startClock();
    });
    this.els.reset.addEventListener('click', () => {
      this.stopClock();
      this.commitT(0);
    });
    this.els.t.addEventListener('input', () => {
      this.commitT(Number(this.els.t.value));
      if (this.playing) { this.tBase = this.t(); this.wallBase = performance.now(); }
    });
    for (const input of [this.els.h, this.els.u, this.els.g]) {
      input.addEventListener('change', () => this.commitParams());
    }
    this.els.theme.addEventListener('change', () => {
      const [id, version] = this.els.theme.value.split('@');
      const ops: SceneOperation[] = [{ op: 'set-theme', value: { id, version: Number(version) } }];
      const r = sessionApply(this.session, ops);
      if (!r.ok) return this.showErrors(r);
      this.mirrorToGraph(ops);
      this.draw();
    });
    this.els.unlock.addEventListener('click', () => {
      // 原题模式下题设输入锁定；解锁即进入探索模式。走一个等值 set-h
      // 操作而非私改状态——模式切换同样经过 updateScene 校验边界。
      const ops: SceneOperation[] = [{ op: 'set-h', value: Number(this.els.h.value) }];
      const r = sessionApply(this.session, ops);
      if (!r.ok) return this.showErrors(r);
      this.mirrorToGraph(ops);
      this.draw();
    });
    this.els.restore.addEventListener('click', () => {
      this.stopClock();
      const r = sessionRestoreOriginal(this.session);
      if (!r.ok) return this.showErrors(r);
      const ops: SceneOperation[] = Object.keys(this.session.instance.params).map((k) => ({
        op: `set-${k}`,
        value: this.session.instance.params[k],
      }));
      this.mirrorToGraph(ops);
      this.syncControls();
      this.draw();
    });
  }

  private selectQuestion(id: string): void {
    const q = PROJECTILE_QUESTIONS.find((item) => item.id === id);
    if (q === undefined) return;
    this.stopClock();
    if (this.session !== undefined) sessionDestroy(this.session);
    const created = createSession(q, authoring, { instanceId: `${this.slot}-${q.id}` });
    if (!created.ok) {
      this.els.status.textContent = created.errors[0]?.message ?? '创建会话失败';
      return;
    }
    this.session = created.session;
    const graph = authoring.createScene({
      templateId: 'projectile-speed-graph',
      templateVersion: 1,
      params: { ...q.params },
      instanceId: `${this.slot}-${q.id}-graph`,
      presentation: { ...this.session.document.presentation, viewport: { mode: 'stretch' } },
    });
    if (!graph.ok) {
      this.els.status.textContent = graph.errors[0]?.message ?? '创建 v–t 图失败';
      return;
    }
    this.graphDoc = graph.document;
    this.graphDerived = graph.derived;
    this.els.goal.textContent = `${q.title} — ${q.goal}`;
    this.els.steps.replaceChildren(...q.steps.map((s) => {
      const li = document.createElement('li');
      li.textContent = s;
      return li;
    }));
    this.syncControls();
    this.draw();
  }

  /** 会话/图文档成功后，把控件显示对齐到文档实际值（恢复原题、换题都会用）。 */
  private syncControls(): void {
    const p = this.session.document.params;
    this.els.h.value = String(p['h']);
    this.els.u.value = String(p['u']);
    this.els.g.value = String(p['g']);
    this.els.t.max = String(this.session.derived['T']);
    this.els.t.value = String(p['t']);
    const th = this.session.document.presentation.theme;
    this.els.theme.value = `${th.id}@${th.version}`;
  }

  private mirrorToGraph(ops: readonly SceneOperation[]): void {
    const r = authoring.updateScene({ document: this.graphDoc, operations: ops });
    if (!r.ok) {
      const e = r.errors[0];
      this.els.status.textContent = `v–t 图同步失败（实现漂移）：${e?.message ?? '未知错误'}`;
      return;
    }
    this.graphDoc = r.document;
    this.graphDerived = r.derived;
  }

  private showErrors(r: { errors: readonly { message: string; hint?: string }[] }): void {
    const e = r.errors[0];
    this.els.status.textContent = e !== undefined ? `${e.message}${e.hint ? ` ${e.hint}` : ''}` : '修改被拒绝';
  }

  private draw(): void {
    this.els.status.textContent = '';
    renderInto(this.els.sceneView, this.session.document, this.els.status);
    renderInto(this.els.graphView, this.graphDoc, this.els.status);

    const mode = this.session.mode;
    const modified = this.session.modifiedParams;
    if (mode === 'original') {
      this.els.badge.textContent = '原题 · 条件已锁定';
      this.els.badge.dataset.mode = 'original';
    } else {
      this.els.badge.textContent = modified.length > 0
        ? `探索 · 已修改条件：${modified.join('、')}`
        : '探索 · 条件未改动';
      this.els.badge.dataset.mode = 'explore';
    }
    const locked = mode === 'original';
    for (const input of [this.els.h, this.els.u, this.els.g]) input.disabled = locked;
    this.els.unlock.hidden = !locked;
    this.els.restore.hidden = locked;

    const d = this.session.derived;
    const pos = d['position'] as { x: number; y: number };
    const vel = d['velocity'] as { x: number; y: number };
    this.els.readout.textContent =
      `t = ${fmt(this.t())} s / T = ${fmt(d['T'] as number)} s · ` +
      `P ${fmtVec(pos)} m · v ${fmtVec(vel)} m/s · |v| ${(d['speed'] as number).toFixed(2)} m/s · ` +
      `R = ${fmt(d['R'] as number)} m` +
      (d['landed'] === true ? ' · 已落地' : '');
  }

  // ---- time + playback ------------------------------------------------------

  private t(): number {
    return this.session.document.params['t'] as number;
  }

  private T(): number {
    return this.session.derived['T'] as number;
  }

  private rate(): number {
    return Number(this.els.rate.value) || 1;
  }

  private commitT(value: number): void {
    const clamped = Math.min(Math.max(value, 0), this.T());
    this.els.t.value = String(clamped);
    const r = sessionSetTime(this.session, clamped);
    if (!r.ok) return this.showErrors(r);
    this.mirrorToGraph([{ op: 'set-t', value: clamped }]);
    this.draw();
  }

  private commitParams(): void {
    const h = Number(this.els.h.value);
    const u = Number(this.els.u.value);
    const g = Number(this.els.g.value);
    if (![h, u, g].every(Number.isFinite)) {
      this.els.status.textContent = '请填写范围内的有限数值。';
      return;
    }
    // h/g 改变 T：把 t 一起钳进新时间域，保证整组候选一次校验通过。
    const newT = flightTime(h, g);
    const clampedT = Math.min(this.t(), newT);
    const patch = { h, u, g, t: clampedT };
    const r = sessionUpdateParams(this.session, patch);
    if (!r.ok) return this.showErrors(r);
    this.mirrorToGraph(PARAM_KEYS.map((k) => ({ op: `set-${k}`, value: patch[k] })));
    this.els.t.max = String(newT);
    this.els.t.value = String(clampedT);
    if (this.playing) { this.tBase = clampedT; this.wallBase = performance.now(); }
    this.draw();
  }

  // 挂钟解析推进：t = tBase + elapsed·rate，不按帧累加；落地精确停在 T。
  private tick = (now: number): void => {
    const next = this.tBase + ((now - this.wallBase) / 1000) * this.rate();
    if (next >= this.T()) {
      this.commitT(this.T());
      this.stopClock();
      return;
    }
    this.commitT(next);
    this.rafId = requestAnimationFrame(this.tick);
  };

  private startClock(): void {
    if (this.t() >= this.T() || this.session.destroyed) return;
    this.stopClock();
    this.tBase = this.t();
    this.wallBase = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
    this.playing = true;
    this.els.play.textContent = '暂停';
  }

  private stopClock(): void {
    cancelAnimationFrame(this.rafId);
    this.playing = false;
    this.els.play.textContent = '播放';
  }

  /** 页面层生命周期：切后台冻结挂钟，回来自当前 t 重新起算；销毁停表断会话。 */
  onVisibility(hidden: boolean): void {
    if (hidden && this.playing) {
      this.resumeOnVisible = true;
      this.stopClock();
    } else if (!hidden && this.resumeOnVisible) {
      this.resumeOnVisible = false;
      this.startClock();
    }
  }

  destroy(): void {
    this.stopClock();
    if (this.session !== undefined && !this.session.destroyed) sessionDestroy(this.session);
  }

  /** 测试与调试用只读快照。 */
  snapshot(): {
    questionId: string;
    mode: string;
    modifiedParams: readonly string[];
    params: Record<string, unknown>;
    derived: Record<string, unknown>;
    graphParams: Record<string, unknown>;
    graphDerived: Record<string, unknown>;
  } {
    return {
      questionId: this.session.instance.id,
      mode: this.session.mode,
      modifiedParams: this.session.modifiedParams,
      params: JSON.parse(JSON.stringify(this.session.document.params)) as Record<string, unknown>,
      derived: JSON.parse(JSON.stringify(this.session.derived)) as Record<string, unknown>,
      graphParams: JSON.parse(JSON.stringify(this.graphDoc.params)) as Record<string, unknown>,
      graphDerived: JSON.parse(JSON.stringify(this.graphDerived)) as Record<string, unknown>,
    };
  }
}

const panelsRoot = document.getElementById('panels');
if (panelsRoot === null) throw new Error('Missing #panels');
const panels: ProjectilePanel[] = [];
for (const [slot, qid] of [['p-a', 'q-landing-time'], ['p-b', 'q-range']] as const) {
  const el = document.createElement('section');
  el.className = 'qpanel';
  el.dataset.panel = slot;
  panelsRoot.append(el);
  panels.push(new ProjectilePanel(el, slot, qid));
}

document.addEventListener('visibilitychange', () => {
  for (const p of panels) p.onVisibility(document.hidden);
});
window.addEventListener('beforeunload', () => {
  for (const p of panels) p.destroy();
});

// 测试钩子：每个题板一份只读快照，证明页面跑在 session/authoring 同一文档边界。
(window as unknown as { __pvPanels: () => unknown }).__pvPanels =
  () => panels.map((p) => p.snapshot());
