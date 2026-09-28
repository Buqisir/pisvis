import * as v from 'valibot';
import { toJsonSchema } from '@valibot/to-json-schema';
import { fitViewport, stretchViewport } from '../core/fit.js';
import type { Viewport } from '../core/viewport.js';
import type { Vec2 } from '../math/vec2.js';
import { renderStandaloneSceneSvg } from '../render/standalone.js';
import { getTheme, THEMES } from '../theme/themes.js';
import type {
  ApiError, AuthoringApi, CapabilityDefinition, CapabilityListResult,
  Checks, ErrorCode, Failure, SceneDocument, SceneSuccess,
} from './types.js';

// ---- limits -----------------------------------------------------------------

const MAX_REQUEST_BYTES = 256 * 1024;
const MAX_DEPTH = 16;
const ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const CANVAS_MIN = 64;
const CANVAS_MAX = 4096;
const MAX_SCALE = 4096; // explicit viewport pixelsPerUnit bound
const MAX_COORDINATE = 1e6;

/** UTF-8 byte length without TextEncoder — keeps src/ on the ES2022-only lib. */
function utf8Bytes(str: string): number {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; } // surrogate pair
    else n += 3;
  }
  return n;
}

const isPlainObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x) &&
  (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** cyrb53 — small deterministic content hash for correlation. Not security. */
function hashHex(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

function depthOf(value: unknown): number {
  let max = 0;
  const stack: Array<{ v: unknown; d: number }> = [{ v: value, d: 0 }];
  while (stack.length > 0) {
    const { v: cur, d } = stack.pop()!;
    if (d > max) max = d;
    if (typeof cur === 'object' && cur !== null) {
      for (const child of Object.values(cur)) stack.push({ v: child, d: d + 1 });
    }
  }
  return max;
}

// ---- errors -----------------------------------------------------------------

function err(
  code: ErrorCode, path: string, message: string,
  extra: Partial<ApiError> = {},
): ApiError {
  return { code, path, message, ...extra };
}

function failure(
  errors: readonly ApiError[],
  structure: Checks['structure'],
  math: Checks['math'] = 'not_run',
  physics: Checks['physics'] = 'not_applicable',
): Failure {
  return {
    ok: false,
    errors,
    checks: { structure, math, physics, visual: 'not_run' },
  };
}

/** Limits that run before any expensive work. Returns a Failure or null. */
function guardRequest(req: unknown): Failure | null {
  let text: string;
  try {
    text = JSON.stringify(req);
  } catch {
    return failure([err('invalid-type', '', '请求必须是可 JSON 序列化的普通对象（不能含循环引用或函数）')], 'failed');
  }
  if (utf8Bytes(text ?? 'null') > MAX_REQUEST_BYTES) {
    return failure([err('too-large', '', '请求超过 256 KiB 上限，请缩小输入')], 'failed');
  }
  if (depthOf(req) > MAX_DEPTH) {
    return failure([err('too-deep', '', `嵌套深度超过 ${MAX_DEPTH} 层`)], 'failed');
  }
  return null;
}

// ---- validation helpers -----------------------------------------------------

type GenericSchema = { '~standard': unknown };
function parse(schema: GenericSchema, value: unknown): { ok: true; output: unknown } | { ok: false; issues: readonly v.GenericIssue[] } {
  const r = v.safeParse(schema as v.GenericSchema, value);
  return r.success ? { ok: true, output: r.output } : { ok: false, issues: r.issues };
}

function issuePath(issue: v.GenericIssue): string {
  const parts = (issue.path ?? []).map((p) => String(p.key));
  return parts.join('.');
}

/** Map one valibot issue to the stable error-code union. */
function mapIssue(issue: v.GenericIssue, basePath: string): ApiError {
  const path = basePath + (issuePath(issue) ? `.${issuePath(issue)}` : '');
  const key = String(issue.path?.[issue.path.length - 1]?.key ?? '');
  switch (issue.type) {
    case 'strict_object':
      if (issue.expected === 'never') {
        return err('unknown-field', path, `字段「${key}」不允许，请删除`, { expected: 'never' });
      }
      return err('missing-field', path, `缺少必填字段「${key}」`, { expected: key });
    case 'finite':
      return err('non-finite', path, `数值必须是有限数（收到 ${issue.received}）`, { expected: 'finite' });
    case 'min_value': case 'max_value': case 'gt_value': case 'lt_value':
      return err('out-of-range', path, `数值超出范围（${issue.expected}）`, {
        expected: String(issue.expected),
      });
    case 'min_length': case 'max_length':
      return err('label-too-long', path, `长度超出限制（${issue.expected}）`, {
        expected: String(issue.expected),
      });
    case 'regex':
      return err('invalid-type', path, `格式不正确（需要 ${issue.expected}）`, { expected: String(issue.expected) });
    case 'literal':
      return err('invalid-type', path, `取值必须是 ${issue.expected}（收到 ${issue.received}）`, {
        expected: String(issue.expected),
      });
    default:
      const expected = issue.expected !== null && issue.expected !== undefined
        ? { expected: String(issue.expected) } : {};
      return err('invalid-type', path, `类型或取值不正确：${issue.message}`, expected);
  }
}

// ---- document envelope schema ------------------------------------------------

const idString = v.pipe(v.string(), v.regex(ID_PATTERN));
const canvasSchema = v.strictObject({
  width: v.pipe(v.number(), v.integer(), v.minValue(CANVAS_MIN), v.maxValue(CANVAS_MAX)),
  height: v.pipe(v.number(), v.integer(), v.minValue(CANVAS_MIN), v.maxValue(CANVAS_MAX)),
});
const themeRefSchema = v.strictObject({
  id: idString,
  version: v.pipe(v.number(), v.integer(), v.minValue(1)),
});
const viewportSchema = v.union([
  v.strictObject({ mode: v.literal('fit') }),
  v.strictObject({
    mode: v.literal('explicit'),
    originPx: v.strictObject({
      x: v.pipe(v.number(), v.finite(), v.minValue(-MAX_COORDINATE), v.maxValue(MAX_COORDINATE)),
      y: v.pipe(v.number(), v.finite(), v.minValue(-MAX_COORDINATE), v.maxValue(MAX_COORDINATE)),
    }),
    pixelsPerUnit: v.pipe(v.number(), v.finite(), v.gtValue(0), v.maxValue(MAX_SCALE)),
  }),
  v.strictObject({ mode: v.literal('stretch') }),
]);
const presentationSchema = v.strictObject({
  theme: themeRefSchema,
  canvas: canvasSchema,
  viewport: viewportSchema,
});
const documentSchema = v.strictObject({
  schemaVersion: v.literal(1),
  instanceId: idString,
  templateId: idString,
  templateVersion: v.pipe(v.number(), v.integer(), v.minValue(1)),
  unit: v.union([v.literal('dimensionless'), v.literal('si')]),
  params: v.looseObject({}), // validated per-capability
  presentation: presentationSchema,
});

// ---- api --------------------------------------------------------------------

export function createAuthoringApi(capabilities: readonly CapabilityDefinition[]): AuthoringApi {
  const byId = new Map<string, CapabilityDefinition[]>();
  for (const cap of capabilities) {
    const list = byId.get(cap.id) ?? [];
    list.push(cap);
    list.sort((a, b) => a.version - b.version);
    byId.set(cap.id, list);
  }
  const allIds = [...byId.keys()].sort();

  function lookupCapability(id: unknown, version: unknown): { cap: CapabilityDefinition } | { fail: Failure } {
    if (typeof id !== 'string') {
      return { fail: failure([err('missing-field', 'templateId', '缺少 templateId')], 'failed') };
    }
    const versions = byId.get(id);
    if (versions === undefined) {
      return {
        fail: failure([err('unknown-capability', 'templateId', `未注册的能力「${id}」`, {
          allowedValues: allIds,
          hint: '先调用 capabilities/listCapabilities 查看真实能力目录，不要猜测相似名字',
        })], 'failed'),
      };
    }
    if (typeof version !== 'number') {
      return { fail: failure([err('missing-field', 'templateVersion', '缺少 templateVersion')], 'failed') };
    }
    const cap = versions.find((c) => c.version === version);
    if (cap === undefined) {
      return {
        fail: failure([err('unknown-version', 'templateVersion', `能力「${id}」没有版本 ${version}`, {
          allowedValues: versions.map((c) => c.version),
        })], 'failed'),
      };
    }
    return { cap };
  }

  /** Structural + semantic validation; returns a fresh normalized document. */
  function normalizeDocument(raw: unknown): { doc: SceneDocument; cap: CapabilityDefinition } | { fail: Failure } {
    if (!isPlainObject(raw)) {
      return { fail: failure([err('invalid-type', 'document', 'document 必须是 JSON 对象')], 'failed') };
    }
    const parsed = parse(documentSchema as unknown as GenericSchema, raw);
    if (!parsed.ok) {
      const errors = parsed.issues.map((i) => {
        // specialize literal mismatches that carry semantic codes
        const path = issuePath(i);
        if (i.type === 'literal' && path === 'schemaVersion') {
          return err('unsupported-schema-version', 'document.schemaVersion',
            `仅支持 schemaVersion 1（收到 ${i.received}）`, { expected: '1' });
        }
        if (path === 'unit') {
          return err('unit-mismatch', 'document.unit',
            `unit 必须是已声明的单位标记（收到 ${i.received}）`, {
              allowedValues: ['dimensionless', 'si'],
            });
        }
        return mapIssue(i, 'document');
      });
      return { fail: failure(errors, 'failed') };
    }
    const input = parsed.output as SceneDocument;
    const capRes = lookupCapability(input.templateId, input.templateVersion);
    if ('fail' in capRes) return capRes;
    const cap = capRes.cap;

    if (input.unit !== cap.unit) {
      return {
        fail: failure([err('unit-mismatch', 'document.unit',
          `能力「${cap.id}@${cap.version}」要求 unit '${cap.unit}'（收到 '${input.unit}'）`, {
            expected: cap.unit,
          })], 'failed'),
      };
    }
    if (getTheme(input.presentation.theme.id, input.presentation.theme.version) === null) {
      return {
        fail: failure([err('unknown-theme', 'document.presentation.theme',
          `主题 ${input.presentation.theme.id}@${input.presentation.theme.version} 未注册`, {
            allowedValues: THEMES.map((t) => `${t.id}@${t.version}`),
            hint: '主题必须精确匹配已注册版本的 id 与 version',
          })], 'failed'),
      };
    }
    const params = input.params;
    if ('unit' in params) {
      return {
        fail: failure([err('unit-mismatch', 'document.params.unit',
          'params 不接受 unit 字段；单位由文档顶层 unit 声明')], 'failed'),
      };
    }
    const pParams = parse(cap.paramsSchema as GenericSchema, params);
    if (!pParams.ok) {
      return { fail: failure(pParams.issues.map((i) => mapIssue(i, 'document.params')), 'failed') };
    }
    // rebuild the document as a fresh plain object — nothing external is aliased
    const doc: SceneDocument = {
      schemaVersion: 1,
      instanceId: input.instanceId,
      templateId: input.templateId,
      templateVersion: input.templateVersion,
      unit: input.unit,
      params: JSON.parse(JSON.stringify(pParams.output)) as Record<string, unknown>,
      presentation: {
        theme: { ...input.presentation.theme },
        canvas: { ...input.presentation.canvas },
        viewport: input.presentation.viewport.mode === 'explicit'
          ? { mode: 'explicit', originPx: { ...input.presentation.viewport.originPx }, pixelsPerUnit: input.presentation.viewport.pixelsPerUnit }
          : { mode: input.presentation.viewport.mode },
      },
    };
    return { doc, cap };
  }

  function viewportFor(cap: CapabilityDefinition, doc: SceneDocument): Viewport {
    const pres = doc.presentation;
    if (pres.viewport.mode === 'explicit') {
      return { originPx: pres.viewport.originPx, pixelsPerUnit: pres.viewport.pixelsPerUnit };
    }
    const points = cap.fitPoints(doc.params, cap.derive(doc.params)) as Vec2[];
    const margin = getTheme(pres.theme.id, pres.theme.version)!.space.safeMargin;
    return pres.viewport.mode === 'stretch'
      ? stretchViewport(points, pres.canvas.width, pres.canvas.height, margin)
      : fitViewport(points, pres.canvas.width, pres.canvas.height, margin);
  }

  function successEnvelope(
    cap: CapabilityDefinition, doc: SceneDocument, defaultsApplied: readonly string[],
  ): SceneSuccess | Failure {
    if (cap.physicsCheck !== undefined) {
      const pErrors = cap.physicsCheck(doc.params);
      if (pErrors.length > 0) return failure(pErrors, 'passed', 'not_run', 'failed');
    }
    let derived: Record<string, unknown>;
    let warnings: string[] = [];
    try {
      derived = cap.derive(doc.params);
      cap.scene(doc.params, derived, doc.presentation); // prove buildability
      cap.fitPoints(doc.params, derived);
    } catch (e) {
      return failure([err('invalid-type', 'document.params',
        `参数计算失败：${e instanceof Error ? e.message : String(e)}`)], 'passed', 'failed',
        cap.physicsCheck === undefined ? 'not_applicable' : 'passed');
    }
    if (derived['length'] === 0) warnings = ['零向量：方向未定义（图中以零向量标记显示）'];
    warnings = [...warnings, ...(cap.warnings?.(doc.params, derived) ?? [])];
    return {
      ok: true,
      capability: { id: cap.id, version: cap.version },
      document: doc,
      documentHash: hashHex(canonicalJson(doc)),
      derived,
      summary: {
        unit: cap.unit,
        coordinates: cap.coordinates,
        assumptions: cap.assumptions,
        defaultsApplied,
      },
      checks: {
        structure: 'passed', math: 'passed',
        physics: cap.physicsCheck === undefined ? 'not_applicable' : 'passed',
        visual: 'not_run',
      },
      warnings,
    };
  }

  return {
    listCapabilities(req = {}): CapabilityListResult | Failure {
      const keyword = typeof req.keyword === 'string' ? req.keyword.toLowerCase() : null;
      const items = capabilities
        .filter((c) => c.available === true)
        .filter((c) => req.kind === undefined || c.kind === req.kind)
        .filter((c) => {
          if (keyword === null) return true;
          const hay = [c.title, c.summary, ...c.keywords.zh, ...c.keywords.en].join(' ').toLowerCase();
          return hay.includes(keyword);
        })
        .map((c) => ({
          id: c.id, version: c.version, title: c.title, summary: c.summary,
          kind: c.kind, available: c.available,
        }));
      return {
        ok: true, items, total: items.length,
        order: 'id asc, version asc',
        pagination: 'none (catalog ≤ 50 entries)',
      };
    },

    describeCapability(req) {
      const res = lookupCapability(req?.id, req?.version);
      if ('fail' in res) return res.fail;
      const cap = res.cap;
      return {
        ok: true,
        capability: {
          id: cap.id, version: cap.version, title: cap.title, summary: cap.summary,
          goodFor: cap.goodFor, notFor: cap.notFor, keywords: cap.keywords,
          kind: cap.kind, available: cap.available, outputs: cap.outputs,
          runtime: cap.runtime, unit: cap.unit, coordinates: cap.coordinates,
          assumptions: cap.assumptions,
          writable: cap.writable, derivedFields: cap.derivedFields,
          operations: cap.operations, constraints: cap.constraints,
          defaults: cap.defaults, examples: cap.examples,
          paramsJsonSchema: cap.paramsJsonSchema,
          documentJsonSchema: documentJsonSchema(cap),
          operationsJsonSchema: operationsJsonSchema(cap),
        },
      };
    },

    createScene(req) {
      const limited = guardRequest(req);
      if (limited) return limited;
      if (!isPlainObject(req)) {
        return failure([err('invalid-type', '', 'create 请求必须是对象')], 'failed');
      }
      const res = lookupCapability(req.templateId, req.templateVersion);
      if ('fail' in res) return res.fail;
      const cap = res.cap;
      if (!isPlainObject(req.params)) {
        return failure([err('missing-field', 'params', '缺少 params（必填字段见 describe 返回的 paramsJsonSchema）')], 'failed');
      }
      const pParams = parse(cap.paramsSchema as GenericSchema, req.params);
      if (!pParams.ok) {
        return failure(pParams.issues.map((i) => mapIssue(i, 'params')), 'failed');
      }
      // deep copy: never alias the caller's params
      const params = JSON.parse(JSON.stringify(pParams.output)) as Record<string, unknown>;
      const defaultsApplied: string[] = [];
      if (params['label'] === undefined && cap.defaults.label !== undefined) {
        params['label'] = cap.defaults.label;
        defaultsApplied.push('params.label');
      }
      // presentation: explicit override or capability default, per field
      const presIn = isPlainObject(req.presentation) ? req.presentation : {};
      const theme = presIn['theme'] !== undefined ? presIn['theme'] : cap.defaults.presentation.theme;
      const canvas = presIn['canvas'] !== undefined ? presIn['canvas'] : cap.defaults.presentation.canvas;
      const viewport = presIn['viewport'] !== undefined ? presIn['viewport'] : cap.defaults.presentation.viewport;
      for (const [k, used] of [['theme', theme], ['canvas', canvas], ['viewport', viewport]] as const) {
        if (used === cap.defaults.presentation[k as keyof typeof cap.defaults.presentation]) {
          defaultsApplied.push(`presentation.${k}`);
        }
      }
      const presParsed = parse(presentationSchema as unknown as GenericSchema, { theme, canvas, viewport });
      if (!presParsed.ok) {
        return failure(presParsed.issues.map((i) => mapIssue(i, 'presentation')), 'failed');
      }
      const presentation = presParsed.output as SceneDocument['presentation'];
      const themeDef = getTheme(presentation.theme.id, presentation.theme.version);
      if (themeDef === null) {
        return failure([err('unknown-theme', 'presentation.theme',
          `主题 ${presentation.theme.id}@${presentation.theme.version} 未注册`, {
            allowedValues: THEMES.map((t) => `${t.id}@${t.version}`),
            hint: '主题必须精确匹配已注册版本的 id 与 version',
          })], 'failed');
      }
      const instanceId = req.instanceId !== undefined ? req.instanceId : `${cap.id}-${hashHex(canonicalJson(params)).slice(0, 8)}`;
      const idCheck = parse(idString as unknown as GenericSchema, instanceId);
      if (!idCheck.ok) {
        return failure([err('invalid-type', 'instanceId', `instanceId 需匹配 ${ID_PATTERN}`)], 'failed');
      }
      const doc: SceneDocument = {
        schemaVersion: 1, instanceId: instanceId as string,
        templateId: cap.id, templateVersion: cap.version,
        unit: cap.unit, params, presentation,
      };
      return successEnvelope(cap, doc, defaultsApplied);
    },

    validateScene(req) {
      const limited = guardRequest(req);
      if (limited) return limited;
      const res = normalizeDocument(isPlainObject(req) ? req.document : undefined);
      if ('fail' in res) return res.fail;
      return successEnvelope(res.cap, res.doc, []);
    },

    updateScene(req) {
      const limited = guardRequest(req);
      if (limited) return limited;
      if (!isPlainObject(req) || !Array.isArray(req.operations)) {
        return failure([err('missing-field', 'operations', '缺少 operations 数组')], 'failed');
      }
      const res = normalizeDocument(req.document);
      if ('fail' in res) return res.fail;
      const { doc, cap } = res;
      const candidate: SceneDocument = JSON.parse(JSON.stringify(doc)) as SceneDocument;
      const errors: ApiError[] = [];
      for (const [idx, raw] of req.operations.entries()) {
        const opPath = `operations[${idx}]`;
        if (!isPlainObject(raw) || typeof raw.op !== 'string') {
          errors.push(err('invalid-operation', opPath, '操作必须是 { op, value } 对象', {
            allowedValues: cap.operations,
          }));
          continue;
        }
        const name = raw.op;
        const suffix = name.startsWith('set-') ? name.slice(4) : name;
        if (cap.derivedFields.includes(suffix)) {
          errors.push(err('readonly-field', `${opPath}.op`, `「${suffix}」是派生量，不能直接修改`, {
            hint: '该字段由输入参数派生；可写参数与可用操作见 describe 返回的 writable/operations',
          }));
          continue;
        }
        const apply = (schema: GenericSchema, write: (v0: unknown) => void) => {
          const r = parse(schema, raw.value);
          if (!r.ok) {
            for (const i of r.issues) errors.push(mapIssue(i, `${opPath}.value`));
          } else {
            write(r.output);
          }
        };
        const entries = (cap.paramsSchema as { entries?: Record<string, GenericSchema> }).entries ?? {};
        // 'set-<param>' writes a writable param and is validated by that
        // param's own schema slice — no per-capability branches here
        const writableField = cap.writable.includes(suffix) && suffix in entries ? suffix : null;
        switch (true) {
          case writableField !== null:
            apply(entries[writableField] as GenericSchema, (v0) => {
              const prev = candidate.params[writableField as string];
              // object params are patched field-wise: set-labels {a} keeps b/r;
              // scalar params and full objects (e.g. points) still validate whole
              candidate.params[writableField as string] =
                isPlainObject(prev) && isPlainObject(v0) ? { ...prev, ...v0 } : v0;
            });
            break;
          case name === 'set-theme': {
            const r = parse(themeRefSchema as unknown as GenericSchema, raw.value);
            if (!r.ok) {
              for (const i of r.issues) errors.push(mapIssue(i, `${opPath}.value`));
            } else {
              const t = r.output as { id: string; version: number };
              if (getTheme(t.id, t.version) === null) {
                errors.push(err('unknown-theme', `${opPath}.value`, `主题 ${t.id}@${t.version} 未注册`, {
                  allowedValues: THEMES.map((x) => `${x.id}@${x.version}`),
                }));
              } else {
                (candidate.presentation as { theme: unknown }).theme = t;
              }
            }
            break;
          }
          case name === 'set-canvas':
            apply(canvasSchema as unknown as GenericSchema,
              (v0) => { (candidate.presentation as { canvas: unknown }).canvas = v0; });
            break;
          case name === 'set-viewport':
            apply(viewportSchema as unknown as GenericSchema,
              (v0) => { (candidate.presentation as { viewport: unknown }).viewport = v0; });
            break;
          default:
            errors.push(err('invalid-operation', `${opPath}.op`, `未知操作「${name}」`, {
              allowedValues: cap.operations,
            }));
        }
      }
      if (errors.length > 0) return failure(errors, 'failed');
      const recheck = normalizeDocument(candidate);
      if ('fail' in recheck) return recheck.fail;
      return successEnvelope(cap, recheck.doc, []);
    },

    renderScene(req) {
      const limited = guardRequest(req);
      if (limited) return limited;
      const res = normalizeDocument(isPlainObject(req) ? req.document : undefined);
      if ('fail' in res) return res.fail;
      const { doc, cap } = res;
      const envelope = successEnvelope(cap, doc, []);
      if (!envelope.ok) return envelope;
      try {
        const theme = getTheme(doc.presentation.theme.id, doc.presentation.theme.version)!;
        const viewport = viewportFor(cap, doc);
        const svg = renderStandaloneSceneSvg({
          instanceId: doc.instanceId,
          title: cap.title,
          widthPx: doc.presentation.canvas.width,
          heightPx: doc.presentation.canvas.height,
          viewport,
          theme,
          items: cap.scene(doc.params, cap.derive(doc.params), doc.presentation),
        });
        const bytes = utf8Bytes(svg);
        return { ...envelope, svg, mimeType: 'image/svg+xml', bytes };
      } catch (e) {
        return failure([err('render-failed', 'document',
          `SVG 生成失败：${e instanceof Error ? e.message : String(e)}`)], 'passed', 'passed');
      }
    },
  };
}

function viewportJsonSchema(): Record<string, unknown> {
  return {
    oneOf: [
      { type: 'object', additionalProperties: false, required: ['mode'], properties: { mode: { const: 'fit' } } },
      { type: 'object', additionalProperties: false, required: ['mode', 'originPx', 'pixelsPerUnit'], properties: {
        mode: { const: 'explicit' },
        originPx: { type: 'object', additionalProperties: false, required: ['x', 'y'], properties: { x: { type: 'number' }, y: { type: 'number' } } },
        pixelsPerUnit: { type: 'number', exclusiveMinimum: 0, maximum: MAX_SCALE },
      } },
      { type: 'object', additionalProperties: false, required: ['mode'], properties: { mode: { const: 'stretch' } } },
    ],
  };
}

function documentJsonSchema(cap: CapabilityDefinition): Record<string, unknown> {
  return {
    type: 'object', additionalProperties: false,
    required: ['schemaVersion', 'instanceId', 'templateId', 'templateVersion', 'unit', 'params', 'presentation'],
    properties: {
      schemaVersion: { const: 1 },
      instanceId: { type: 'string', pattern: ID_PATTERN.source },
      templateId: { const: cap.id },
      templateVersion: { const: cap.version },
      unit: { const: cap.unit },
      params: cap.paramsJsonSchema,
      presentation: {
        type: 'object', additionalProperties: false,
        required: ['theme', 'canvas', 'viewport'],
        properties: {
          theme: { type: 'object', additionalProperties: false, required: ['id', 'version'], properties: { id: { type: 'string' }, version: { type: 'integer', minimum: 1 } } },
          canvas: { type: 'object', additionalProperties: false, required: ['width', 'height'], properties: { width: { type: 'integer', minimum: CANVAS_MIN, maximum: CANVAS_MAX }, height: { type: 'integer', minimum: CANVAS_MIN, maximum: CANVAS_MAX } } },
          viewport: viewportJsonSchema(),
        },
      },
    },
  };
}

function operationsJsonSchema(cap: CapabilityDefinition): Record<string, unknown> {
  const point = { type: 'object', additionalProperties: false, required: ['x', 'y'], properties: { x: { type: 'number' }, y: { type: 'number' } } };
  const shape = (op: string, value: Record<string, unknown>) => ({
    type: 'object', additionalProperties: false, required: ['op', 'value'],
    properties: { op: { const: op }, value },
  });
  const valueSchemas: Record<string, Record<string, unknown>> = {
    'set-start': point,
    'set-end': point,
    'set-label': { type: 'string', maxLength: 200 },
    'set-theme': { type: 'object', additionalProperties: false, required: ['id', 'version'], properties: { id: { type: 'string' }, version: { type: 'integer', minimum: 1 } } },
    'set-canvas': { type: 'object', additionalProperties: false, required: ['width', 'height'], properties: { width: { type: 'integer', minimum: CANVAS_MIN, maximum: CANVAS_MAX }, height: { type: 'integer', minimum: CANVAS_MIN, maximum: CANVAS_MAX } } },
    'set-viewport': viewportJsonSchema(),
  };
  const entries = (cap.paramsSchema as { entries?: Record<string, unknown> }).entries ?? {};
  const items = cap.operations
    .map((op) => {
      let value = valueSchemas[op];
      if (value === undefined && op.startsWith('set-')) {
        // set-<writable param> not listed above: derive the value schema from
        // the capability's own params schema slice — no per-op hand wiring
        const field = op.slice(4);
        if (cap.writable.includes(field) && field in entries) {
          const gen = toJsonSchema(entries[field] as v.GenericSchema, { errorMode: 'ignore' }) as Record<string, unknown>;
          const { $schema: _drop, ...rest } = gen;
          value = rest;
        }
      }
      return value === undefined ? undefined : shape(op, value);
    })
    .filter((s): s is ReturnType<typeof shape> => s !== undefined);
  return { type: 'array', items: { oneOf: items } };
}
