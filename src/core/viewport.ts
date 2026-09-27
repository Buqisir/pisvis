import { positive, vec2 } from '../math/vec2.js';
import type { Vec2 } from '../math/vec2.js';

/** World: x right, y up. Screen: x right, y down. Uniform scale only. */
export interface Viewport {
  readonly originPx: Vec2;
  readonly pixelsPerUnit: number;
}

function check(view: Viewport): void {
  vec2(view.originPx.x, view.originPx.y);
  positive(view.pixelsPerUnit, 'pixelsPerUnit');
}

export function worldToScreen(point: Vec2, view: Viewport): Vec2 {
  check(view); vec2(point.x, point.y);
  return vec2(
    view.originPx.x + point.x * view.pixelsPerUnit,
    view.originPx.y - point.y * view.pixelsPerUnit,
  );
}

export function screenToWorld(point: Vec2, view: Viewport): Vec2 {
  check(view); vec2(point.x, point.y);
  return vec2(
    (point.x - view.originPx.x) / view.pixelsPerUnit,
    (view.originPx.y - point.y) / view.pixelsPerUnit,
  );
}
