import { themeToCssText } from '../theme/css.js';
import { SCENE_BASE_CSS } from '../theme/scene-css.js';
import type { SceneSvgOptions } from './scene.js';
import { renderSceneSvg } from './scene.js';

/**
 * Same deterministic scene markup as renderSceneSvg, but self-contained: the
 * root carries data-pv-theme and a <style> with the theme's scoped custom
 * properties plus the shared static rules, so the file renders correctly when
 * opened alone (no external stylesheet, no scripts, no external refs).
 */
export function renderStandaloneSceneSvg(options: SceneSvgOptions): string {
  const inner = renderSceneSvg(options);
  const scope = `[data-pv-theme="${options.theme.id}"]`;
  const style = `<style>${themeToCssText(options.theme, scope)}${SCENE_BASE_CSS}</style>`;
  return inner.replace('>', ` data-pv-theme="${options.theme.id}">${style}`);
}
