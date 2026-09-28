import { finite, positive } from '../math/vec2.js';

/** Semantic color roles shared by every theme. */
export const COLOR_ROLES = [
  'paper', 'ink', 'muted', 'grid', 'axis', 'input', 'derived',
  'component', 'guide', 'selection', 'error', 'focus',
] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];

/** OKLCH is the authored value; srgb is the in-gamut fallback for older engines. */
export interface ColorToken {
  readonly oklch: string;
  readonly srgb: string;
}

export interface ThemeDefinition {
  readonly id: string;            // /^[a-z][a-z0-9-]{0,63}$/
  readonly version: number;       // positive integer
  /** 'provisional' = adopted as the current default but still revisable. */
  readonly status: 'candidate' | 'provisional';
  readonly name: string;          // Chinese display name
  readonly color: Readonly<Record<ColorRole, ColorToken>>;
  // SVG px stroke widths; geometry, not colors.
  readonly stroke: {
    readonly main: number;
    readonly aux: number;
    readonly axis: number;
    readonly grid: number;
  };
  readonly arrow: { readonly headLength: number; readonly headWidth: number };
  readonly point: {
    readonly radius: number;
    readonly handleRadius: number;
    readonly hitRadius: number;
  };
  readonly dash: { readonly guide: string; readonly component: string };
  // System font stacks only; no font files ship with the project.
  readonly text: {
    readonly family: string;
    readonly variableFamily: string;
    readonly numericFamily: string;
    readonly label: number;
    readonly value: number;
    readonly caption: number;
  };
  readonly space: { readonly labelOffset: number; readonly safeMargin: number };
  readonly material: 'soft' | 'flat';
  readonly motion: { readonly emphasisMs: number; readonly easing: string };
}

export const THEME_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
export const SRGB_PATTERN = /^#[0-9a-f]{6}$/;
export const OKLCH_PATTERN = /^oklch\(\d+(\.\d+)?% \d+(\.\d+)? \d+(\.\d+)?\)$/;
const FONT_PATTERN = /^[a-zA-Z0-9 ,.'"()_-]+$/;
const DASH_PATTERN = /^[0-9]+(\.[0-9]+)?( [0-9]+(\.[0-9]+)?)*$/;
const EASING_PATTERN = new RegExp(
  '^(linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end|' +
  'cubic-bezier\\(-?\\d*\\.?\\d+,\\s*-?\\d*\\.?\\d+,\\s*-?\\d*\\.?\\d+,\\s*-?\\d*\\.?\\d+\\)|' +
  'steps\\(\\d+(,\\s*(jump-start|jump-end|jump-none|jump-both|start|end))?\\))$',
);
const MATERIALS = new Set(['soft', 'flat']);

function checkNumber(value: number, name: string, min: number): void {
  finite(value, name);
  if (value < min) throw new RangeError(`${name} must be >= ${min}`);
}

function checkString(value: string, pattern: RegExp, name: string): void {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new RangeError(`${name} failed validation: ${String(value)}`);
  }
}

/**
 * Validates a theme definition so token data can never carry malformed or
 * injectable strings into renderers or stylesheets. Returns the same object.
 */
export function checkTheme(theme: ThemeDefinition): ThemeDefinition {
  if (typeof theme !== 'object' || theme === null) {
    throw new RangeError('theme must be an object');
  }
  const t = theme as Partial<Record<keyof ThemeDefinition, unknown>>;
  for (const group of ['color', 'stroke', 'arrow', 'point', 'dash', 'text', 'space', 'motion'] as const) {
    if (typeof t[group] !== 'object' || t[group] === null) {
      throw new RangeError(`theme.${group} must be an object`);
    }
  }
  checkString(theme.id, THEME_ID_PATTERN, 'theme.id');
  if (!Number.isInteger(theme.version) || theme.version <= 0) {
    throw new RangeError('theme.version must be a positive integer');
  }
  if (theme.status !== 'candidate' && theme.status !== 'provisional') {
    throw new RangeError(`unknown theme status: ${String(theme.status)}`);
  }
  if (typeof theme.name !== 'string' || theme.name.length === 0) {
    throw new RangeError('theme.name must be a non-empty string');
  }
  for (const role of COLOR_ROLES) {
    const token = theme.color[role];
    if (typeof token !== 'object' || token === null) {
      throw new RangeError(`missing color role: ${role}`);
    }
    checkString(token.oklch, OKLCH_PATTERN, `color.${role}.oklch`);
    checkString(token.srgb, SRGB_PATTERN, `color.${role}.srgb`);
  }
  checkNumber(theme.stroke.main, 'stroke.main', 0);
  checkNumber(theme.stroke.aux, 'stroke.aux', 0);
  checkNumber(theme.stroke.axis, 'stroke.axis', 0);
  checkNumber(theme.stroke.grid, 'stroke.grid', 0);
  positive(theme.arrow.headLength, 'arrow.headLength');
  positive(theme.arrow.headWidth, 'arrow.headWidth');
  positive(theme.point.radius, 'point.radius');
  positive(theme.point.handleRadius, 'point.handleRadius');
  positive(theme.point.hitRadius, 'point.hitRadius');
  checkString(theme.dash.guide, DASH_PATTERN, 'dash.guide');
  checkString(theme.dash.component, DASH_PATTERN, 'dash.component');
  checkString(theme.text.family, FONT_PATTERN, 'text.family');
  checkString(theme.text.variableFamily, FONT_PATTERN, 'text.variableFamily');
  checkString(theme.text.numericFamily, FONT_PATTERN, 'text.numericFamily');
  positive(theme.text.label, 'text.label');
  positive(theme.text.value, 'text.value');
  positive(theme.text.caption, 'text.caption');
  checkNumber(theme.space.labelOffset, 'space.labelOffset', 0);
  positive(theme.space.safeMargin, 'space.safeMargin');
  if (!MATERIALS.has(theme.material)) throw new RangeError(`unknown material: ${theme.material}`);
  checkNumber(theme.motion.emphasisMs, 'motion.emphasisMs', 0);
  checkString(theme.motion.easing, EASING_PATTERN, 'motion.easing');
  return theme;
}
