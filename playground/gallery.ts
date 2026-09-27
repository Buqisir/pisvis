import {
  CANDIDATE_ILLUSTRATED, CANDIDATE_LINEWORK, CANDIDATE_INSTRUMENT, CANDIDATE_THEMES,
  add, fitViewport, magnitude, renderSceneSvg, themeToCssText, vec2,
} from '../src/index.js';
import type { SceneItem, ThemeDefinition, Vec2, Viewport } from '../src/index.js';
import { fmt } from './format.js';
import { linkageLoop, prefersReducedMotion, runEntrance } from './motion.js';

function element<T extends HTMLElement>(id: string, kind: { new(): T }): T {
  const found = document.getElementById(id);
  if (!(found instanceof kind)) throw new Error(`Missing element: ${id}`);
  return found;
}
const controls = element('gallery-controls', HTMLFormElement);
const scenesRoot = element('scenes', HTMLDivElement);
const optGray = element('opt-gray', HTMLInputElement);
const optMotion = element('opt-motion', HTMLInputElement);
const optLong = element('opt-long', HTMLInputElement);

// Same margin for every render so theme switching never moves geometry.
const MARGIN = Math.max(...CANDIDATE_THEMES.map((t) => t.space.safeMargin));
const ZERO = vec2(0, 0);

interface Slot {
  readonly key: string;       // unique inside the section; part of instanceId
  readonly caption?: string;  // HTML caption under the cell/panel (not SVG text)
  readonly widthPx: number;
  readonly heightPx: number;
  readonly points: Vec2[];    // world extent for fitViewport
  readonly items: (long: boolean) => SceneItem[];
  /** entrance order: groups of item ids; '*' means "all remaining items" */
  readonly stages?: readonly (readonly string[])[];
}
interface SectionDef {
  readonly key: string;
  readonly title: string;
  readonly layout: 'cells' | 'panels' | 'single';
  readonly slots: Slot[];
  readonly readout: string;
  /** linkage demo (scene 1 only): rebuild items/readout from a moved vector b */
  readonly dynamic?: {
    readonly base: Vec2;
    readonly items: (long: boolean, b: Vec2) => SceneItem[];
    readonly readout: (b: Vec2) => string;
  };
}

const angle = (v: Vec2) => `${((Math.atan2(v.y, v.x) * 180) / Math.PI).toFixed(1)}°`;

const A = vec2(2, 1);
const B = vec2(0.5, 1.8);
const V = vec2(2.4, 1.6);

const sumItems = (long: boolean, b: Vec2): SceneItem[] => {
  const r = add(A, b);
  return [
    { kind: 'axes', id: 'ax', x: [-1, 3.5], y: [-1, 3.5], tick: 1, grid: true },
    { kind: 'arrow', id: 'sum-a', role: 'input', from: ZERO, to: A, handle: true, state: 'selected', label: { text: long ? '分向量 A（输入，可编辑）' : 'A', anchor: 'end' } },
    { kind: 'arrow', id: 'sum-b', role: 'input', from: ZERO, to: b, handle: true, label: { text: 'B', anchor: 'end' } },
    { kind: 'arrow', id: 'sum-bt', role: 'guide', from: A, to: r, dashed: true, label: { text: long ? 'B 的平移（平行四边形法则）' : 'B′', anchor: 'mid' } },
    { kind: 'segment', id: 'sum-para', role: 'guide', from: b, to: r, dashed: true },
    { kind: 'arrow', id: 'sum-r', role: 'derived', from: ZERO, to: r, state: 'readonly', label: long
      ? { text: '合向量 R（由平行四边形法则得到，无量纲）', anchor: 'mid', offsetPx: vec2(0, 30) }
      : { text: 'R', anchor: 'end' } },
    { kind: 'point', id: 'sum-o', role: 'component', at: ZERO, label: { text: 'O', anchor: 'start', offsetPx: vec2(0, 16) } },
  ];
};
const sumReadout = (b: Vec2): string => {
  const r = add(A, b);
  return `A=(${fmt(A.x)}, ${fmt(A.y)})　B=(${fmt(b.x)}, ${fmt(b.y)})　` +
    `R=A+B=(${fmt(r.x)}, ${fmt(r.y)})　|R|=${magnitude(r).toFixed(3)}　方向 ${angle(r)}`;
};

const arrowCell = (
  key: string, caption: string, role: 'input' | 'derived' | 'component' | 'guide',
  extra: Partial<Extract<SceneItem, { kind: 'arrow' }>> = {},
): Slot => ({
  key,
  caption,
  widthPx: 150,
  heightPx: 110,
  points: [vec2(-1.6, -0.4), vec2(1.6, 0.4)],
  items: () => [{
    kind: 'arrow', id: key, role, from: vec2(-1, 0), to: vec2(1, 0), ...extra,
  }],
});

const SCENES: SectionDef[] = [
  {
    key: 'prims',
    title: '图元与状态',
    layout: 'cells',
    slots: [
      arrowCell('role-input', '输入', 'input'),
      arrowCell('role-derived', '派生', 'derived'),
      arrowCell('role-component', '分量（虚线）', 'component', { dashed: true }),
      arrowCell('role-guide', '辅助（虚线）', 'guide', { dashed: true }),
      {
        key: 'role-point', caption: '点', widthPx: 150, heightPx: 110,
        points: [vec2(-1.6, -0.4), vec2(1.6, 0.4)],
        items: () => [{ kind: 'point', id: 'role-point', role: 'component', at: ZERO }],
      },
      {
        key: 'role-segment', caption: '虚线段', widthPx: 150, heightPx: 110,
        points: [vec2(-1.6, -0.4), vec2(1.6, 0.4)],
        items: () => [{ kind: 'segment', id: 'role-segment', role: 'guide', from: vec2(-1, 0), to: vec2(1, 0), dashed: true }],
      },
      arrowCell('st-default', '默认', 'input', { handle: true }),
      arrowCell('st-selected', '选中', 'input', { handle: true, state: 'selected' }),
      arrowCell('st-dragging', '拖动', 'input', { handle: true, state: 'dragging' }),
      arrowCell('st-readonly', '只读', 'derived', { state: 'readonly' }),
      arrowCell('st-error', '错误', 'input', { handle: true, state: 'error' }),
      arrowCell('st-focus', '键盘焦点', 'input', { handle: true, state: 'focus' }),
      {
        key: 'axes', caption: '坐标轴与网格', widthPx: 160, heightPx: 110,
        points: [vec2(-1.5, -1.2), vec2(2.2, 1.6)],
        items: () => [
          { kind: 'axes', id: 'axes', x: [-1.5, 2.2], y: [-1.2, 1.6], tick: 1, grid: true },
          { kind: 'arrow', id: 'axes-v', role: 'input', from: ZERO, to: vec2(1.2, 0.8) },
        ],
        stages: [['axes'], ['axes-v']],
      },
    ],
    readout: '四种角色、六种状态、坐标轴各自独立呈现；同一套几何，三种主题。',
  },
  {
    key: 'sum',
    title: '场景一 · 向量合成',
    layout: 'single',
    slots: [{
      key: 'main', widthPx: 720, heightPx: 420,
      points: [vec2(-1, -1), vec2(3.5, 3.5)],
      items: (long) => sumItems(long, B),
      stages: [['ax'], ['sum-a', 'sum-b'], ['sum-bt', 'sum-para'], ['sum-r']],
    }],
    readout: sumReadout(B),
    dynamic: {
      base: B,
      items: sumItems,
      readout: sumReadout,
    },
  },
  {
    key: 'decomp',
    title: '场景二 · 正交分解',
    layout: 'single',
    slots: [{
      key: 'main', widthPx: 720, heightPx: 380,
      points: [vec2(-1, -1), vec2(3.5, 2.5)],
      items: (long) => [
        { kind: 'axes', id: 'ax', x: [-1, 3.5], y: [-1, 2.5], tick: 1, grid: true },
        { kind: 'arrow', id: 'dec-v', role: 'input', from: ZERO, to: V, handle: true, label: { text: 'V', anchor: 'end' } },
        { kind: 'arrow', id: 'dec-vx', role: 'component', from: ZERO, to: vec2(V.x, 0), dashed: true, label: { text: long ? '水平分量 Vx（只读派生）' : 'Vx', anchor: 'mid', offsetPx: vec2(0, 20) } },
        { kind: 'arrow', id: 'dec-vy', role: 'component', from: ZERO, to: vec2(0, V.y), dashed: true, label: { text: 'Vy', anchor: 'mid', offsetPx: vec2(0, 26) } },
        { kind: 'segment', id: 'dec-gx', role: 'guide', from: V, to: vec2(V.x, 0), dashed: true },
        { kind: 'segment', id: 'dec-gy', role: 'guide', from: V, to: vec2(0, V.y), dashed: true },
        { kind: 'point', id: 'dec-o', role: 'component', at: ZERO, label: { text: 'O', anchor: 'start', offsetPx: vec2(0, 16) } },
      ],
      stages: [['ax'], ['dec-v'], ['dec-gx', 'dec-gy'], ['dec-vx', 'dec-vy']],
    }],
    readout: `V=(${fmt(V.x)}, ${fmt(V.y)})　Vx=(${fmt(V.x)}, 0)　Vy=(0, ${fmt(V.y)})　` +
      `|V|=${magnitude(V).toFixed(3)}　方向 ${angle(V)}`,
  },
  {
    key: 'edge',
    title: '退化与边界',
    layout: 'panels',
    slots: [
      {
        key: 'e-zero', caption: '零向量：方向未定义', widthPx: 300, heightPx: 220,
        points: [vec2(-2, -1.5), vec2(2, 1.5)],
        items: (long) => [
          { kind: 'axes', id: 'ax', x: [-2, 2], y: [-1.5, 1.5], tick: 1, grid: true },
          { kind: 'arrow', id: 'z', role: 'input', from: ZERO, to: ZERO, label: { text: long ? '零向量（无方向）' : '0', anchor: 'mid' } },
        ],
      },
      {
        key: 'e-opposite', caption: '反向合成：A+B=0', widthPx: 300, heightPx: 220,
        points: [vec2(-2.5, -1.5), vec2(2.5, 1.5)],
        items: () => [
          { kind: 'axes', id: 'ax', x: [-2.5, 2.5], y: [-1.5, 1.5], tick: 1, grid: true },
          { kind: 'arrow', id: 'a', role: 'input', from: ZERO, to: vec2(1.5, 0.5), label: { text: 'A', anchor: 'end' } },
          { kind: 'arrow', id: 'b', role: 'input', from: ZERO, to: vec2(-1.5, -0.5), label: { text: 'B', anchor: 'end', offsetPx: vec2(-4, 10) } },
          { kind: 'arrow', id: 'r0', role: 'derived', from: ZERO, to: ZERO, state: 'readonly', label: { text: 'R=0', anchor: 'mid', offsetPx: vec2(-6, -4) } },
        ],
      },
      {
        key: 'e-short', caption: '极短向量 (0.05, 0.02)', widthPx: 300, heightPx: 220,
        points: [vec2(-0.4, -0.3), vec2(0.4, 0.3)],
        items: () => [
          { kind: 'axes', id: 'ax', x: [-0.4, 0.4], y: [-0.3, 0.3], tick: 0.2, grid: true },
          { kind: 'arrow', id: 's', role: 'input', from: ZERO, to: vec2(0.05, 0.02), label: { text: 'v', anchor: 'end' } },
        ],
      },
      {
        key: 'e-bound', caption: '边界：R=(8, 8) 完整显示不裁剪', widthPx: 300, heightPx: 220,
        points: [vec2(-1, -1), vec2(9, 9)],
        items: () => [
          { kind: 'axes', id: 'ax', x: [-1, 9], y: [-1, 9], tick: 2, grid: true },
          { kind: 'arrow', id: 'a8', role: 'input', from: ZERO, to: vec2(4, 4), label: { text: 'A', anchor: 'mid' } },
          { kind: 'arrow', id: 'b8', role: 'guide', from: vec2(4, 4), to: vec2(8, 8), dashed: true, label: { text: 'B', anchor: 'mid' } },
          { kind: 'arrow', id: 'e-r8', role: 'derived', from: ZERO, to: vec2(8, 8), state: 'readonly', label: { text: 'R', anchor: 'mid', offsetPx: vec2(12, 10) } },
        ],
      },
    ],
    readout: '零向量不伪造方向（显示为点）；反向合成 R=0；极短箭头缩小头部不露馅；边界结果由 fitViewport 完整容纳。',
  },
];

// Theme styles are injected once; scopes keep side-by-side instances isolated.
const styleEl = document.createElement('style');
styleEl.textContent = CANDIDATE_THEMES
  .map((t) => themeToCssText(t, `[data-pv-theme="${t.id}"]`))
  .join('\n');
document.head.append(styleEl);

function mountSvg(container: HTMLElement, svgText: string): void {
  const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (parsed.querySelector('parsererror')) throw new Error('SVG serialization failed');
  container.replaceChildren(document.importNode(parsed.documentElement, true));
}

// ----- motion + linkage demo state (per page, rebuilt every render) ---------

interface DemoTarget { stage: HTMLElement; theme: ThemeDefinition; viewport: Viewport }
const demo = {
  intent: false,      // user wants the linkage playing
  userPaused: false,  // an explicit pause suppresses autostart/resume
  t: 0,
  stop: null as null | (() => void),
  targets: [] as DemoTarget[],
};
// test/debug counters: live rAF loops, frames applied, entrance runs
const debug = { loops: 0, frames: 0, entrances: 0 };
(window as unknown as { __pvDemo: typeof debug }).__pvDemo = debug;

let generation = 0;
let observers: IntersectionObserver[] = [];
let liveAnimations: Animation[] = [];
const shownSlots = new Set<string>(); // entrance-once, survives re-renders

const OMEGA = (Math.PI * 2) / 6; // ~6 s period
const bAt = (t: number): Vec2 =>
  vec2(B.x + 0.9 * (Math.cos(OMEGA * t) - 1), B.y + 0.9 * Math.sin(OMEGA * t));

function reducedNow(): boolean {
  return prefersReducedMotion();
}

function paintSum(b: Vec2): void {
  const def = SCENES.find((s) => s.key === 'sum');
  if (!def?.dynamic) return;
  const slot = def.slots[0]!;
  const long = optLong.checked;
  for (const target of demo.targets) {
    mountSvg(target.stage, renderSceneSvg({
      instanceId: `sum-main-${target.theme === CANDIDATE_ILLUSTRATED ? 'a' : target.theme === CANDIDATE_LINEWORK ? 'b' : 'c'}`,
      title: `${def.title} · ${target.theme.name}`,
      widthPx: slot.widthPx,
      heightPx: slot.heightPx,
      viewport: target.viewport,
      theme: target.theme,
      items: def.dynamic.items(long, b),
    }));
  }
  const readout = document.querySelector('.specimen[data-key="sum"] .scene-readout');
  if (readout) readout.textContent = def.dynamic.readout(b);
}

function startDemoLoop(): void {
  if (demo.stop !== null || reducedNow()) return;
  const tOffset = demo.t;
  debug.loops += 1;
  demo.stop = linkageLoop((elapsed) => {
    demo.t = tOffset + elapsed;
    debug.frames += 1;
    paintSum(bAt(demo.t));
  });
}

function stopDemoLoop(): void {
  if (demo.stop !== null) {
    demo.stop();
    demo.stop = null;
    debug.loops -= 1;
  }
}

function updateDemoButtons(): void {
  const btn = document.getElementById('demo-toggle') as HTMLButtonElement | null;
  const note = document.getElementById('demo-note');
  if (!btn) return;
  const reduced = reducedNow();
  btn.disabled = reduced;
  btn.setAttribute('aria-pressed', String(demo.intent));
  btn.textContent = demo.intent ? '暂停联动' : '联动演示';
  if (note) note.textContent = reduced ? '减少动效已开启' : '';
}

function attachDemo(): void {
  // called whenever intent/layout allows playing
  if (demo.intent && !document.hidden && !reducedNow()) startDemoLoop();
  updateDemoButtons();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopDemoLoop();
  } else if (demo.intent && !demo.userPaused) {
    attachDemo();
  }
});

function cancelMotion(): void {
  generation += 1;
  for (const a of liveAnimations) a.cancel();
  liveAnimations = [];
  for (const o of observers) o.disconnect();
  observers = [];
  stopDemoLoop();
  demo.targets = [];
}

// ----- rendering -----------------------------------------------------------

function themeMode(): 'a' | 'b' | 'c' | 'both' {
  const picked = controls.querySelector<HTMLInputElement>('input[name="theme"]:checked');
  const v = picked?.value;
  return v === 'b' || v === 'c' || v === 'both' ? v : 'a';
}

function variantOf(theme: ThemeDefinition): string {
  return theme === CANDIDATE_ILLUSTRATED ? 'a' : theme === CANDIDATE_LINEWORK ? 'b' : 'c';
}

const entrances = new WeakMap<HTMLElement, { slot: Slot; section: SectionDef }>();

function render(): void {
  cancelMotion();
  const gen = generation;
  const mode = themeMode();
  const long = optLong.checked;
  const variants: ThemeDefinition[] =
    mode === 'a' ? [CANDIDATE_ILLUSTRATED]
    : mode === 'b' ? [CANDIDATE_LINEWORK]
    : mode === 'c' ? [CANDIDATE_INSTRUMENT]
    : [...CANDIDATE_THEMES];
  if (mode === 'c') document.body.setAttribute('data-pv-page', 'dark');
  else document.body.removeAttribute('data-pv-page');

  scenesRoot.replaceChildren();
  scenesRoot.classList.toggle('pv-grayscale', optGray.checked);
  scenesRoot.classList.toggle('pv-reduced-motion', optMotion.checked);
  const ioTargets: HTMLElement[] = [];

  for (const def of SCENES) {
    const section = document.createElement('section');
    section.className = `specimen layout-${def.layout}`;
    section.dataset.key = def.key;
    const heading = document.createElement('h3');
    heading.textContent = def.title;

    const bar = document.createElement('div');
    bar.className = 'scene-toolbar';
    const replay = document.createElement('button');
    replay.type = 'button';
    replay.className = 'replay';
    replay.textContent = '重播';
    bar.append(replay);
    if (def.key === 'sum') {
      const demoBtn = document.createElement('button');
      demoBtn.type = 'button';
      demoBtn.id = 'demo-toggle';
      demoBtn.setAttribute('aria-pressed', 'false');
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.id = 'demo-reset';
      reset.textContent = '复位';
      const note = document.createElement('span');
      note.id = 'demo-note';
      note.className = 'demo-note';
      bar.append(demoBtn, reset, note);
      demoBtn.addEventListener('click', () => {
        if (demo.intent) {
          demo.intent = false;
          demo.userPaused = true;
          stopDemoLoop();
        } else {
          demo.intent = true;
          demo.userPaused = false;
          startDemoLoop();
        }
        updateDemoButtons();
      });
      reset.addEventListener('click', () => {
        demo.intent = false;
        demo.userPaused = true;
        demo.t = 0;
        stopDemoLoop();
        paintSum(B);
        updateDemoButtons();
      });
    }
    replay.addEventListener('click', () => {
      if (def.dynamic) {
        // replaying resets the demo vector to its default
        stopDemoLoop();
        demo.t = 0;
        paintSum(def.dynamic.base);
        if (demo.intent) startDemoLoop();
      }
      for (const cell of section.querySelectorAll<HTMLElement>('.cell, .stage-outer')) {
        runCellEntrance(cell, gen);
      }
    });

    const wrap = document.createElement('div');
    wrap.className = def.layout === 'cells' ? 'cell-grid'
      : def.layout === 'panels' ? 'panel-grid' : 'stage-single';
    for (const slot of def.slots) {
      const viewport = fitViewport(slot.points, slot.widthPx, slot.heightPx, MARGIN);
      const pair = document.createElement('div');
      pair.className = 'stage-pair';
      for (const theme of variants) {
        const figure = document.createElement('figure');
        const stage = document.createElement('div');
        stage.className = 'stage';
        stage.setAttribute('data-pv-theme', theme.id);
        const b = def.dynamic ? bAt(demo.t) : undefined;
        const items = def.dynamic ? def.dynamic.items(long, b!) : slot.items(long);
        mountSvg(stage, renderSceneSvg({
          instanceId: `${def.key}-${slot.key}-${variantOf(theme)}`,
          title: `${def.title} · ${theme.name}`,
          widthPx: slot.widthPx,
          heightPx: slot.heightPx,
          viewport,
          theme,
          items,
        }));
        if (def.dynamic) demo.targets.push({ stage, theme, viewport });
        figure.append(stage);
        if (mode === 'both') {
          const caption = document.createElement('figcaption');
          caption.textContent = `${theme.name} · 候选`;
          figure.append(caption);
        }
        pair.append(figure);
      }
      const cell = document.createElement('div');
      cell.className = def.layout === 'single' ? 'stage-outer' : 'cell';
      cell.append(pair);
      if (slot.caption !== undefined) {
        const caption = document.createElement('p');
        caption.className = 'cell-caption';
        caption.textContent = slot.caption;
        cell.append(caption);
      }
      entrances.set(cell, { slot, section: def });
      if (!shownSlots.has(`${def.key}.${slot.key}`)) ioTargets.push(cell);
      wrap.append(cell);
    }
    const readout = document.createElement('p');
    readout.className = 'scene-readout';
    readout.textContent = def.dynamic ? def.dynamic.readout(bAt(demo.t)) : def.readout;
    section.append(heading, bar, wrap, readout);
    scenesRoot.append(section);
  }

  // Entrance-on-first-scroll-into-view per cell/panel/stage.
  const io = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      if (reducedNow()) continue;
      const wasSum = runCellEntrance(entry.target as HTMLElement, gen);
      if (wasSum && !demo.userPaused) {
        // after scene 1's entrance completes, autostart the linkage demo
        const pending = liveAnimations.filter((a) => a.playState !== 'finished');
        Promise.allSettled(pending.map((a) => a.finished)).then(() => {
          if (generation === gen && demo.intent === false && !demo.userPaused && !reducedNow()) {
            demo.intent = true;
            attachDemo();
          }
        });
      }
    }
  });
  for (const t of ioTargets) io.observe(t);
  observers.push(io);
  updateDemoButtons();
  attachDemo(); // keep playing across re-renders (theme/long-label switches)
}

/** Runs the staged entrance on every svg inside the cell. Returns true for sum. */
function runCellEntrance(cell: HTMLElement, gen: number): boolean {
  if (generation !== gen || reducedNow()) return false;
  const meta = entrances.get(cell);
  if (!meta) return false;
  shownSlots.add(`${meta.section.key}.${meta.slot.key}`);
  // cancel any in-flight entrance on this cell first — replay must not stack
  liveAnimations = liveAnimations.filter((a) => {
    const target = (a.effect as KeyframeEffect | null)?.target;
    if (target !== null && target !== undefined && cell.contains(target)) {
      a.cancel();
      return false;
    }
    return a.playState !== 'finished' && a.playState !== 'idle';
  });
  for (const svg of cell.querySelectorAll('svg.pv-scene')) {
    liveAnimations.push(
      ...runEntrance(svg as SVGSVGElement, meta.slot.stages ?? [['*']]),
    );
  }
  debug.entrances += 1;
  return meta.section.key === 'sum';
}

controls.addEventListener('input', render);
render();
