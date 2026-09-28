/**
 * Formula registry for the horizontal-projectile model — relations mirror
 * src/models/projectile.ts and docs/models/horizontal-projectile.md §3
 * (project coords: x right, y up; launch (0,h) with velocity (u,0); SI units
 * m, m/s, m/s², s).
 *
 * The adapter in index.ts calls `build` only after every key in `requires`
 * has been validated to a finite number, and only when `applicable` returns
 * null. Builders must substitute numbers via fmt/fac/sq — never raw strings —
 * so TeX cannot carry injected content.
 */

export interface FormulaNumbers {
  readonly [key: string]: number;
}

export interface FormulaSpec {
  readonly id: string;
  /** zh display name */
  readonly name: string;
  /** value keys that must be finite numbers before build/applicable run */
  readonly requires: readonly string[];
  /** null when the relation applies; otherwise a zh reason (rendered as not-applicable) */
  readonly applicable?: (v: FormulaNumbers) => string | null;
  /** registered-code TeX template with the validated numbers substituted in */
  readonly build: (v: FormulaNumbers) => string;
}

/** <= 6 significant digits, trimmed; `e`-notation becomes `\times 10^{e}`.
    Throws RangeError on non-finite results so overflow never prints "Infinity". */
const fmt = (n: number): string => {
  if (!Number.isFinite(n)) throw new RangeError('non-finite display value');
  const s = String(Number(n.toPrecision(6)));
  const e = s.indexOf('e');
  if (e === -1) return s;
  return `${s.slice(0, e)} \\times 10^{${Number(s.slice(e + 1))}}`;
};

/** '=' when the 6-digit display rounding is exact, else '\approx'. */
const eq = (n: number): string => (Number(n.toPrecision(6)) === n ? '=' : '\\approx');

/** Multiplicand/base: negatives and `\times 10^{}` forms need parens. */
const fac = (n: number): string => {
  const s = fmt(n);
  return /^[0-9.]+$/.test(s) ? s : `\\left(${s}\\right)`;
};

const sq = (n: number): string => `${fac(n)}^{2}`;

/** u > 0: ÷u relations do not exist in the u = 0 free-fall degeneracy
    (trajectory becomes the vertical line x = 0, velocity points straight down). */
const needU: NonNullable<FormulaSpec['applicable']> = (v) => {
  const { u } = v as { u: number };
  return u > 0 ? null : '该式含 ÷u：u=0 时是自由落体（轨迹为竖直直线 x=0），本式不适用';
};

/** √(2h/g) domain: h >= 0 and g > 0. */
const needSqrtHG: NonNullable<FormulaSpec['applicable']> = (v) => {
  const { h, g } = v as { h: number; g: number };
  return h >= 0 && g > 0 ? null : '√(2h/g) 需要 h ≥ 0 且 g > 0';
};

export const PROJECTILE_FORMULAS: readonly FormulaSpec[] = Object.freeze([
  {
    id: 'x-t',
    name: '水平位移 x = ut',
    requires: ['u', 't'],
    build: (v) => {
      const { u, t } = v as { u: number; t: number };
      return `x = ut = ${fac(u)} \\times ${fac(t)} ${eq(u * t)} ${fmt(u * t)}\\ \\mathrm{m}`;
    },
  },
  {
    id: 'y-t',
    name: '高度 y = h − gt²/2',
    requires: ['h', 'g', 't'],
    build: (v) => {
      const { h, g, t } = v as { h: number; g: number; t: number };
      const r = h - (g * t * t) / 2;
      return `y = h - \\tfrac{1}{2}gt^{2} = ${fac(h)} - \\tfrac{1}{2} \\times ${fac(g)} \\times ${sq(t)} ${eq(r)} ${fmt(r)}\\ \\mathrm{m}`;
    },
  },
  {
    id: 'vx',
    name: '水平分速度 v_x = u',
    requires: ['u'],
    build: (v) => {
      const { u } = v as { u: number };
      return `v_x = u = ${fmt(u)}\\ \\mathrm{m/s}`;
    },
  },
  {
    id: 'vy',
    name: '竖直分速度 v_y = −gt',
    requires: ['g', 't'],
    build: (v) => {
      const { g, t } = v as { g: number; t: number };
      const r = -g * t + 0; // -0 renders as 0
      return `v_y = -gt = -${fac(g)} \\times ${fac(t)} ${eq(r)} ${fmt(r)}\\ \\mathrm{m/s}`;
    },
  },
  {
    id: 'speed',
    name: '速率 |v| = √(u² + g²t²)',
    requires: ['u', 'g', 't'],
    build: (v) => {
      const { u, g, t } = v as { u: number; g: number; t: number };
      const r = Math.hypot(u, g * t);
      return `|v| = \\sqrt{u^{2} + (gt)^{2}} = \\sqrt{${sq(u)} + \\left(${fac(g)} \\times ${fac(t)}\\right)^{2}} ${eq(r)} ${fmt(r)}\\ \\mathrm{m/s}`;
    },
  },
  {
    id: 'T',
    name: '飞行时间 T = √(2h/g)',
    requires: ['h', 'g'],
    applicable: needSqrtHG,
    build: (v) => {
      const { h, g } = v as { h: number; g: number };
      const r = Math.sqrt((2 * h) / g);
      return `T = \\sqrt{\\tfrac{2h}{g}} = \\sqrt{\\tfrac{2 \\times ${fmt(h)}}{${fmt(g)}}} ${eq(r)} ${fmt(r)}\\ \\mathrm{s}`;
    },
  },
  {
    id: 'R',
    name: '水平射程 R = uT',
    requires: ['u', 'h', 'g'],
    applicable: needSqrtHG,
    build: (v) => {
      const { u, h, g } = v as { u: number; h: number; g: number };
      const T = Math.sqrt((2 * h) / g);
      const r = u * T;
      return `R = uT = ${fac(u)} \\times ${fac(T)} ${eq(r)} ${fmt(r)}\\ \\mathrm{m}`;
    },
  },
  {
    id: 'landing-speed',
    name: '落地速率 |v_T| = √(u² + 2gh)',
    requires: ['u', 'g', 'h'],
    applicable: (v) => {
      const { u, g, h } = v as { u: number; g: number; h: number };
      return u * u + 2 * g * h >= 0 ? null : '√(u²+2gh) 需要根号内非负';
    },
    build: (v) => {
      const { u, g, h } = v as { u: number; g: number; h: number };
      const r = Math.sqrt(u * u + 2 * g * h);
      return `|v_T| = \\sqrt{u^{2} + 2gh} = \\sqrt{${sq(u)} + 2 \\times ${fac(g)} \\times ${fac(h)}} ${eq(r)} ${fmt(r)}\\ \\mathrm{m/s}`;
    },
  },
  {
    id: 'traj',
    name: '轨迹方程 y = h − gx²/(2u²)',
    requires: ['h', 'g', 'u'],
    applicable: needU,
    build: (v) => {
      const { h, g, u } = v as { h: number; g: number; u: number };
      const k = g / (2 * u * u);
      return `y = h - \\tfrac{g}{2u^{2}}x^{2} = ${fmt(h)} - \\tfrac{${fac(g)}}{2 \\times ${sq(u)}}x^{2} ${eq(k)} ${fmt(h)} ${k < 0 ? '+' : '-'} ${fmt(Math.abs(k))}x^{2}`;
    },
  },
  {
    id: 'tan-alpha',
    name: '速度偏角 tan α = gt/u',
    requires: ['g', 't', 'u'],
    applicable: needU,
    build: (v) => {
      const { g, t, u } = v as { g: number; t: number; u: number };
      const r = (g * t) / u;
      const deg = (Math.atan(r) * 180) / Math.PI;
      return `\\tan\\alpha = \\tfrac{gt}{u} = \\tfrac{${fac(g)} \\times ${fac(t)}}{${fac(u)}} ${eq(r)} ${fmt(r)}\\;\\Rightarrow\\;\\alpha ${eq(deg)} ${fmt(deg)}^{\\circ}`;
    },
  },
]);
