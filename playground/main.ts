import { magnitude, renderArrowSvg, sub, vec2 } from '../src/index.js';

function element<T extends HTMLElement>(id: string, kind: { new(): T }): T {
  const found = document.getElementById(id);
  if (!(found instanceof kind)) throw new Error(`Missing element: ${id}`);
  return found;
}
const form = element('controls', HTMLFormElement);
const canvas = element('canvas', HTMLDivElement);
const status = element('status', HTMLParagraphElement);

function number(id: string): number {
  const input = element(id, HTMLInputElement);
  if (!input.validity.valid || !Number.isFinite(input.valueAsNumber)) {
    throw new RangeError('请填写范围内的有限数值。');
  }
  return input.valueAsNumber;
}

function draw(): void {
  try {
    const start = vec2(number('ax'), number('ay'));
    const end = vec2(number('bx'), number('by'));
    const delta = sub(end, start);
    const label = `向量 (${delta.x}, ${delta.y})`;
    const svg = renderArrowSvg({
      start, end, label, widthPx: 640, heightPx: 360,
      viewport: { originPx: vec2(320, 180), pixelsPerUnit: number('zoom') },
    });
    // Parse only OUR serializer output; never use this route for arbitrary user SVG.
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    if (parsed.querySelector('parsererror')) throw new Error('SVG serialization failed');
    canvas.replaceChildren(document.importNode(parsed.documentElement, true));
    status.textContent = `长度 ${magnitude(delta).toFixed(3)}（无量纲）`;
  } catch (error: unknown) {
    status.textContent = error instanceof Error ? error.message : '绘制失败';
  }
}
form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('input', draw);
form.addEventListener('reset', () => queueMicrotask(draw));
draw();
