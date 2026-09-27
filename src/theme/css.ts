import { COLOR_ROLES, checkTheme } from './tokens.js';
import type { ThemeDefinition } from './tokens.js';

// The output is injected as style.textContent, so both the selector and every
// token string must stay inside a strict whitelist — no untrusted content in.
export const THEME_SELECTOR_PATTERN = /^\[data-pv-theme="[a-z][a-z0-9-]{0,63}"\]$/;

const px = (n: number) => `${n}px`;

/**
 * Renders a theme as scoped custom properties: sRGB fallbacks first, then an
 * @supports block upgrading color vars to OKLCH. Numeric/geometry vars too.
 */
export function themeToCssText(theme: ThemeDefinition, selector: string): string {
  if (!THEME_SELECTOR_PATTERN.test(selector)) {
    throw new RangeError(`selector must be a [data-pv-theme="..."] attribute selector`);
  }
  checkTheme(theme);
  const srgb = COLOR_ROLES.map((r) => `--pv-${r}:${theme.color[r].srgb};`).join('');
  const oklch = COLOR_ROLES.map((r) => `--pv-${r}:${theme.color[r].oklch};`).join('');
  const misc = [
    `--pv-stroke-main:${px(theme.stroke.main)}`,
    `--pv-stroke-aux:${px(theme.stroke.aux)}`,
    `--pv-stroke-axis:${px(theme.stroke.axis)}`,
    `--pv-stroke-grid:${px(theme.stroke.grid)}`,
    `--pv-arrow-head-length:${px(theme.arrow.headLength)}`,
    `--pv-arrow-head-width:${px(theme.arrow.headWidth)}`,
    `--pv-point-radius:${px(theme.point.radius)}`,
    `--pv-handle-radius:${px(theme.point.handleRadius)}`,
    `--pv-hit-radius:${px(theme.point.hitRadius)}`,
    `--pv-dash-guide:${theme.dash.guide}`,
    `--pv-dash-component:${theme.dash.component}`,
    `--pv-font-family:${theme.text.family}`,
    `--pv-font-variable:${theme.text.variableFamily}`,
    `--pv-font-numeric:${theme.text.numericFamily}`,
    `--pv-text-label:${px(theme.text.label)}`,
    `--pv-text-value:${px(theme.text.value)}`,
    `--pv-text-caption:${px(theme.text.caption)}`,
    `--pv-label-offset:${px(theme.space.labelOffset)}`,
    `--pv-safe-margin:${px(theme.space.safeMargin)}`,
    `--pv-motion-ms:${theme.motion.emphasisMs}ms`,
    `--pv-easing:${theme.motion.easing}`,
  ].join(';') + ';';
  return `${selector}{${srgb}${misc}}` +
    `@supports (color: oklch(0% 0 0)){${selector}{${oklch}}}`;
}
