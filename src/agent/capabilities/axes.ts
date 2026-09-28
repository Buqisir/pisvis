import type { Vec2 } from '../../math/vec2.js';

/** Nice round tick spacing ≈ one per 60–140 world-unit window subdivisions. */
export function tickFor(span: number): number {
  const rough = span / 6;
  const mag = 10 ** Math.floor(Math.log10(rough));
  for (const m of [1, 2, 5, 10]) if (mag * m >= rough) return mag * m;
  return mag * 10;
}

export interface AxesRange {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly tick: number;
}

/** Axes cover the origin plus every given point, then run a bit past the
    content: positive ends pad to the next whole tick plus a half unit so an
    arrow tip never sits on an axis head or grid corner. `loPadTicks` extends
    each snapped min by whole ticks — headroom for labels that sit below or
    left of the axes (e.g. component labels under the x axis). */
export function axesRange(points: readonly Vec2[], loPadTicks = 0): AxesRange {
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  // a fully degenerate span still needs a real tick spacing
  const tick = tickFor(Math.max(maxX - minX, maxY - minY, 1));
  const padHi = (val: number) => Math.floor(val / tick) * tick + tick + 0.5;
  const loPad = loPadTicks * tick;
  return {
    minX: Math.floor(minX / tick) * tick - loPad,
    maxX: padHi(maxX),
    minY: Math.floor(minY / tick) * tick - loPad,
    maxY: padHi(maxY),
    tick,
  };
}
