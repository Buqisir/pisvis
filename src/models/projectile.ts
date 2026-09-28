import { vec2 } from '../math/vec2.js';
import type { Vec2 } from '../math/vec2.js';

/**
 * Horizontal projectile model (docs/models/horizontal-projectile.md):
 * constant g downward, no drag, flat ground y=0, launch from (0,h) with
 * velocity (u,0). SI units throughout: m, m/s, m/s², s.
 *
 * Pure and deterministic — no DOM, no I/O. Reviewed relations only;
 * callers must keep t inside the flight domain [0,T] (thrown otherwise).
 */

export interface ProjectileInput {
  /** launch height, m — must be > 0 */
  readonly h: number;
  /** horizontal launch speed, m/s — must be >= 0 (0 = free fall) */
  readonly u: number;
  /** gravitational acceleration magnitude, m/s² — must be > 0 */
  readonly g: number;
  /** time since launch, s — must lie in [0, T] */
  readonly t: number;
}

export interface ProjectileState {
  /** current position, m */
  readonly position: Vec2;
  /** current velocity, m/s (vy <= 0) */
  readonly velocity: Vec2;
  /** |v|, m/s */
  readonly speed: number;
  /** velocity deflection angle below the horizontal, degrees >= 0;
      null when v = 0 (u = 0 and t = 0) */
  readonly alphaDeg: number | null;
  /** displacement from launch point, m */
  readonly displacement: Vec2;
  readonly displacementLength: number;
  /** displacement angle below the horizontal, degrees >= 0;
      null when the displacement is zero (t = 0) */
  readonly thetaDeg: number | null;
  /** true when t has reached the flight time T */
  readonly landed: boolean;
}

const T_EPS = 1e-9;

/** -0 is a real artifact of -g·t at t=0; downstream JSON consumers and tests
    read 0. Adding 0 keeps the value identical except for the sign of zero. */
const nz = (n: number): number => n + 0;

function check(h: number, u: number, g: number): void {
  if (!Number.isFinite(h) || h <= 0) throw new RangeError('h must be a finite number > 0 (m)');
  if (!Number.isFinite(g) || g <= 0) throw new RangeError('g must be a finite number > 0 (m/s²)');
  if (!Number.isFinite(u) || u < 0) throw new RangeError('u must be a finite number >= 0 (m/s)');
}

/** Flight time T = sqrt(2h/g) — set by height and gravity alone. */
export function flightTime(h: number, g: number): number {
  if (!Number.isFinite(h) || h <= 0) throw new RangeError('h must be a finite number > 0 (m)');
  if (!Number.isFinite(g) || g <= 0) throw new RangeError('g must be a finite number > 0 (m/s²)');
  return Math.sqrt((2 * h) / g);
}

/** Flight domain [0, T] in seconds. */
export function timeDomain(h: number, g: number): readonly [number, number] {
  return [0, flightTime(h, g)];
}

/** Horizontal distance at landing R = u·T. */
export function flightRange(u: number, h: number, g: number): number {
  check(h, u, g);
  const r = u * flightTime(h, g);
  if (!Number.isFinite(r)) throw new RangeError('range overflow: u*T is not finite');
  return r;
}

/** Landing speed |v(T)| = sqrt(u² + 2gh). */
export function landingSpeed(u: number, h: number, g: number): number {
  check(h, u, g);
  const s = Math.sqrt(u * u + 2 * g * h);
  if (!Number.isFinite(s)) throw new RangeError('landing speed overflow');
  return s;
}

function degBelowHorizontal(v: Vec2): number {
  // components only — atan2 handles vertical motion (vx = 0) directly
  return nz((Math.atan2(-v.y, v.x) * 180) / Math.PI);
}

/** Full state at time t. t is clamped to T within epsilon so the exact
    boundary always lands exactly on the ground. */
export function stateAt(input: ProjectileInput): ProjectileState {
  const { h, u, g, t } = input;
  check(h, u, g);
  const T = flightTime(h, g);
  if (!Number.isFinite(t) || t < 0 || t > T + T_EPS) {
    throw new RangeError(`t must lie in [0, ${T}] s (received ${t})`);
  }
  const tc = Math.min(t, T);
  const position = vec2(u * tc, nz(h - (g * tc * tc) / 2));
  const velocity = vec2(u, nz(-g * tc));
  const speed = Math.hypot(velocity.x, velocity.y);
  if (!Number.isFinite(speed)) throw new RangeError('state overflow: speed is not finite');
  const displacement = vec2(u * tc, nz(-(g * tc * tc) / 2));
  const displacementLength = Math.hypot(displacement.x, displacement.y);
  return {
    position,
    velocity,
    speed,
    alphaDeg: speed === 0 ? null : degBelowHorizontal(velocity),
    displacement,
    displacementLength,
    thetaDeg: displacementLength === 0 ? null : degBelowHorizontal(displacement),
    landed: t >= T - T_EPS,
  };
}

/**
 * Sampled trajectory points for tc ∈ [fromT, toT]. Parametric in t — never
 * the closed-form y(x) — so u = 0 (a vertical line) works unchanged.
 * `segments` straight segments produce segments+1 points.
 */
export function trajectoryPoints(
  h: number, u: number, g: number,
  fromT: number, toT: number, segments: number,
): Vec2[] {
  check(h, u, g);
  const T = flightTime(h, g);
  if (!Number.isInteger(segments) || segments < 1 || segments > 4096) {
    throw new RangeError('segments must be an integer in [1, 4096]');
  }
  if (!(fromT >= 0) || !(toT <= T + T_EPS) || !(fromT < toT)) {
    throw new RangeError(`sample range must satisfy 0 <= fromT < toT <= ${T}`);
  }
  const pts: Vec2[] = [];
  for (let i = 0; i <= segments; i++) {
    const tc = Math.min(fromT + ((toT - fromT) * i) / segments, T);
    pts.push(vec2(u * tc, nz(h - (g * tc * tc) / 2)));
  }
  return pts;
}

/**
 * Textbook invariant (例 3): the velocity vector's backward extension meets
 * the launch-height horizontal at the midpoint of the horizontal
 * displacement, i.e. x = x_P/2. Returns that x coordinate, or null when the
 * extension is undefined (v parallel to the launch line: t = 0 or u = 0).
 */
export function midpointX(input: ProjectileInput): number | null {
  const { h, u, g, t } = input;
  const s = stateAt({ h, u, g, t });
  if (s.velocity.x === 0 || s.velocity.y === 0) return null;
  return s.position.x / 2;
}
