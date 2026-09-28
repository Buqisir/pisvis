import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, symlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'dist/cli/pisvis.js');
const CREATE = { templateId: 'arrow', templateVersion: 1, params: { start: { x: 0, y: 0 }, end: { x: 3, y: 4 } } };

/** Spawn the CLI; stdout must always parse as one JSON result (or be help text). */
function run(args, { stdin, cwd } = {}) {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      input: stdin, cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e) {
    return { code: e.status, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}
const asJson = (r) => JSON.parse(r.stdout);

test('--help exits 0 with human text', () => {
  const r = run(['--help']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /capabilities/);
});

test('unknown command exits 2 with a JSON usage-error on stdout', () => {
  const r = run(['frobnicate']);
  assert.equal(r.code, 2);
  const j = asJson(r);
  assert.equal(j.ok, false);
  assert.equal(j.errors[0].code, 'usage-error');
});

test('capabilities lists the whole registry in stable order', () => {
  const j = asJson(run(['capabilities']));
  assert.equal(j.total, 5);
  assert.deepEqual(j.items.map((i) => i.id),
    ['arrow', 'horizontal-projectile', 'projectile-speed-graph', 'vector-add', 'vector-decompose']);
});

test('create/validate/update via file and via stdin', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pisvis-cli-'));
  const inFile = join(dir, 'create in.json'); // path with a space
  writeFileSync(inFile, JSON.stringify(CREATE));

  const created = asJson(run(['create', '--input', inFile]));
  assert.equal(created.ok, true);
  assert.equal(created.derived.length, 5);

  const viaStdin = asJson(run(['create', '--input', '-'], { stdin: JSON.stringify(CREATE) }));
  assert.equal(viaStdin.document.instanceId, created.document.instanceId);

  const docFile = join(dir, 'doc.json');
  writeFileSync(docFile, JSON.stringify({ document: created.document }));
  const valid = asJson(run(['validate', '--input', docFile]));
  assert.equal(valid.ok, true);

  const updFile = join(dir, 'upd.json');
  writeFileSync(updFile, JSON.stringify({
    document: created.document,
    operations: [{ op: 'set-end', value: { x: 0, y: 4 } }],
  }));
  const updated = asJson(run(['update', '--input', updFile]));
  assert.equal(updated.derived.length, 4);
});

test('missing --input is a usage error, never a hang', () => {
  const r = run(['create']);
  assert.equal(r.code, 2);
  assert.equal(asJson(r).errors[0].code, 'usage-error');
});

test('render writes 3 files; no overwrite by default; --overwrite works', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pisvis out dir '));
  const doc = asJson(run(['create', '--input', '-'], { stdin: JSON.stringify(CREATE) }));
  writeFileSync(join(dir, 'doc.json'), JSON.stringify({ document: doc.document }));
  const first = run(['render', '--input', join(dir, 'doc.json'), '--out-dir', dir]);
  assert.equal(first.code, 0, first.stdout);
  const name = doc.document.instanceId;
  for (const ext of ['.scene.json', '.svg', '.report.json']) {
    assert.ok(existsSync(join(dir, name + ext)), ext);
  }
  const report = JSON.parse(readFileSync(join(dir, `${name}.report.json`), 'utf8'));
  assert.ok(!('svg' in report), 'report carries no svg body');
  const svgBefore = readFileSync(join(dir, `${name}.svg`), 'utf8');
  const again = run(['render', '--input', join(dir, 'doc.json'), '--out-dir', dir]);
  assert.equal(again.code, 3);
  assert.equal(asJson(again).errors[0].code, 'io-error');
  assert.equal(readFileSync(join(dir, `${name}.svg`), 'utf8'), svgBefore, 'existing file untouched');
  const over = run(['render', '--input', join(dir, 'doc.json'), '--out-dir', dir, '--overwrite']);
  assert.equal(over.code, 0);
});

test('render refuses missing out-dir, bad --name, symlink targets', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pisvis-cli-'));
  const doc = asJson(run(['create', '--input', '-'], { stdin: JSON.stringify(CREATE) }));
  writeFileSync(join(dir, 'doc.json'), JSON.stringify({ document: doc.document }));
  const noDir = run(['render', '--input', join(dir, 'doc.json'), '--out-dir', join(dir, 'nope')]);
  assert.equal(noDir.code, 3);
  const trav = run(['render', '--input', join(dir, 'doc.json'), '--out-dir', dir, '--name', '../x']);
  assert.equal(trav.code, 2);
  // symlink refusal
  const target = join(dir, 'victim.scene.json');
  writeFileSync(target, 'original');
  symlinkSync(target, join(dir, `${doc.document.instanceId}.scene.json`));
  const sym = run(['render', '--input', join(dir, 'doc.json'), '--out-dir', dir]);
  assert.equal(sym.code, 3);
  assert.equal(readFileSync(target, 'utf8'), 'original');
});

test('stdin over 256 KiB aborts with too-large, never buffers unbounded', () => {
  const payload = '{"templateId":"arrow","templateVersion":1,"params":{"start":{"x":0,"y":0},"end":{"x":1,"y":1},"label":"' + 'x'.repeat(262145) + '"}}';
  const r = run(['create', '--input', '-'], { stdin: payload });
  assert.equal(r.code, 1);
  assert.equal(asJson(r).errors[0].code, 'too-large');
});

test('failed overwrite keeps the previous artifacts byte-identical', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pisvis-cli-'));
  const doc = asJson(run(['create', '--input', '-'], { stdin: JSON.stringify(CREATE) }));
  writeFileSync(join(dir, 'doc.json'), JSON.stringify({ document: doc.document }));
  const name = doc.document.instanceId;
  assert.equal(run(['render', '--input', join(dir, 'doc.json'), '--out-dir', dir]).code, 0);
  const before = Object.fromEntries(['.scene.json', '.svg', '.report.json']
    .map((e) => [e, readFileSync(join(dir, name + e), 'utf8')]));
  // make the out-dir unwritable so the temp write fails mid-phase (b)
  chmodSync(dir, 0o555);
  const r = run(['render', '--input', join(dir, 'doc.json'), '--out-dir', dir, '--overwrite']);
  chmodSync(dir, 0o755);
  assert.equal(r.code, 3);
  assert.equal(asJson(r).errors[0].code, 'io-error');
  for (const [e, text] of Object.entries(before)) {
    assert.equal(readFileSync(join(dir, name + e), 'utf8'), text, `${e} unchanged`);
  }
  assert.equal(readdirSync(dir).filter((f) => f.endsWith('.tmp')).length, 0, 'no temps left');
});

test('oversized input rejected before read; invalid JSON is domain failure', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pisvis-cli-'));
  const big = join(dir, 'big.json');
  writeFileSync(big, JSON.stringify({ templateId: 'arrow', templateVersion: 1, params: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, label: 'x'.repeat(262200) } }));
  const r = run(['create', '--input', big]);
  assert.equal(r.code, 1);
  assert.equal(asJson(r).errors[0].code, 'too-large');
  const r2 = run(['validate', '--input', '-'], { stdin: '{broken' });
  assert.equal(r2.code, 1);
  assert.equal(asJson(r2).errors[0].code, 'invalid-json');
  // 1e999 parses to Infinity → non-finite
  const r3 = run(['create', '--input', '-'], {
    stdin: '{"templateId":"arrow","templateVersion":1,"params":{"start":{"x":0,"y":0},"end":{"x":1e999,"y":0}}}',
  });
  assert.equal(r3.code, 1);
  assert.equal(asJson(r3).errors[0].code, 'non-finite');
});

test('stderr never leaks into stdout', () => {
  for (const args of [['capabilities'], ['bogus'], ['create', '--input', '-']]) {
    const r = run(args, { stdin: '{}' });
    if (args[0] === 'capabilities' || r.stdout.trim().startsWith('{')) {
      asJson(r); // parses
    }
  }
});
