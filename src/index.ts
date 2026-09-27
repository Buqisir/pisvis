export { vec2, add, sub, scale, dot, magnitude, normalize } from './math/vec2.js';
export type { Vec2 } from './math/vec2.js';
export { worldToScreen, screenToWorld } from './core/viewport.js';
export type { Viewport } from './core/viewport.js';
export { applyAffine, invertAffine } from './core/affine.js';
export type { Affine2D } from './core/affine.js';
export { fitViewport } from './core/fit.js';
export { buildArrow } from './primitives/arrow.js';
export type { ArrowGeometry } from './primitives/arrow.js';
export { renderArrowSvg } from './render/svg.js';
export type { ArrowSvgOptions } from './render/svg.js';
export { renderSceneSvg } from './render/scene.js';
export type {
  SceneItem, SceneLabel, SceneRole, SceneState, SceneSvgOptions,
} from './render/scene.js';
export { COLOR_ROLES, checkTheme } from './theme/tokens.js';
export type { ColorRole, ColorToken, ThemeDefinition } from './theme/tokens.js';
export {
  CANDIDATE_ILLUSTRATED, CANDIDATE_LINEWORK, CANDIDATE_INSTRUMENT, CANDIDATE_THEMES,
} from './theme/themes.js';
export { themeToCssText } from './theme/css.js';
