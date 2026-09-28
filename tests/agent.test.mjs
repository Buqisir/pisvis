import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import { toJsonSchema } from '@valibot/to-json-schema';
import {
  authoring, createAuthoringApi, CAPABILITY_REGISTRY, arrowV1,
} from '../dist/agent.js';
import { renderStandaloneSceneSvg, SCENE_BASE_CSS, THEMES, DEFAULT_THEME } from '../dist/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CREATE = { templateId: 'arrow', templateVersion: 1, params: { start: { x: 0, y: 0 }, end: { x: 3, y: 4 } } };

const deepFreeze = (o) => {
  if (typeof o === 'object' && o !== null) { for (const k of Object.keys(o)) deepFreeze(o[k]); }
  return Object.freeze(o);
};
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---- the Issue's worked example ---------------------------------------------

test('issue example: create, update endpoint, label/presentation preserved', () => {
  const r = authoring.createScene(clone(CREATE));
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.deepEqual(r.derived.delta, { x: 3, y: 4 });
  assert.equal(r.derived.length, 5);
  assert.equal(r.derived.direction.degrees.toFixed(2), '53.13');
  assert.equal(r.document.unit, 'dimensionless');
  assert.equal(r.document.presentation.theme.id, DEFAULT_THEME.id);
  assert.equal(r.document.presentation.theme.version, DEFAULT_THEME.version);
  assert.match(r.document.instanceId, /^arrow-[0-9a-f]{8}$/);

  const frozen = deepFreeze(clone(r.document));
  const before = clone(r.document);
  const u = authoring.updateScene({
    document: frozen,
    operations: [{ op: 'set-end', value: { x: 0, y: 4 } }],
  });
  assert.ok(u.ok, JSON.stringify(u.errors));
  assert.equal(u.derived.length, 4);
  assert.equal(u.document.instanceId, r.document.instanceId);
  assert.equal(u.document.params.label, '向量');
  assert.deepEqual(u.document.presentation, r.document.presentation);
  assert.deepEqual(frozen, before, 'input document must not be mutated');
});

test('two documents from the same capability are independent', () => {
  const a = authoring.createScene(clone(CREATE));
  const b = authoring.createScene(clone(CREATE));
  const u = authoring.updateScene({ document: clone(a.document), operations: [{ op: 'set-label', value: 'r' }] });
  assert.equal(b.document.params.label, '向量');
  assert.equal(u.document.params.label, 'r');
});

test('zero vector: direction null, zero marker rendered', () => {
  const r = authoring.createScene({ templateId: 'arrow', templateVersion: 1, params: { start: { x: 1, y: 1 }, end: { x: 1, y: 1 } } });
  assert.ok(r.ok);
  assert.equal(r.derived.length, 0);
  assert.equal(r.derived.direction, null);
  const svg = authoring.renderScene({ document: r.document });
  assert.ok(svg.ok);
  assert.match(svg.svg, /pv-zero/);
});

test('coordinates outside the M1 drag range are valid and fit', () => {
  const r = authoring.createScene({ templateId: 'arrow', templateVersion: 1, params: { start: { x: 0, y: 0 }, end: { x: 100, y: -250 } } });
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.equal(r.derived.length, Math.hypot(100, -250));
  const bad = authoring.createScene({ templateId: 'arrow', templateVersion: 1, params: { start: { x: 0, y: 0 }, end: { x: 1e6 + 1, y: 0 } } });
  assert.equal(bad.ok, false);
  assert.equal(bad.errors[0].code, 'out-of-range');
  assert.equal(bad.errors[0].path, 'params.end.x');
});

// ---- error surface ------------------------------------------------------------

const errOf = (r) => (r.ok ? null : r.errors[0]);

test('error cases produce stable codes and paths, never a document', () => {
  const cases = [
    [{ templateId: 'arrow', templateVersion: 1, params: { start: { x: 0, y: 0 } } }, 'missing-field', 'params.end'],
    [{ templateId: 'arrow', templateVersion: 1, params: { start: { x: 0, y: 0 }, end: { x: Infinity, y: 0 } } }, 'non-finite', 'params.end.x'],
    [{ templateId: 'arrow', templateVersion: 1, params: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, label: 'x'.repeat(201) } }, 'label-too-long', 'params.label'],
    [{ templateId: 'nope', templateVersion: 1, params: {} }, 'unknown-capability', 'templateId'],
    [{ templateId: 'arrow', templateVersion: 99, params: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } }, 'unknown-version', 'templateVersion'],
  ];
  for (const [req, code, path] of cases) {
    const r = authoring.createScene(req);
    assert.equal(r.ok, false, `${code}`);
    const e = r.errors[0];
    assert.equal(e.code, code, `${path}: ${JSON.stringify(e)}`);
    assert.equal(e.path, path);
    assert.equal('document' in r, false);
  }
  // unknown version carries allowedValues
  const uv = authoring.createScene(cases[4][0]);
  assert.deepEqual(uv.errors[0].allowedValues, [1]);
});

test('document errors: schemaVersion, unknown field, unit, theme', () => {
  const base = clone(authoring.createScene(clone(CREATE)).document);
  const check = (mutate, code, pathPart) => {
    const doc = clone(base);
    mutate(doc);
    const r = authoring.validateScene({ document: doc });
    assert.equal(r.ok, false, code);
    const e = r.errors.find((x) => x.code === code);
    assert.ok(e, `${code}: ${JSON.stringify(r.errors)}`);
    assert.ok(e.path.includes(pathPart), `${e.path} ~ ${pathPart}`);
  };
  check((d) => { d.schemaVersion = 2; }, 'unsupported-schema-version', 'schemaVersion');
  check((d) => { d.extra = 1; }, 'unknown-field', 'document');
  check((d) => { d.unit = 'm'; }, 'unit-mismatch', 'unit');
  check((d) => { d.params.unit = 'm'; }, 'unit-mismatch', 'params.unit');
  check((d) => { d.presentation.theme = { id: 'illustrated', version: 1 }; }, 'unknown-theme', 'theme');
  // unknown-theme carries the registered id@version list so agents can self-correct
  const badTheme = authoring.validateScene({ document: (() => { const d = clone(base); d.presentation.theme = { id: 'neon', version: 9 }; return d; })() });
  assert.deepEqual(badTheme.errors[0].allowedValues, ['illustrated@2', 'linework@1']);
  check((d) => { d.params.surprise = 1; }, 'unknown-field', 'params');
});

test('updateScene: readonly-field, invalid-operation, all-or-nothing', () => {
  const doc = authoring.createScene(clone(CREATE)).document;
  const setLength = authoring.updateScene({ document: clone(doc), operations: [{ op: 'set-length', value: 9 }] });
  assert.equal(setLength.ok, false);
  assert.equal(setLength.errors[0].code, 'readonly-field');
  assert.ok(setLength.errors[0].hint && !/start|end/.test(setLength.errors[0].hint),
    'readonly hint is capability-generic, not arrow-specific');
  const badOp = authoring.updateScene({ document: clone(doc), operations: [{ op: 'explode', value: 1 }] });
  assert.equal(badOp.errors[0].code, 'invalid-operation');
  assert.ok(badOp.errors[0].allowedValues.includes('set-end'));
  // all-or-nothing: one bad op voids the good one too
  const mixed = authoring.updateScene({
    document: clone(doc),
    operations: [{ op: 'set-end', value: { x: 9, y: 9 } }, { op: 'set-end', value: { x: 1e9, y: 0 } }],
  });
  assert.equal(mixed.ok, false);
  assert.equal('document' in mixed, false);
});

test('limits: too-large, too-deep, prototype pollution safe', () => {
  const big = { templateId: 'arrow', templateVersion: 1, params: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, label: 'x'.repeat(262144) } };
  const r1 = authoring.createScene(big);
  assert.equal(r1.ok, false);
  assert.equal(r1.errors[0].code, 'too-large');
  let deep = { a: 1 };
  for (let i = 0; i < 17; i++) deep = { n: deep };
  const r2 = authoring.createScene({ templateId: 'arrow', templateVersion: 1, params: deep });
  assert.equal(r2.errors[0].code, 'too-deep');
  // __proto__ payload: strict objects reject unknown keys; document stays plain
  const polluted = JSON.parse('{"templateId":"arrow","templateVersion":1,"params":{"start":{"x":0,"y":0,"__proto__":{"evil":1}},"end":{"x":1,"y":1}}}');
  const r3 = authoring.createScene(polluted);
  assert.equal(r3.ok, false);
  assert.equal(r3.errors[0].code, 'unknown-field');
  assert.equal(({}).evil, undefined, 'prototype not polluted');
});

// ---- round trip + render ------------------------------------------------------

test('fully-degenerate origin scene still renders (tick spacing never 0)', () => {
  const r = authoring.createScene({ templateId: 'arrow', templateVersion: 1, params: { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } } });
  assert.ok(r.ok);
  const s = authoring.renderScene({ document: r.document });
  assert.ok(s.ok);
  assert.match(s.svg, /pv-zero/);
});

test('round trip: serialize -> parse -> validate -> same doc + hash', () => {
  const r = authoring.createScene(clone(CREATE));
  const text = JSON.stringify(r.document);
  const back = JSON.parse(text);
  const r2 = authoring.validateScene({ document: back });
  assert.ok(r2.ok);
  assert.deepEqual(r2.document, r.document);
  assert.equal(r2.documentHash, r.documentHash);
});

test('render twice gives identical svg; theme/canvas/viewport do not change derived', () => {
  const doc = authoring.createScene(clone(CREATE)).document;
  const s1 = authoring.renderScene({ document: clone(doc) });
  const s2 = authoring.renderScene({ document: clone(doc) });
  assert.equal(s1.svg, s2.svg);
  assert.equal(s1.mimeType, 'image/svg+xml');
  for (const ops of [
    [{ op: 'set-theme', value: { id: 'linework', version: 1 } }],
    [{ op: 'set-canvas', value: { width: 800, height: 600 } }],
    [{ op: 'set-viewport', value: { mode: 'explicit', originPx: { x: 320, y: 180 }, pixelsPerUnit: 40 } }],
  ]) {
    const u = authoring.updateScene({ document: clone(doc), operations: ops });
    assert.ok(u.ok, JSON.stringify(u.errors));
    assert.deepEqual(u.derived, s1.derived, 'derived unchanged by presentation ops');
    const s3 = authoring.renderScene({ document: u.document });
    assert.notEqual(s3.svg, s1.svg, 'svg changes with presentation');
  }
});

// ---- list / describe -----------------------------------------------------------

test('listCapabilities: short catalog, stable order, keyword filter', () => {
  const all = authoring.listCapabilities();
  assert.equal(all.total, 3);
  assert.deepEqual(all.items.map((i) => i.id), ['arrow', 'vector-add', 'vector-decompose']);
  assert.equal(authoring.listCapabilities({ keyword: '向量' }).total, 3);
  assert.equal(authoring.listCapabilities({ keyword: 'vector' }).total, 3);
  assert.equal(authoring.listCapabilities({ keyword: '分解' }).total, 1);
  assert.equal(authoring.listCapabilities({ keyword: '平抛' }).total, 0);
  assert.equal(authoring.listCapabilities({ kind: 'physics-template' }).total, 0);
});

test('describeCapability returns schemas, constraints and runnable examples', () => {
  const d = authoring.describeCapability({ id: 'arrow', version: 1 });
  assert.ok(d.ok);
  const c = d.capability;
  assert.equal(c.paramsJsonSchema.type, 'object');
  assert.deepEqual(c.paramsJsonSchema.required, ['start', 'end']);
  assert.equal(c.paramsJsonSchema.additionalProperties, false);
  assert.ok(Array.isArray(c.constraints) && c.constraints.length > 0);
  assert.ok(c.documentJsonSchema.properties.params);
  assert.ok(c.operationsJsonSchema.items.oneOf.length >= 6);
  // examples are real: minimal passes create, failure hits its code
  assert.ok(authoring.createScene(clone(c.examples.minimal)).ok);
  const uv = authoring.updateScene(clone(c.examples.variant));
  assert.ok(uv.ok, 'examples.variant is a runnable update request');
  assert.equal(uv.derived.length, 4);
  const f = authoring.createScene(clone(c.examples.failure.request));
  assert.equal(f.ok, false);
  assert.equal(f.errors[0].code, c.examples.failure.expectedCode);
  const missing = authoring.describeCapability({ id: 'arrow' });
  assert.equal(missing.errors[0].code, 'missing-field');
  const unk = authoring.describeCapability({ id: 'nope', version: 1 });
  assert.equal(unk.errors[0].code, 'unknown-capability');
  assert.deepEqual(unk.errors[0].allowedValues, ['arrow', 'vector-add', 'vector-decompose']);
});

test('registry extensibility: a test-only capability flows through unchanged', () => {
  const pointSchema = v.strictObject({
    at: v.strictObject({ x: v.pipe(v.number(), v.finite()), y: v.pipe(v.number(), v.finite()) }),
  });
  const testCap = {
    id: 'test-dot', version: 1, title: '测试点', summary: '测试用',
    goodFor: [], notFor: [], keywords: { zh: ['测试点'], en: ['testdot'] },
    kind: 'math-diagram', available: true,
    outputs: ['scene-json', 'svg', 'report'],
    runtime: 'test', unit: 'dimensionless',
    coordinates: 'x 右 y 上', assumptions: ['无量纲数学示意，不能据此保证受力分析正确'],
    paramsSchema: pointSchema,
    paramsJsonSchema: toJsonSchema(pointSchema, { errorMode: 'ignore' }),
    writable: ['at'], derivedFields: ['diag'], operations: ['set-at'],
    constraints: ['test'], defaults: { presentation: arrowV1.defaults.presentation },
    examples: { minimal: {}, variant: {}, failure: { request: {}, expectedCode: 'invalid-type', fix: 'x' } },
    derive: (p) => ({ diag: Math.hypot(p.at.x, p.at.y) }),
    scene: (p) => [{ kind: 'point', id: 'p', role: 'input', at: p.at }],
    fitPoints: (p) => [p.at, { x: 0, y: 0 }],
  };
  const api = createAuthoringApi([testCap]);
  assert.equal(api.listCapabilities().total, 1);
  assert.ok(api.describeCapability({ id: 'test-dot', version: 1 }).ok);
  const c = api.createScene({ templateId: 'test-dot', templateVersion: 1, params: { at: { x: 3, y: 4 } } });
  assert.ok(c.ok);
  assert.equal(c.derived.diag, 5);
  const u = api.updateScene({ document: c.document, operations: [{ op: 'set-at', value: { x: 0, y: 1 } }] });
  assert.ok(u.ok);
  assert.equal(u.derived.diag, 1);
  const s = api.renderScene({ document: u.document });
  assert.ok(s.ok);
  assert.match(s.svg, /pv-dot/);
  // production registry never contains the test capability
  assert.equal(authoring.describeCapability({ id: 'test-dot', version: 1 }).ok, false);
});

// ---- M2 capabilities: vector-add / vector-decompose ----------------------------

const CREATE_ADD = {
  templateId: 'vector-add', templateVersion: 1,
  params: { a: { x: 2, y: 1 }, b: { x: 0.5, y: 1.8 } },
};
const CREATE_DEC = {
  templateId: 'vector-decompose', templateVersion: 1,
  params: { v: { x: 2.4, y: 1.6 } },
};

test('vector-add: create/derive/update/validate/render happy path', () => {
  const r = authoring.createScene(clone(CREATE_ADD));
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.deepEqual(r.derived.r, { x: 2.5, y: 2.8 });
  assert.equal(r.derived.rLength, Math.hypot(2.5, 2.8));
  assert.equal(r.derived.rDirection.degrees.toFixed(2), '48.24');
  assert.equal(r.document.unit, 'dimensionless');
  assert.equal(r.checks.physics, 'not_applicable');

  const u = authoring.updateScene({
    document: clone(r.document),
    operations: [{ op: 'set-b', value: { x: -1, y: 0.5 } }],
  });
  assert.ok(u.ok, JSON.stringify(u.errors));
  assert.deepEqual(u.derived.r, { x: 1, y: 1.5 });
  assert.equal(u.document.instanceId, r.document.instanceId);

  const back = authoring.validateScene({ document: JSON.parse(JSON.stringify(u.document)) });
  assert.ok(back.ok);
  assert.equal(back.documentHash, u.documentHash);

  const s = authoring.renderScene({ document: clone(u.document) });
  assert.ok(s.ok);
  assert.ok(s.svg.length > 0);
  for (const frag of ['pv-role-input', 'pv-role-guide', 'pv-role-derived', 'pv-state-readonly', 'pv-seg', 'pv-dot']) {
    assert.ok(s.svg.includes(frag), `svg contains ${frag}`);
  }
  for (const text of ['>A<', '>B<', '>B′<', '>R<', '>O<']) {
    assert.ok(s.svg.includes(text), `svg contains label ${text}`);
  }
});

test('vector-add: labels override and set-labels merges (keeps unset keys)', () => {
  const r = authoring.createScene({
    templateId: 'vector-add', templateVersion: 1,
    params: { a: { x: 1, y: 0 }, b: { x: 0, y: 1 }, labels: { a: 'α', b: 'β', r: 'ρ' } },
  });
  assert.ok(r.ok);
  const u = authoring.updateScene({
    document: clone(r.document),
    operations: [{ op: 'set-labels', value: { a: 'α2' } }],
  });
  assert.ok(u.ok, JSON.stringify(u.errors));
  assert.deepEqual(u.document.params.labels, { a: 'α2', b: 'β', r: 'ρ' }, 'b/r labels preserved');
  const s = authoring.renderScene({ document: clone(u.document) });
  for (const text of ['>α2<', '>β<', '>ρ<']) assert.ok(s.svg.includes(text), text);
  // label-less doc: set-labels {a} leaves b/r defaults visible
  const r2 = authoring.createScene(clone(CREATE_ADD));
  const u2 = authoring.updateScene({
    document: clone(r2.document),
    operations: [{ op: 'set-labels', value: { a: 'α' } }],
  });
  assert.ok(u2.ok);
  assert.deepEqual(u2.document.params.labels, { a: 'α' });
  const s2 = authoring.renderScene({ document: clone(u2.document) });
  for (const text of ['>α<', '>B<', '>R<']) assert.ok(s2.svg.includes(text), text);
});

test('vector-add: derived fields are readonly with capability-generic hint', () => {
  const doc = authoring.createScene(clone(CREATE_ADD)).document;
  for (const op of ['set-r', 'set-rLength', 'set-rDirection']) {
    const u = authoring.updateScene({ document: clone(doc), operations: [{ op, value: { x: 0, y: 0 } }] });
    assert.equal(u.ok, false, op);
    assert.equal(u.errors[0].code, 'readonly-field');
    assert.ok(!/start|end/.test(u.errors[0].hint ?? ''), `${op} hint must not mention start/end`);
  }
});

test('vector-add: degenerate sums still render', () => {
  const cases = [
    { a: { x: 1, y: 1 }, b: { x: -1, y: -1 } },   // r = 0 → zero marker
    { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } },     // everything at origin
    { a: { x: 0, y: 0 }, b: { x: 1, y: 2 } },     // a is zero vector
  ];
  for (const params of cases) {
    const c = authoring.createScene({ templateId: 'vector-add', templateVersion: 1, params });
    assert.ok(c.ok, JSON.stringify(c.errors));
    const s = authoring.renderScene({ document: c.document });
    assert.ok(s.ok, JSON.stringify(params));
    assert.ok(s.svg.length > 0);
  }
  const zero = authoring.createScene({ templateId: 'vector-add', templateVersion: 1, params: cases[0] });
  assert.equal(zero.derived.rLength, 0);
  assert.equal(zero.derived.rDirection, null);
  assert.match(authoring.renderScene({ document: zero.document }).svg, /pv-zero/);
});

test('vector-decompose: create/derive/update/validate/render happy path', () => {
  const r = authoring.createScene(clone(CREATE_DEC));
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.deepEqual(r.derived.vx, { x: 2.4, y: 0 });
  assert.deepEqual(r.derived.vy, { x: 0, y: 1.6 });
  assert.equal(r.derived.length, Math.hypot(2.4, 1.6));
  assert.equal(r.derived.direction.degrees.toFixed(2), '33.69');
  assert.equal(r.document.params.label, 'V', 'defaults.label applied');

  const u = authoring.updateScene({
    document: clone(r.document),
    operations: [{ op: 'set-v', value: { x: -1.5, y: 2 } }, { op: 'set-label', value: 'F' }],
  });
  assert.ok(u.ok, JSON.stringify(u.errors));
  assert.deepEqual(u.derived.vx, { x: -1.5, y: 0 });
  assert.deepEqual(u.derived.vy, { x: 0, y: 2 });
  assert.equal(u.document.params.label, 'F');

  const s = authoring.renderScene({ document: clone(u.document) });
  assert.ok(s.ok);
  for (const text of ['>F<', '>Vx<', '>Vy<', '>O<']) {
    assert.ok(s.svg.includes(text), `svg contains ${text}`);
  }
});

test('vector-decompose: vx/vy/length/direction are readonly', () => {
  const doc = authoring.createScene(clone(CREATE_DEC)).document;
  const u = authoring.updateScene({ document: clone(doc), operations: [{ op: 'set-vx', value: { x: 0, y: 0 } }] });
  assert.equal(u.ok, false);
  assert.equal(u.errors[0].code, 'readonly-field');
  assert.ok(!/start|end/.test(u.errors[0].hint ?? ''));
});

test('vector-decompose: on-axis and zero vectors still render', () => {
  for (const v of [{ x: 3, y: 0 }, { x: 0, y: -2 }, { x: 0, y: 0 }]) {
    const c = authoring.createScene({ templateId: 'vector-decompose', templateVersion: 1, params: { v } });
    assert.ok(c.ok, JSON.stringify(c.errors));
    const s = authoring.renderScene({ document: c.document });
    assert.ok(s.ok, JSON.stringify(v));
    assert.ok(s.svg.length > 0);
  }
  const zero = authoring.createScene({ templateId: 'vector-decompose', templateVersion: 1, params: { v: { x: 0, y: 0 } } });
  assert.equal(zero.derived.direction, null);
  assert.match(authoring.renderScene({ document: zero.document }).svg, /pv-zero/);
});

test('new capabilities describe: schemas and examples are runnable', () => {
  for (const id of ['vector-add', 'vector-decompose']) {
    const d = authoring.describeCapability({ id, version: 1 });
    assert.ok(d.ok, id);
    const c = d.capability;
    assert.equal(c.paramsJsonSchema.type, 'object');
    assert.equal(c.paramsJsonSchema.additionalProperties, false);
    const opNames = c.operationsJsonSchema.items.oneOf.map((s) => s.properties.op.const);
    assert.deepEqual(opNames, c.operations, `${id}: every declared op has a schema`);
    // examples are real: minimal passes create, variant is a runnable update,
    // failure hits its declared code
    assert.ok(authoring.createScene(clone(c.examples.minimal)).ok, `${id} minimal`);
    const uv = authoring.updateScene(clone(c.examples.variant));
    assert.ok(uv.ok, `${id} variant: ${JSON.stringify(uv.errors)}`);
    const f = authoring.createScene(clone(c.examples.failure.request));
    assert.equal(f.ok, false);
    assert.equal(f.errors[0].code, c.examples.failure.expectedCode);
  }
  const add = authoring.describeCapability({ id: 'vector-add', version: 1 }).capability;
  assert.deepEqual(add.paramsJsonSchema.required, ['a', 'b']);
  assert.equal(add.operationsJsonSchema.items.oneOf.length, 6);
  const dec = authoring.describeCapability({ id: 'vector-decompose', version: 1 }).capability;
  assert.deepEqual(dec.paramsJsonSchema.required, ['v']);
  assert.equal(dec.operationsJsonSchema.items.oneOf.length, 5);
});

// ---- import graph purity --------------------------------------------------------

function importGraph(entry) {
  const seen = new Set();
  const bare = new Set();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const m of readFileSync(file, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g)) {
      const spec = m[1] ?? m[2];
      if (spec.startsWith('.')) queue.push(join(dirname(file), spec));
      else bare.add(spec);
    }
  }
  return bare;
}

test('root entry stays zero-dependency: no valibot, no node:, no MCP', () => {
  const bare = importGraph(join(ROOT, 'dist/index.js'));
  for (const spec of bare) {
    assert.ok(!spec.includes('valibot'), `root imports ${spec}`);
    assert.ok(!spec.startsWith('node:'), `root imports ${spec}`);
    assert.ok(!spec.includes('modelcontextprotocol'), `root imports ${spec}`);
  }
});

test('./agent entry has no node: imports and no MCP (browser-usable)', async () => {
  const bare = importGraph(join(ROOT, 'dist/agent.js'));
  for (const spec of bare) {
    assert.ok(!spec.startsWith('node:'), spec);
    assert.ok(!spec.includes('modelcontextprotocol'), `agent imports ${spec}`);
  }
  const mod = await import('../dist/agent.js');
  assert.equal(typeof mod.authoring.createScene, 'function');
});

// ---- standalone svg -------------------------------------------------------------

test('standalone svg is self-styled and deterministic, no external refs', () => {
  const doc = authoring.createScene(clone(CREATE)).document;
  const s = authoring.renderScene({ document: doc });
  assert.match(s.svg, /data-pv-theme="illustrated"/);
  assert.match(s.svg, /<style>/);
  assert.ok(!s.svg.includes('<script'));
  assert.ok(!s.svg.includes('foreignObject'));
  assert.ok(!s.svg.includes('href'));
  assert.ok(!/url\((?!#)/.test(s.svg), 'no external url() refs');
});

test('SCENE_BASE_CSS is embeddable (no < or &)', () => {
  assert.ok(!SCENE_BASE_CSS.includes('<') && !SCENE_BASE_CSS.includes('&'));
});
