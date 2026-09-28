import { finite, positive, vec2 } from '../math/vec2.js';
import type { Vec2 } from '../math/vec2.js';
import type { Viewport } from './viewport.js';

/**
 * Uniform-scale viewport that fits all points inside a px rect minus margin,
 * centered. A degenerate (zero) extent on an axis is treated as 1 world unit
 * so the scale stays finite. Throws on empty input, impossible margins or
 * non-finite values — never silently clips.
 */
export function fitViewport(
  points: readonly Vec2[],
  widthPx: number,
  heightPx: number,
  marginPx: number,
): Viewport {
  positive(widthPx, 'widthPx');
  positive(heightPx, 'heightPx');
  finite(marginPx, 'marginPx');
  if (marginPx < 0) throw new RangeError('marginPx must be >= 0');
  const availW = widthPx - 2 * marginPx;
  const availH = heightPx - 2 * marginPx;
  if (availW <= 0 || availH <= 0) {
    throw new RangeError('marginPx leaves no room for the content');
  }
  if (points.length === 0) throw new RangeError('fitViewport needs at least one point');
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    vec2(p.x, p.y);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const extentX = maxX - minX || 1;
  const extentY = maxY - minY || 1;
  const scale = Math.min(availW / extentX, availH / extentY);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return {
    originPx: vec2(widthPx / 2 - centerX * scale, heightPx / 2 + centerY * scale),
    pixelsPerUnit: scale,
  };
}

/**
 * Per-axis fit for function graphs whose axes carry different units: the point
 * bounds are mapped onto the whole available rect, so x and y scale
 * independently. World geometry is distorted by design — never use this for
 * situations where on-screen lengths encode physical quantities.
 */
export function stretchViewport(
  points: readonly Vec2[],
  widthPx: number,
  heightPx: number,
  marginPx: number,
): Viewport {
  positive(widthPx, 'widthPx');
  positive(heightPx, 'heightPx');
  finite(marginPx, 'marginPx');
  if (marginPx < 0) throw new RangeError('marginPx must be >= 0');
  const availW = widthPx - 2 * marginPx;
  const availH = heightPx - 2 * marginPx;
  if (availW <= 0 || availH <= 0) {
    throw new RangeError('marginPx leaves no room for the content');
  }
  if (points.length === 0) throw new RangeError('stretchViewport needs at least one point');
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    vec2(p.x, p.y);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const extentX = maxX - minX || 1;
  const extentY = maxY - minY || 1;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const kx = availW / extentX;
  const ky = availH / extentY;
  return {
    originPx: vec2(widthPx / 2 - cx * kx, heightPx / 2 + cy * ky),
    pixelsPerUnit: kx,
    pixelsPerUnitY: ky,
  };
}
