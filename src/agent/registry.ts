import { arrowV1 } from './capabilities/arrow.js';
import { horizontalProjectileV1 } from './capabilities/horizontal-projectile.js';
import { vectorAddV1 } from './capabilities/vector-add.js';
import { vectorDecomposeV1 } from './capabilities/vector-decompose.js';
import type { CapabilityDefinition } from './types.js';

/**
 * The finite, code-reviewed capability catalog. Only `available: true`
 * capabilities are ever listed; planned capabilities live in docs/ROADMAP.md,
 * not here.
 */
export const CAPABILITY_REGISTRY: readonly CapabilityDefinition[] = Object.freeze([
  arrowV1,
  horizontalProjectileV1,
  vectorAddV1,
  vectorDecomposeV1,
]);
