import { DEFAULT_THEME } from '../src/index.js';
import { flightTime } from '../src/models/projectile.js';
import { authoring } from '../src/agent.js';
import type { SceneDocument } from '../src/agent.js';
import { fmt } from './format.js';

function element<T extends HTMLElement>(id: string, kind: { new(): T }): T {
  const found = document.getElementById(id);
  if (!(found instanceof kind)) throw new Error(`Missing element: ${id}`);
  return found;
}
const canvas = element('canvas', HTMLDivElement);
const status = element('status', HTMLParagraphElement);
const readout = element('readout', HTMLParagraphElement);
const btnPlay = element('btn-play', HTMLButtonElement);
const btnReset = element('btn-reset', HTMLButtonElement);
const inputs = {
  h: element('in-h', HTMLInputElement),
  u: element('in-u', HTMLInputElement),
  g: element('in-g', HTMLInputElement),
  t: element('in-t', HTMLInputElement),
  theme: element('in-theme', HTMLSelectElement),
  rate: element('in-rate', HTMLSelectElement),
};

// Single source of truth is the authoring document — every control (slider,
// play clock, param fields, theme) goes through the same updateScene
// boundary an Agent would use. Nothing recomputes physics in the page.
const page = { document: null as unknown as SceneDocument, derived: {} as Record<string, unknown> };
let playing = false;
let rafId = 0;
let wallBase = 0;
let tBase = 0;
let resumeOnVisible = false;

const t = (): number => page.document.params['t'] as number;
const T = (): number => page.derived['T'] as number;
const rate = (): number => Number(inputs.rate.value) || 1;

function applyOps(operations: readonly { op: string; value?: unknown }[]): boolean {
  const r = authoring.updateScene({ document: page.document, operations });
  if (!r.ok) {
    const e = r.errors[0];
    status.textContent = e !== undefined ? `${e.message}${e.hint ? ` ${e.hint}` : ''}` : '修改被拒绝';
    return false;
  }
  status.textContent = '';
  page.document = r.document;
  page.derived = r.derived;
  return true;
}

function fmtVec(v: { x: number; y: number }): string {
  return `(${fmt(v.x)}, ${fmt(v.y)})`;
}

function draw(): void {
  const rendered = authoring.renderScene({ document: page.document });
  if (!rendered.ok) {
    status.textContent = rendered.errors[0]?.message ?? '绘制失败';
    return;
  }
  // Parse only OUR serializer output; never use this route for arbitrary user SVG.
  const parsed = new DOMParser().parseFromString(rendered.svg, 'image/svg+xml');
  if (parsed.querySelector('parsererror')) throw new Error('SVG serialization failed');
  const svg = document.importNode(parsed.documentElement, true);
  canvas.replaceChildren(svg);
  const p = page.derived['position'] as { x: number; y: number };
  const v = page.derived['velocity'] as { x: number; y: number };
  const speed = page.derived['speed'] as number;
  readout.textContent =
    `t = ${fmt(t())} s / T = ${fmt(T())} s · ` +
    `P ${fmtVec(p)} m · v ${fmtVec(v)} m/s · |v| ${speed.toFixed(2)} m/s · ` +
    `R = ${fmt(page.derived['R'] as number)} m` +
    (page.derived['landed'] === true ? ' · 已落地' : '');
}

function commitT(value: number): void {
  const clamped = Math.min(Math.max(value, 0), T());
  inputs.t.value = String(clamped);
  if (applyOps([{ op: 'set-t', value: clamped }])) draw();
}

// Wall-clock analytic advance: t = tBase + elapsed·rate, never per-frame
// accumulation. Landing clamps exactly at T.
function tick(now: number): void {
  const next = tBase + ((now - wallBase) / 1000) * rate();
  if (next >= T()) {
    commitT(T());
    stopClock();
    return;
  }
  commitT(next);
  rafId = requestAnimationFrame(tick);
}

function startClock(): void {
  if (t() >= T()) return;
  stopClock();
  tBase = t();
  wallBase = performance.now();
  rafId = requestAnimationFrame(tick);
  playing = true;
  btnPlay.textContent = '暂停';
}

function stopClock(): void {
  cancelAnimationFrame(rafId);
  playing = false;
  btnPlay.textContent = '播放';
}

btnPlay.addEventListener('click', () => {
  if (playing) stopClock(); else startClock();
});
btnReset.addEventListener('click', () => {
  stopClock();
  commitT(0);
});

inputs.t.addEventListener('input', () => {
  commitT(Number(inputs.t.value));
  if (playing) { tBase = t(); wallBase = performance.now(); }
});

// Changing h/g changes T — clamp t into the new domain before committing so
// the update never fails on a stale t.
function commitParams(): void {
  const h = Number(inputs.h.value);
  const u = Number(inputs.u.value);
  const g = Number(inputs.g.value);
  if (![h, u, g].every(Number.isFinite)) {
    status.textContent = '请填写范围内的有限数值。';
    return;
  }
  const newT = flightTime(h, g);
  const clampedT = Math.min(t(), newT);
  if (!applyOps([
    { op: 'set-h', value: h }, { op: 'set-u', value: u }, { op: 'set-g', value: g },
    { op: 'set-t', value: clampedT },
  ])) return;
  inputs.t.max = String(newT);
  inputs.t.value = String(clampedT);
  if (playing) { tBase = clampedT; wallBase = performance.now(); }
  draw();
}
for (const key of ['h', 'u', 'g'] as const) inputs[key].addEventListener('change', commitParams);

inputs.theme.addEventListener('change', () => {
  const [id, version] = inputs.theme.value.split('@');
  if (applyOps([{ op: 'set-theme', value: { id, version: Number(version) } }])) draw();
});

// Hidden tab: freeze the wall clock at the current t; on return resume from
// that t with a fresh base — a long absence can never skip ahead.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && playing) {
    resumeOnVisible = true;
    stopClock();
  } else if (!document.hidden && resumeOnVisible) {
    resumeOnVisible = false;
    startClock();
  }
});
window.addEventListener('beforeunload', () => cancelAnimationFrame(rafId));

// Read-only document access for tests: proves the page runs on the same
// document/command boundary the authoring API exposes to agents.
(window as unknown as { __pvDocument: () => SceneDocument }).__pvDocument =
  () => JSON.parse(JSON.stringify(page.document)) as SceneDocument;

const created = authoring.createScene({
  templateId: 'horizontal-projectile',
  templateVersion: 1,
  params: { h: 20, u: 10, g: 10, t: 0 },
  presentation: {
    theme: { id: DEFAULT_THEME.id, version: DEFAULT_THEME.version },
    canvas: { width: 640, height: 360 },
    viewport: { mode: 'fit' },
  },
});
if (!created.ok) {
  status.textContent = created.errors[0]?.message ?? '初始化失败';
  throw new Error('createScene failed');
}
page.document = created.document;
page.derived = created.derived;
inputs.t.max = String(T());
draw();
