/** A dimensionless 2D vector. Physical units belong to a future model layer. */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export function finite(value: number, name = 'value'): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  return value;
}

export function positive(value: number, name = 'value'): number {
  finite(value, name);
  if (value <= 0) throw new RangeError(`${name} must be positive`);
  return value;
}

export function vec2(x: number, y: number): Vec2 {
  return { x: finite(x, 'x'), y: finite(y, 'y') };
}

function checked(v: Vec2): Vec2 {
  return vec2(v.x, v.y);
}

export function add(a: Vec2, b: Vec2): Vec2 {
  checked(a); checked(b);
  return vec2(a.x + b.x, a.y + b.y);
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  checked(a); checked(b);
  return vec2(a.x - b.x, a.y - b.y);
}

export function scale(v: Vec2, factor: number): Vec2 {
  checked(v); finite(factor, 'factor');
  return vec2(v.x * factor, v.y * factor);
}

export function dot(a: Vec2, b: Vec2): number {
  checked(a); checked(b);
  return finite(a.x * b.x + a.y * b.y, 'dot product');
}

export function magnitude(v: Vec2): number {
  checked(v);
  return finite(Math.hypot(v.x, v.y), 'magnitude');
}

/** Zero has no direction. Divide components directly to avoid 1 / tiny overflow. */
export function normalize(v: Vec2): Vec2 | null {
  const length = magnitude(v);
  return length === 0 ? null : vec2(v.x / length, v.y / length);
}
