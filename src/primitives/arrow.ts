import { add, magnitude, normalize, positive, scale, sub, vec2 } from '../math/vec2.js';
import type { Vec2 } from '../math/vec2.js';

export type ArrowGeometry =
  | { readonly kind: 'zero'; readonly point: Vec2 }
  | {
      readonly kind: 'arrow';
      readonly start: Vec2;
      readonly base: Vec2;
      readonly tip: Vec2;
      readonly left: Vec2;
      readonly right: Vec2;
    };

/** All arguments use the SAME coordinate system and units, not necessarily meters. */
export function buildArrow(
  start: Vec2,
  end: Vec2,
  headLength = 12,
  headWidth = 8,
): ArrowGeometry {
  positive(headLength, 'headLength'); positive(headWidth, 'headWidth');
  const delta = sub(end, start);
  const direction = normalize(delta);
  if (direction === null) return { kind: 'zero', point: vec2(start.x, start.y) };
  // A short vector must not acquire a head that points back beyond its origin.
  const length = Math.min(headLength, magnitude(delta) * 0.45);
  const halfWidth = (headWidth / 2) * (length / headLength);
  const base = sub(end, scale(direction, length));
  const side = scale(vec2(-direction.y, direction.x), halfWidth);
  return {
    kind: 'arrow', start: vec2(start.x, start.y), base,
    tip: vec2(end.x, end.y), left: add(base, side), right: sub(base, side),
  };
}
