import type { Vec2 } from '../math/vec2.js';
import type { SceneItem } from '../render/scene.js';

// ---- scene document v1 (plain JSON) ----------------------------------------

/** Document unit marker. 'dimensionless' for pure math diagrams; 'si' for
    real-unit models (the capability's `coordinates`/`constraints` spell out
    which quantity carries which SI unit). */
export type SceneUnit = 'dimensionless' | 'si';

export interface SceneDocument {
  readonly schemaVersion: 1;
  readonly instanceId: string;
  readonly templateId: string;
  readonly templateVersion: number;
  readonly unit: SceneUnit;
  readonly params: Record<string, unknown>;
  readonly presentation: {
    readonly theme: { readonly id: string; readonly version: number };
    readonly canvas: { readonly width: number; readonly height: number };
    readonly viewport:
      | { readonly mode: 'fit' }
      | { readonly mode: 'explicit'; readonly originPx: Vec2; readonly pixelsPerUnit: number }
      /** Function graphs: x/y scale independently — never for physical geometry. */
      | { readonly mode: 'stretch' };
  };
}

export interface SceneOperation {
  readonly op: string;
  readonly value?: unknown;
}

// ---- results ----------------------------------------------------------------

export const ERROR_CODES = [
  'missing-field', 'unknown-field', 'invalid-type', 'non-finite',
  'out-of-range', 'label-too-long', 'unknown-capability', 'unknown-version',
  'unknown-theme', 'unsupported-schema-version', 'unit-mismatch',
  'readonly-field', 'invalid-operation', 'too-large', 'too-deep',
  'invalid-json', 'render-failed', 'usage-error', 'io-error',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiError {
  readonly code: ErrorCode;
  readonly path: string;
  readonly message: string;
  readonly expected?: string;
  readonly allowedValues?: readonly unknown[];
  readonly hint?: string;
}

export interface Checks {
  readonly structure: 'passed' | 'failed';
  readonly math: 'passed' | 'failed' | 'not_run';
  readonly physics: 'passed' | 'failed' | 'not_applicable';
  readonly visual: 'not_run';
}

export interface SceneSuccess {
  readonly ok: true;
  readonly capability: { readonly id: string; readonly version: number };
  readonly document: SceneDocument;
  /** Deterministic content hash of the normalized document — correlation, not security. */
  readonly documentHash: string;
  readonly derived: Record<string, unknown>;
  readonly summary: {
    readonly unit: SceneUnit;
    readonly coordinates: string;
    readonly assumptions: readonly string[];
    /** JSON paths that were filled from capability defaults. */
    readonly defaultsApplied: readonly string[];
  };
  readonly checks: Checks;
  readonly warnings: readonly string[];
}

export interface RenderSuccess extends SceneSuccess {
  readonly svg: string;
  readonly mimeType: 'image/svg+xml';
  readonly bytes: number;
}

export interface Failure {
  readonly ok: false;
  readonly errors: readonly ApiError[];
  readonly checks: Checks;
}

export type ApiResult = SceneSuccess | RenderSuccess | Failure;

export interface CapabilityListItem {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly summary: string;
  readonly kind: string;
  readonly available: true;
}

export interface CapabilityListResult {
  readonly ok: true;
  readonly items: readonly CapabilityListItem[];
  readonly total: number;
  readonly order: 'id asc, version asc';
  readonly pagination: 'none (catalog ≤ 50 entries)';
}

// ---- capability registry ----------------------------------------------------

export interface CapabilityExample {
  readonly minimal: unknown;
  readonly variant: unknown;
  readonly failure: { readonly request: unknown; readonly expectedCode: ErrorCode; readonly fix: string };
}

/**
 * One registered capability. `paramsSchema` holds the runtime validator
 * (a valibot schema internally) — it is typed `unknown` here so the public
 * surface of `./agent` stays free of third-party types; api.ts treats it
 * opaquely through `safeParse`.
 */
export interface CapabilityDefinition {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly summary: string;
  readonly goodFor: readonly string[];
  readonly notFor: readonly string[];
  readonly keywords: { readonly zh: readonly string[]; readonly en: readonly string[] };
  readonly kind: 'math-diagram' | 'physics-model';
  readonly available: true;
  readonly outputs: readonly ['scene-json', 'svg', 'report'];
  readonly runtime: string;
  readonly unit: SceneUnit;
  readonly coordinates: string;
  readonly assumptions: readonly string[];
  /** Internal runtime schema (valibot); never exposed as a type. */
  readonly paramsSchema: unknown;
  /** Precomputed JSON Schema for params (plain data). */
  readonly paramsJsonSchema: Record<string, unknown>;
  readonly writable: readonly string[];
  readonly derivedFields: readonly string[];
  readonly operations: readonly string[];
  readonly constraints: readonly string[];
  readonly defaults: {
    readonly label?: string;
    readonly presentation: SceneDocument['presentation'];
  };
  readonly examples: CapabilityExample;
  /**
   * Physics-domain check between structural parse and derived computation —
   * for cross-field semantics a schema cannot express (e.g. t <= T). Runs on
   * normalized params; returned errors fail with checks.physics='failed'.
   * Only `physics-model` capabilities provide it; others report not_applicable.
   */
  readonly physicsCheck?: (params: Record<string, unknown>) => readonly ApiError[];
  /** Extra warnings for degenerate-but-valid states (free fall, landed…). */
  readonly warnings?: (
    params: Record<string, unknown>, derived: Record<string, unknown>,
  ) => readonly string[];
  readonly derive: (params: Record<string, unknown>) => Record<string, unknown>;
  readonly scene: (
    params: Record<string, unknown>,
    derived: Record<string, unknown>,
    presentation: SceneDocument['presentation'],
  ) => SceneItem[];
  readonly fitPoints: (params: Record<string, unknown>, derived: Record<string, unknown>) => Vec2[];
}

export interface AuthoringApi {
  listCapabilities(req?: {
    readonly keyword?: string;
    readonly kind?: string;
  }): CapabilityListResult | Failure;
  describeCapability(req: {
    readonly id: string;
    readonly version: number;
  }): { readonly ok: true; readonly capability: Record<string, unknown> } | Failure;
  createScene(req: {
    readonly templateId: string;
    readonly templateVersion: number;
    readonly params: Record<string, unknown>;
    readonly presentation?: Partial<SceneDocument['presentation']>;
    readonly instanceId?: string;
  }): ApiResult;
  validateScene(req: { readonly document: unknown }): ApiResult;
  updateScene(req: {
    readonly document: unknown;
    readonly operations: readonly SceneOperation[];
  }): ApiResult;
  renderScene(req: { readonly document: unknown }): RenderSuccess | Failure;
}
