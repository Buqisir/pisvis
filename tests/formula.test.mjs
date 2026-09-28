import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFormulas, renderFormula, renderAll } from '../dist/formula/index.js';
import { flightRange, flightTime, landingSpeed, stateAt } from '../dist/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIX = { h: 20, u: 10, g: 10, t: 1 };
const IDS = ['x-t', 'y-t', 'vx', 'vy', 'speed', 'T', 'R', 'landing-speed', 'traj', 'tan-alpha'];

const sig6 = (n) => String(Number(n.toPrecision(6)));

// ---- catalog -------------------------------------------------------------------

test('listFormulas returns all registered ids in stable order with zh names', () => {
  const list = listFormulas();
  assert.deepEqual(list.map((f) => f.id), IDS);
  for (const f of list) assert.ok(f.name.length > 0, f.id);
  // defensive copy: mutating the returned array must not corrupt the registry
  list.push({ id: 'x', name: 'x' });
  assert.equal(listFormulas().length, IDS.length);
});

// ---- happy path: substitution matches the physics model -------------------------

test('every registered id renders ok for the issue fixture h=20 u=10 g=10 t=1', () => {
  for (const id of IDS) {
    const r = renderFormula(id, FIX);
    assert.ok(r.ok, `${id}: ${JSON.stringify(r.errors)}`);
    assert.equal(r.id, id);
    assert.ok(r.tex.length > 0 && r.html.includes('class="katex"'), id);
  }
});

test('rendered tex carries the substituted numbers and the model-computed result', () => {
  const cases = [
    ['x-t', '10 \\times 1', `= ${sig6(10 * 1)}\\ \\mathrm{m}`],
    ['y-t', '20', `= ${sig6(20 - 10 / 2)}\\ \\mathrm{m}`],
    ['vx', '10', `= 10\\ \\mathrm{m/s}`],
    ['vy', '-10 \\times 1', `= -10\\ \\mathrm{m/s}`],
    ['speed', '10^{2}', `\\approx ${sig6(stateAt(FIX).speed)}\\ \\mathrm{m/s}`],
    ['T', '2 \\times 20', `= ${sig6(flightTime(20, 10))}\\ \\mathrm{s}`],
    ['R', '10 \\times 2', `= ${sig6(flightRange(10, 20, 10))}\\ \\mathrm{m}`],
    ['landing-speed', '2 \\times 10 \\times 20', `\\approx ${sig6(landingSpeed(10, 20, 10))}\\ \\mathrm{m/s}`],
    ['traj', '20', '- 0.05x^{2}'],
    ['tan-alpha', '\\tfrac{10 \\times 1}{10}', '= 45^{\\circ}'],
  ];
  for (const [id, sub, result] of cases) {
    const r = renderFormula(id, FIX);
    assert.ok(r.ok, id);
    assert.ok(r.tex.includes(sub), `${id} tex missing substitution ${sub}: ${r.tex}`);
    assert.ok(r.tex.includes(result), `${id} tex missing result ${result}: ${r.tex}`);
  }
});

test('display option switches KaTeX displayMode', () => {
  const inline = renderFormula('T', FIX);
  const block = renderFormula('T', FIX, { display: true });
  assert.ok(block.ok && block.html.includes('katex-display'));
  assert.ok(inline.ok && !inline.html.includes('katex-display'));
});

test('renderAll maps ids to per-id results in order', () => {
  const rs = renderAll(IDS, FIX);
  assert.equal(rs.length, IDS.length);
  rs.forEach((r, i) => {
    assert.equal(r.id, IDS[i]);
    assert.ok(r.ok, `${IDS[i]}: ${JSON.stringify(r.errors)}`);
  });
  assert.equal(renderAll(['nope'], FIX)[0].errors[0].code, 'unknown-formula');
});

// ---- degenerate + error surface --------------------------------------------------

test('u=0 free-fall: traj and tan-alpha are not-applicable, rest still render', () => {
  const v = { ...FIX, u: 0 };
  for (const id of ['traj', 'tan-alpha']) {
    const r = renderFormula(id, v);
    assert.equal(r.ok, false, id);
    assert.equal(r.errors[0].code, 'not-applicable');
    assert.equal('tex' in r, false);
  }
  for (const id of IDS.filter((i) => !['traj', 'tan-alpha'].includes(i))) {
    assert.ok(renderFormula(id, v).ok, id);
  }
});

test('unknown id is a structured error, never a render', () => {
  const r = renderFormula('not-a-formula', FIX);
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].code, 'unknown-formula');
  assert.equal('html' in r, false);
});

test('missing / non-finite / non-number values are bad-value with the key', () => {
  for (const bad of [{ u: undefined }, { u: NaN }, { u: Infinity }, { u: -Infinity }, { u: '10' }, { u: null }]) {
    const r = renderFormula('x-t', { ...FIX, ...bad });
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.equal(r.errors[0].code, 'bad-value');
    assert.equal(r.errors[0].key, 'u');
  }
  assert.equal(renderFormula('x-t', { t: 1 }).errors[0].key, 'u');
  const r = renderFormula('x-t', { u: 10 });
  assert.equal(r.errors[0].code, 'bad-value');
  assert.equal(r.errors[0].key, 't');
  // values that are not an object at all
  assert.equal(renderFormula('x-t', null).errors[0].code, 'bad-value');
  assert.equal(renderFormula('x-t', 42).errors[0].code, 'bad-value');
});

test('domain guards: g=0 cannot divide in T/R; overflow never prints Infinity', () => {
  for (const id of ['T', 'R']) {
    const r = renderFormula(id, { h: 20, u: 10, g: 0, t: 1 });
    assert.equal(r.ok, false, id);
    assert.equal(r.errors[0].code, 'not-applicable');
  }
  const r = renderFormula('landing-speed', { h: 1e200, u: 1e200, g: 1e200, t: 1 });
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].code, 'bad-value');
  // extra unrelated keys in the values bag are ignored
  assert.ok(renderFormula('x-t', { ...FIX, __proto_evil: 1, junk: '<img>' }).ok);
});

// ---- output discipline ------------------------------------------------------------

test('two calls produce identical tex and html (deterministic, per-call isolation)', () => {
  const a = renderFormula('speed', FIX);
  const b = renderFormula('speed', FIX, { display: true });
  const c = renderFormula('speed', FIX);
  assert.equal(a.html, c.html);
  assert.equal(a.tex, c.tex);
  assert.notEqual(a.html, b.html); // display flag does not leak across calls
});

test('rendered html has no href=/javascript:/script injection surface', () => {
  for (const id of IDS) {
    const r = renderFormula(id, FIX);
    assert.ok(r.ok, id);
    for (const bad of ['href=', 'javascript:', '<script', 'src=']) {
      assert.ok(!r.html.includes(bad), `${id} html contains ${bad}`);
    }
  }
});

// ---- package boundary --------------------------------------------------------------

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

test('katex stays inside the formula adapter: root/agent entries never import it', () => {
  assert.ok(importGraph(join(ROOT, 'dist/formula/index.js')).has('katex'), 'adapter is the katex consumer');
  for (const entry of ['dist/index.js', 'dist/agent.js']) {
    for (const spec of importGraph(join(ROOT, entry))) {
      assert.ok(!spec.includes('katex'), `${entry} imports ${spec}`);
    }
  }
});
