import { positive, vec2 } from '../math/vec2.js';
import type { Vec2 } from '../math/vec2.js';

/** World: x right, y up. Screen: x right, y down.
 *  Uniform scale by default; `pixelsPerUnitY` (function graphs only) opts into
 *  a per-axis mapping where x and y have different units (e.g. s vs m/s). */
export interface Viewport {
  readonly originPx: Vec2;
  readonly pixelsPerUnit: number;
  readonly pixelsPerUnitY?: number;
}

function check(view: Viewport): void {
  vec2(view.originPx.x, view.originPx.y);
  positive(view.pixelsPerUnit, 'pixelsPerUnit');
  if (view.pixelsPerUnitY !== undefined) positive(view.pixelsPerUnitY, 'pixelsPerUnitY');
}

export function worldToScreen(point: Vec2, view: Viewport): Vec2 {
  check(view); vec2(point.x, point.y);
  return vec2(
    view.originPx.x + point.x * view.pixelsPerUnit,
    view.originPx.y - point.y * (view.pixelsPerUnitY ?? view.pixelsPerUnit),
  );
}

export function screenToWorld(point: Vec2, view: Viewport): Vec2 {
  check(view); vec2(point.x, point.y);
  return vec2(
    (point.x - view.originPx.x) / view.pixelsPerUnit,
    (view.originPx.y - point.y) / (view.pixelsPerUnitY ?? view.pixelsPerUnit),
  );
}
