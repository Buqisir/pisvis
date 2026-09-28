// Agent-facing authoring entry: pure data in/out, no DOM, no node:* imports.
import { createAuthoringApi } from './api.js';
import { CAPABILITY_REGISTRY } from './registry.js';

export { createAuthoringApi } from './api.js';
export { ERROR_DOCS } from './errors.js';
export { CAPABILITY_REGISTRY } from './registry.js';
export { arrowV1 } from './capabilities/arrow.js';
export { ERROR_CODES } from './types.js';
export type {
  ApiError, ApiResult, AuthoringApi, CapabilityDefinition, CapabilityListItem,
  CapabilityListResult, Checks, ErrorCode, Failure, RenderSuccess,
  SceneDocument, SceneOperation, SceneSuccess,
} from './types.js';

/** Production API backed by the reviewed registry. */
export const authoring = createAuthoringApi(CAPABILITY_REGISTRY);
