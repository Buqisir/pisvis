import {
  add, applyAffine, invertAffine, magnitude, renderArrowSvg, screenToWorld,
  sub, vec2, worldToScreen,
} from '../src/index.js';
import type { Vec2 } from '../src/index.js';
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

interface PlaygroundState {
  start: Vec2;
  end: Vec2;
  zoom: number;
  selected: Endpoint;
}

const DEFAULT_STATE: PlaygroundState = {
  start: vec2(-2, -1),
  end: vec2(2, 1),
  zoom: 50,
  selected: 'end',
};
const state: PlaygroundState = {
  start: DEFAULT_STATE.start,
  end: DEFAULT_STATE.end,
  zoom: DEFAULT_STATE.zoom,
  selected: DEFAULT_STATE.selected,
};

const WIDTH_PX = 640;
const HEIGHT_PX = 360;
const ORIGIN = vec2(320, 180);
// Demo-layer drag bounds; the core geometry functions stay unbounded.
const BOUNDS = { xMin: -4, xMax: 4, yMin: -2, yMax: 2 };
const ERROR_TEXT = '请填写范围内的有限数值。';
const SVG_NS = 'http://www.w3.org/2000/svg';

const invalid = new Set<FieldId>();
const ENDPOINT_FIELDS: Record<Endpoint, [FieldId, FieldId]> = {
  start: ['ax', 'ay'],
  end: ['bx', 'by'],
};

const viewport = () => ({ originPx: ORIGIN, pixelsPerUnit: state.zoom });

function directionText(delta: Vec2): string {
  if (magnitude(delta) === 0) return '—';
  return `${((Math.atan2(delta.y, delta.x) * 180) / Math.PI).toFixed(1)}°`;
}

function circle(attrs: Record<string, string | number>): SVGCircleElement {
  const node = document.createElementNS(SVG_NS, 'circle');
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}

// The selected handle renders last so it stays on top when endpoints coincide.
function addHandles(svg: SVGSVGElement): void {
  const order: Endpoint[] = state.selected === 'end' ? ['start', 'end'] : ['end', 'start'];
  for (const which of order) {
    const p = worldToScreen(state[which], viewport());
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('data-handle', which);
    g.setAttribute('class', `handle handle-${which}`);
    g.append(
      circle({ class: 'hit', cx: p.x, cy: p.y, r: 16, fill: 'transparent', 'pointer-events': 'all' }),
      circle({ class: 'dot', cx: p.x, cy: p.y, r: 7 }),
    );
    if (which === state.selected) {
      g.classList.add('selected');
      g.append(circle({ class: 'ring', cx: p.x, cy: p.y, r: 11 }));
    }
    svg.append(g);
  }
}

function draw(): void {
  try {
    const delta = sub(state.end, state.start);
    const label = `向量 (${fmt(delta.x)}, ${fmt(delta.y)})`;
    const text = renderArrowSvg({
      start: state.start, end: state.end, label,
      widthPx: WIDTH_PX, heightPx: HEIGHT_PX, viewport: viewport(),
    });
    // Parse only OUR serializer output; never use this route for arbitrary user SVG.
    const parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (parsed.querySelector('parsererror')) throw new Error('SVG serialization failed');
    const svg = document.importNode(parsed.documentElement, true);
    if (!(svg instanceof SVGSVGElement)) throw new Error('SVG import failed');
    addHandles(svg);
    canvas.replaceChildren(svg);
    readout.textContent =
      `起点 (${fmt(state.start.x)}, ${fmt(state.start.y)}) · ` +
      `终点 (${fmt(state.end.x)}, ${fmt(state.end.y)}) · ` +
      `长度 ${magnitude(delta).toFixed(3)}（无量纲）· 方向 ${directionText(delta)}`;
  } catch (error: unknown) {
    status.textContent = error instanceof Error ? error.message : '绘制失败';
  }
}

// #status shows the field error while any field is invalid, else announcements.
function refreshValidityStatus(): void {
  if (invalid.size > 0) status.textContent = ERROR_TEXT;
  else if (status.textContent === ERROR_TEXT) status.textContent = '';
}

const FIELD_SETTERS: Record<FieldId, (value: number) => void> = {
  ax: (v) => { state.start = vec2(v, state.start.y); },
  ay: (v) => { state.start = vec2(state.start.x, v); },
  bx: (v) => { state.end = vec2(v, state.end.y); },
  by: (v) => { state.end = vec2(state.end.x, v); },
};

function syncEndpointInputs(which: Endpoint): void {
  for (const id of ENDPOINT_FIELDS[which]) {
    invalid.delete(id);
    inputs[id].removeAttribute('aria-invalid');
  }
  const [xId, yId] = ENDPOINT_FIELDS[which];
  inputs[xId].value = fmt(state[which].x);
  inputs[yId].value = fmt(state[which].y);
}

function selectEndpoint(which: Endpoint): void {
  state.selected = which;
  (which === 'start' ? radioStart : radioEnd).checked = true;
  draw();
}

// Parse ONLY the field that fired: the other inputs display rounded values.
form.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target === inputs.zoom) {
    if (target.validity.valid && Number.isFinite(target.valueAsNumber)) {
      state.zoom = target.valueAsNumber;
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
  if (!(field in FIELD_SETTERS)) return;
  if (target.validity.valid && Number.isFinite(target.valueAsNumber)) {
    invalid.delete(field);
    target.removeAttribute('aria-invalid');
    FIELD_SETTERS[field](target.valueAsNumber);
    draw();
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

function commitDrag(which: Endpoint, point: Vec2): void {
  state[which] = point;
  syncEndpointInputs(which);
  draw();
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
  } else if (announce) {
    const p = state[target];
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
  const point = clientToWorld(event.clientX, event.clientY);
  if (point === null) {
    status.textContent = '无法换算指针坐标。';
    return;
  }
  drag = { pointerId: event.pointerId, target: which, offset: sub(state[which], point) };
  // Synthetic test events can lack an active pointer; id tracking still works.
  try { canvas.setPointerCapture(event.pointerId); } catch { /* not capturable */ }
  canvas.classList.add('dragging');
});

canvas.addEventListener('pointermove', (event) => {
  if (drag === null || event.pointerId !== drag.pointerId) return;
  const point = clientToWorld(event.clientX, event.clientY);
  if (point === null) {
    endDrag(true, '无法换算指针坐标。');
    return;
  }
  const moved = add(point, drag.offset);
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
    state.start = DEFAULT_STATE.start;
    state.end = DEFAULT_STATE.end;
    state.zoom = DEFAULT_STATE.zoom;
    state.selected = DEFAULT_STATE.selected;
    invalid.clear();
    for (const input of Object.values(inputs)) input.removeAttribute('aria-invalid');
    inputs.ax.value = fmt(state.start.x);
    inputs.ay.value = fmt(state.start.y);
    inputs.bx.value = fmt(state.end.x);
    inputs.by.value = fmt(state.end.y);
    inputs.zoom.value = String(state.zoom);
    radioEnd.checked = true;
    status.textContent = '';
    draw();
  });
});

draw();
