import { finite, vec2 } from '../math/vec2.js';
import type { Vec2 } from '../math/vec2.js';

/**
 * 2D affine matrix in DOMMatrix order:
 * x' = a*x + c*y + e, y' = b*x + d*y + f.
 * Units are whatever the caller's coordinate spaces are.
 * A DOMMatrix is structurally compatible, so callers may pass one directly.
 */
export interface Affine2D {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

function checked(m: Affine2D): void {
  finite(m.a, 'a'); finite(m.b, 'b'); finite(m.c, 'c');
  finite(m.d, 'd'); finite(m.e, 'e'); finite(m.f, 'f');
}

export function applyAffine(point: Vec2, m: Affine2D): Vec2 {
  vec2(point.x, point.y);
  checked(m);
  return vec2(
    m.a * point.x + m.c * point.y + m.e,
    m.b * point.x + m.d * point.y + m.f,
  );
}

/** Returns null when the matrix is singular or numerically non-invertible. */
export function invertAffine(m: Affine2D): Affine2D | null {
  checked(m);
  const det = m.a * m.d - m.b * m.c;
  const s = Math.max(Math.abs(m.a), Math.abs(m.b), Math.abs(m.c), Math.abs(m.d));
  if (det === 0 || Math.abs(det) <= Number.EPSILON * s * s) return null;
  const inverse: Affine2D = {
    a: m.d / det,
    b: -m.b / det,
    c: -m.c / det,
    d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det,
    f: (m.b * m.e - m.a * m.f) / det,
  };
  return [inverse.a, inverse.b, inverse.c, inverse.d, inverse.e, inverse.f]
    .every(Number.isFinite) ? inverse : null;
}
