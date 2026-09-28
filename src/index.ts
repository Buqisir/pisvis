export { vec2, add, sub, scale, dot, magnitude, normalize } from './math/vec2.js';
export type { Vec2 } from './math/vec2.js';
export {
  flightRange, flightTime, landingSpeed, midpointX, stateAt, timeDomain,
  trajectoryPoints,
} from './models/projectile.js';
export type { ProjectileInput, ProjectileState } from './models/projectile.js';
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
  DEFAULT_THEME, THEMES, THEME_ILLUSTRATED, THEME_LINEWORK, getTheme,
} from './theme/themes.js';
export { themeToCssText } from './theme/css.js';
export { SCENE_BASE_CSS } from './theme/scene-css.js';
export { renderStandaloneSceneSvg } from './render/standalone.js';
