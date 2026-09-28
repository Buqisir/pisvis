import {
  add, applyAffine, invertAffine, screenToWorld, sub, vec2, worldToScreen,
  DEFAULT_THEME,
} from '../src/index.js';
import type { Vec2, Viewport } from '../src/index.js';
import { authoring } from '../src/agent.js';
import type { SceneDocument } from '../src/agent.js';
import { fmt } from './format.js';

function element<T extends HTMLElement>(id: string, kind: { new(): T }): T {
  const found = document.getElementById(id);
  if (!(found instanceof kind)) throw new Error(`Missing element: ${id}`);
  return found;
}
const form = element('controls', HTMLFormElement);
const canvas = element('canvas', HTMLDivElement);
const status = element('status', HTMLParagraphElement);
const readout = element('readout', HTMLParagraphElement);
const radioStart = element('sel-start', HTMLInputElement);
const radioEnd = element('sel-end', HTMLInputElement);
const inputs = {
  ax: element('ax', HTMLInputElement),
  ay: element('ay', HTMLInputElement),
  bx: element('bx', HTMLInputElement),
  by: element('by', HTMLInputElement),
  zoom: element('zoom', HTMLInputElement),
};

type Endpoint = 'start' | 'end';
type FieldId = 'ax' | 'ay' | 'bx' | 'by';

// The page's single source of truth is a scene document — the same boundary
// Agent callers use. Derived values come back from the API, never recomputed.
interface PlaygroundPage {
  document: SceneDocument;
  derived: Record<string, unknown>;
  documentHash: string;
}
const page: PlaygroundPage = { document: null as never, derived: {}, documentHash: '' };
let selected: Endpoint = 'end';
let apiError: string | null = null;

const WIDTH_PX = 640;
const HEIGHT_PX = 360;
const ORIGIN = vec2(320, 180);
const DEFAULT_START = vec2(-2, -1);
const DEFAULT_END = vec2(2, 1);
const DEFAULT_ZOOM = 50;
// Demo-layer drag bounds only — the capability itself allows |coords| <= 1e6.
const BOUNDS = { xMin: -4, xMax: 4, yMin: -2, yMax: 2 };
const ERROR_TEXT = '请填写范围内的有限数值。';
const SVG_NS = 'http://www.w3.org/2000/svg';

const invalid = new Set<FieldId>();
const ENDPOINT_FIELDS: Record<Endpoint, [FieldId, FieldId]> = {
  start: ['ax', 'ay'],
  end: ['bx', 'by'],
};

const point = (which: Endpoint): Vec2 => page.document.params[which] as Vec2;
const viewport = (): Viewport => {
  const v = page.document.presentation.viewport;
  return v.mode === 'explicit' ? { originPx: v.originPx, pixelsPerUnit: v.pixelsPerUnit }
    : { originPx: ORIGIN, pixelsPerUnit: DEFAULT_ZOOM };
};

function createDefault(): boolean {
  const r = authoring.createScene({
    templateId: 'arrow',
    templateVersion: 1,
    params: { start: DEFAULT_START, end: DEFAULT_END, label: '向量' },
    presentation: {
      theme: { id: DEFAULT_THEME.id, version: DEFAULT_THEME.version },
      canvas: { width: WIDTH_PX, height: HEIGHT_PX },
      viewport: { mode: 'explicit', originPx: ORIGIN, pixelsPerUnit: DEFAULT_ZOOM },
    },
  });
  if (!r.ok) {
    status.textContent = r.errors[0]?.message ?? '初始化失败';
    return false;
  }
  page.document = r.document;
  page.derived = r.derived;
  page.documentHash = r.documentHash;
  apiError = null;
  return true;
}

// All edits go through the same updateScene boundary; failures keep the last
// valid document and surface the API error (message + hint) in #status.
function applyOps(operations: readonly { op: string; value?: unknown }[], errField?: FieldId): boolean {
  const r = authoring.updateScene({ document: page.document, operations });
  if (!r.ok) {
    const e = r.errors[0];
    apiError = e !== undefined ? `${e.message}${e.hint ? ` ${e.hint}` : ''}` : '修改被拒绝';
    if (errField !== undefined) {
      invalid.add(errField);
      inputs[errField].setAttribute('aria-invalid', 'true');
    }
    refreshValidityStatus();
    return false;
  }
  apiError = null;
  page.document = r.document;
  page.derived = r.derived;
  page.documentHash = r.documentHash;
  return true;
}

function directionText(): string {
  const d = page.derived['direction'] as { degrees: number } | null;
  return d === null || d === undefined ? '—' : `${d.degrees.toFixed(1)}°`;
}

function circle(attrs: Record<string, string | number>): SVGCircleElement {
  const node = document.createElementNS(SVG_NS, 'circle');
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}

// The selected handle renders last so it stays on top when endpoints coincide.
function addHandles(svg: SVGSVGElement): void {
  const order: Endpoint[] = selected === 'end' ? ['start', 'end'] : ['end', 'start'];
  for (const which of order) {
    const p = worldToScreen(point(which), viewport());
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('data-handle', which);
    g.setAttribute('class', `handle handle-${which}`);
    g.append(
      circle({ class: 'hit', cx: p.x, cy: p.y, r: 16, fill: 'transparent', 'pointer-events': 'all' }),
      circle({ class: 'dot', cx: p.x, cy: p.y, r: 7 }),
    );
    if (which === selected) {
      g.classList.add('selected');
      g.append(circle({ class: 'ring', cx: p.x, cy: p.y, r: 11 }));
    }
    svg.append(g);
  }
}

function draw(): void {
  try {
    const rendered = authoring.renderScene({ document: page.document });
    if (!rendered.ok) {
      status.textContent = rendered.errors[0]?.message ?? '绘制失败';
      return;
    }
    // Parse only OUR serializer output; never use this route for arbitrary user SVG.
    const parsed = new DOMParser().parseFromString(rendered.svg, 'image/svg+xml');
    if (parsed.querySelector('parsererror')) throw new Error('SVG serialization failed');
    const svg = document.importNode(parsed.documentElement, true);
    if (!(svg instanceof SVGSVGElement)) throw new Error('SVG import failed');
    addHandles(svg);
    canvas.replaceChildren(svg);
    const s = point('start');
    const e = point('end');
    const length = page.derived['length'] as number;
    readout.textContent =
      `起点 (${fmt(s.x)}, ${fmt(s.y)}) · ` +
      `终点 (${fmt(e.x)}, ${fmt(e.y)}) · ` +
      `长度 ${length.toFixed(3)}（无量纲）· 方向 ${directionText()}`;
  } catch (error: unknown) {
    status.textContent = error instanceof Error ? error.message : '绘制失败';
  }
}

// #status priority: field error > API error > announcement.
function refreshValidityStatus(): void {
  if (invalid.size > 0) status.textContent = ERROR_TEXT;
  else if (apiError !== null) status.textContent = apiError;
  else if (status.textContent === ERROR_TEXT) status.textContent = '';
}

function syncEndpointInputs(which: Endpoint): void {
  for (const id of ENDPOINT_FIELDS[which]) {
    invalid.delete(id);
    inputs[id].removeAttribute('aria-invalid');
  }
  const [xId, yId] = ENDPOINT_FIELDS[which];
  const p = point(which);
  inputs[xId].value = fmt(p.x);
  inputs[yId].value = fmt(p.y);
}

function selectEndpoint(which: Endpoint): void {
  selected = which;
  (which === 'start' ? radioStart : radioEnd).checked = true;
  draw();
}

function setPoint(which: Endpoint, p: Vec2, errField?: FieldId): boolean {
  const ok = applyOps([{ op: `set-${which}`, value: { x: p.x, y: p.y } }], errField);
  if (ok) draw();
  return ok;
}

// Parse ONLY the field that fired: the other inputs display rounded values,
// while the untouched component keeps the document's full precision.
form.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target === inputs.zoom) {
    if (target.validity.valid && Number.isFinite(target.valueAsNumber)) {
      applyOps([{
        op: 'set-viewport',
        value: { mode: 'explicit', originPx: { x: ORIGIN.x, y: ORIGIN.y }, pixelsPerUnit: target.valueAsNumber },
      }]);
      draw();
    }
    return;
  }
  if (target.name === 'endpoint') {
    if (target.checked && (target.value === 'start' || target.value === 'end')) {
      selectEndpoint(target.value);
    }
    return;
  }
  const field = target.id as FieldId;
  let which: Endpoint | null = null;
  let component: 'x' | 'y' | null = null;
  for (const w of ['start', 'end'] as const) {
    if (ENDPOINT_FIELDS[w][0] === field) { which = w; component = 'x'; }
    if (ENDPOINT_FIELDS[w][1] === field) { which = w; component = 'y'; }
  }
  if (which === null || component === null) return;
  if (target.validity.valid && Number.isFinite(target.valueAsNumber)) {
    const cur = point(which);
    const next = component === 'x' ? vec2(target.valueAsNumber, cur.y) : vec2(cur.x, target.valueAsNumber);
    if (setPoint(which, next, field)) {
      invalid.delete(field);
      target.removeAttribute('aria-invalid');
    }
  } else {
    invalid.add(field);
    target.setAttribute('aria-invalid', 'true');
  }
  refreshValidityStatus();
});

/* --- endpoint dragging (demo layer; core stays DOM-free) --- */

let drag: { pointerId: number; target: Endpoint; offset: Vec2 } | null = null;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// clientX/Y -> SVG viewBox px via the inverse CTM -> world. No rect math.
function clientToWorld(clientX: number, clientY: number): Vec2 | null {
  const svg = canvas.querySelector('svg');
  if (!(svg instanceof SVGSVGElement)) return null;
  const ctm = svg.getScreenCTM();
  if (ctm === null) return null;
  const inverse = invertAffine(ctm);
  if (inverse === null) return null;
  const svgPoint = applyAffine(vec2(clientX, clientY), inverse);
  return screenToWorld(svgPoint, viewport());
}

function commitDrag(which: Endpoint, p: Vec2): void {
  if (!setPoint(which, p)) return;
  syncEndpointInputs(which);
  refreshValidityStatus();
}

// One exit path for pointerup / pointercancel / lostpointercapture / reset.
function endDrag(announce: boolean, error?: string): void {
  if (drag === null) return;
  const { pointerId, target } = drag;
  drag = null;
  try {
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  } catch { /* synthetic pointer ids may never have been captured */ }
  canvas.classList.remove('dragging');
  syncEndpointInputs(target);
  if (error !== undefined) {
    status.textContent = error;
  } else if (invalid.size > 0) {
    status.textContent = ERROR_TEXT;
  } else if (apiError !== null) {
    status.textContent = apiError;
  } else if (announce) {
    const p = point(target);
    const name = target === 'start' ? '起点' : '终点';
    status.textContent = `${name}移到 (${fmt(p.x)}, ${fmt(p.y)})`;
  }
}

canvas.addEventListener('pointerdown', (event) => {
  if (drag !== null) return;
  if (event.pointerType === 'mouse' ? event.button !== 0 : !event.isPrimary) return;
  if (!(event.target instanceof Element)) return;
  const handle = event.target.closest('[data-handle]');
  if (handle === null || !canvas.contains(handle)) return;
  const which = handle.getAttribute('data-handle');
  if (which !== 'start' && which !== 'end') return;
  event.preventDefault();
  selectEndpoint(which);
  const pt = clientToWorld(event.clientX, event.clientY);
  if (pt === null) {
    status.textContent = '无法换算指针坐标。';
    return;
  }
  drag = { pointerId: event.pointerId, target: which, offset: sub(point(which), pt) };
  // Synthetic test events can lack an active pointer; id tracking still works.
  try { canvas.setPointerCapture(event.pointerId); } catch { /* not capturable */ }
  canvas.classList.add('dragging');
});

canvas.addEventListener('pointermove', (event) => {
  if (drag === null || event.pointerId !== drag.pointerId) return;
  const pt = clientToWorld(event.clientX, event.clientY);
  if (pt === null) {
    endDrag(true, '无法换算指针坐标。');
    return;
  }
  const moved = add(pt, drag.offset);
  commitDrag(drag.target, vec2(
    clamp(moved.x, BOUNDS.xMin, BOUNDS.xMax),
    clamp(moved.y, BOUNDS.yMin, BOUNDS.yMax),
  ));
});

const finishDrag = (event: PointerEvent): void => {
  if (drag === null || event.pointerId !== drag.pointerId) return;
  endDrag(true);
};
canvas.addEventListener('pointerup', finishDrag);
canvas.addEventListener('pointercancel', finishDrag);
canvas.addEventListener('lostpointercapture', finishDrag);

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('reset', () => {
  endDrag(false);
  // The browser restores control values after the reset event; sync afterwards.
  setTimeout(() => {
    if (!createDefault()) return;
    selected = 'end';
    invalid.clear();
    for (const input of Object.values(inputs)) input.removeAttribute('aria-invalid');
    const s = point('start');
    const e = point('end');
    inputs.ax.value = fmt(s.x);
    inputs.ay.value = fmt(s.y);
    inputs.bx.value = fmt(e.x);
    inputs.by.value = fmt(e.y);
    inputs.zoom.value = String(DEFAULT_ZOOM);
    radioEnd.checked = true;
    status.textContent = '';
    draw();
  });
});

// Read-only document access for tests: proves the page runs on the same
// document/command boundary the authoring API exposes to agents.
(window as unknown as { __pvDocument: () => SceneDocument }).__pvDocument =
  () => JSON.parse(JSON.stringify(page.document)) as SceneDocument;

createDefault();
draw();
