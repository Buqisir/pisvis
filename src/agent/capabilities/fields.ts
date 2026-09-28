import * as v from 'valibot';

// Shared param field schemas for the vector capabilities — one bound, one
// label rule. The bound is each capability's own mathematical bound —
// deliberately wider than the M1 drag range ([-4,4]) which only limited
// interactive editing.
const COORD_BOUND = 1e6;
export const coordinate = v.pipe(v.number(), v.finite(),
  v.minValue(-COORD_BOUND), v.maxValue(COORD_BOUND));
export const pointSchema = v.strictObject({ x: coordinate, y: coordinate });
export const labelSchema = v.pipe(v.string(), v.maxLength(200),
  v.check((s) => !/[\x00-\x1f]/.test(s), 'label must not contain control characters'));

/** Single math symbols (V, B′, Fx…) render italic serif; anything else is text. */
export function labelStyle(text: string): 'variable' | 'text' {
  return /^[A-Za-z][A-Za-z′']{0,3}$/.test(text) ? 'variable' : 'text';
}
