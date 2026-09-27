import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANDIDATE_ILLUSTRATED, CANDIDATE_LINEWORK, CANDIDATE_INSTRUMENT,
  CANDIDATE_THEMES, renderSceneSvg, vec2,
} from '../dist/index.js';

const view = { originPx: vec2(200, 150), pixelsPerUnit: 40 };
const base = (instanceId, theme = CANDIDATE_ILLUSTRATED, items = undefined) =>
  renderSceneSvg({
    instanceId, theme, widthPx: 400, heightPx: 300, viewport: view,
    title: '场景示意', items: items ?? [
      { kind: 'axes', id: 'ax', x: [-3, 3], y: [-2, 2], tick: 1, grid: true },
      { kind: 'arrow', id: 'a', role: 'input', from: vec2(-2, -1), to: vec2(1, 1.5), label: { text: 'A', anchor: 'end' }, handle: true, state: 'selected' },
      { kind: 'arrow', id: 'r', role: 'derived', from: vec2(0, 0), to: vec2(2, 1), state: 'readonly' },
      { kind: 'arrow', id: 'g', role: 'guide', from: vec2(1, 1.5), to: vec2(2, 1), dashed: true },
      { kind: 'point', id: 'o', role: 'component', at: vec2(0, 0), label: { text: 'O', anchor: 'mid' } },
      { kind: 'segment', id: 's', role: 'guide', from: vec2(-2, -1), to: vec2(0, 0), dashed: true },
      { kind: 'arrow', id: 'bad', role: 'input', from: vec2(0, 0), to: vec2(0.5, 0), state: 'error' },
    ],
  });

test('scene output is deterministic', () => {
  assert.equal(base('demo'), base('demo'));
});

test('all emitted ids are instance-prefixed and unique', () => {
  const svg = base('demo');
  const ids = [...svg.matchAll(/(?<![-\w])id="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length > 0);
  for (const id of ids) assert.ok(id.startsWith('demo-'), id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate emitted id');
});

test('every url(#...) reference resolves inside the same svg', () => {
  const svg = base('demo');
  const ids = new Set([...svg.matchAll(/(?<![-\w])id="([^"]+)"/g)].map((m) => m[1]));
  for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) {
    assert.ok(ids.has(m[1]), `dangling ref ${m[1]}`);
  }
});

test('two instances produce disjoint id sets', () => {
  const idsOf = (svg) => new Set([...svg.matchAll(/(?<![-\w])id="([^"]+)"/g)].map((m) => m[1]));
  const a = idsOf(base('left'));
  const b = idsOf(base('right'));
  for (const id of a) assert.ok(!b.has(id), id);
});

test('invalid instance/item ids and duplicates are rejected', () => {
  assert.throws(() => base('Bad Id'), RangeError);
  assert.throws(() => base('ok', CANDIDATE_ILLUSTRATED, [
    { kind: 'arrow', id: 'A', role: 'input', from: vec2(0, 0), to: vec2(1, 0) },
  ]), RangeError);
  assert.throws(() => base('ok', CANDIDATE_ILLUSTRATED, [
    { kind: 'arrow', id: 'x', role: 'input', from: vec2(0, 0), to: vec2(1, 0) },
    { kind: 'point', id: 'x', role: 'input', at: vec2(0, 0) },
  ]), RangeError);
});

test('label text is escaped, never interpreted as markup', () => {
  const svg = base('demo', CANDIDATE_ILLUSTRATED, [
    { kind: 'arrow', id: 'a', role: 'input', from: vec2(0, 0), to: vec2(1, 0), label: { text: '<script>x</script>', anchor: 'end' } },
  ]);
  assert.ok(svg.includes('&lt;script&gt;'));
  assert.ok(!svg.includes('<script'));
});

test('output never contains scripts, foreignObject or external hrefs', () => {
  const svg = base('demo');
  for (const banned of ['<script', 'foreignObject', 'href=']) {
    assert.ok(!svg.includes(banned), banned);
  }
});

test('zero vector renders a point marker with no direction', () => {
  const svg = base('demo', CANDIDATE_ILLUSTRATED, [
    { kind: 'arrow', id: 'z', role: 'input', from: vec2(1, 1), to: vec2(1, 1) },
  ]);
  assert.ok(svg.includes('pv-zero'));
  assert.ok(!svg.includes('<polygon'));
});

test('switching themes changes no geometry, only styling', () => {
  const items = [
    { kind: 'arrow', id: 'a', role: 'input', from: vec2(-2, -1), to: vec2(1, 1.5) },
    { kind: 'arrow', id: 'r', role: 'derived', from: vec2(0, 0), to: vec2(2, 1) },
  ];
  const geo = (svg) => {
    const out = {};
    for (const m of svg.matchAll(/data-item-id="([^"]+)">(.*?)<\/g>/gs)) {
      const line = /x1="([^"]+)" y1="([^"]+)"/.exec(m[2]);
      const poly = /points="([^"]+)"/.exec(m[2]);
      // shaft start and head tip are world geometry; the shaft end is the
      // arrowhead base and legitimately differs with per-theme headLength.
      out[m[1]] = { x1: line?.[1], y1: line?.[2], tip: poly?.[1].split(' ')[0] };
    }
    return out;
  };
  for (const theme of CANDIDATE_THEMES) {
    assert.deepEqual(
      geo(base('t', CANDIDATE_ILLUSTRATED, items)), geo(base('t', theme, items)),
      `geometry differs under ${theme.id}`,
    );
  }
});

test('glow material emits a namespaced filter; other materials do not', () => {
  const glow = base('g', CANDIDATE_INSTRUMENT);
  assert.match(glow, /id="g-glow"/);
  assert.match(glow, /filter="url\(#g-glow\)"/);
  for (const theme of [CANDIDATE_ILLUSTRATED, CANDIDATE_LINEWORK]) {
    const svg = base('g', theme);
    assert.ok(!svg.includes('pv-glow'), `${theme.id} must not emit glow markup`);
  }
});

test('glow theme adds minor grid lines at half tick; A/B unchanged', () => {
  const glow = base('g', CANDIDATE_INSTRUMENT);
  const majors = glow.match(/class="pv-gridline"/g)?.length ?? 0;
  const minors = glow.match(/pv-gridline-minor/g)?.length ?? 0;
  assert.ok(majors > 0 && minors > 0, 'both major and minor grid lines');
  for (const theme of [CANDIDATE_ILLUSTRATED, CANDIDATE_LINEWORK]) {
    assert.ok(!base('g', theme).includes('pv-gridline-minor'), `${theme.id} grid unchanged`);
  }
});

test('readonly items never get handles; handles carry state rings', () => {
  const svg = base('demo');
  const get = (id) => new RegExp(`data-item-id="${id}">(.*?)</g>`, 's').exec(svg)[1];
  assert.ok(!get('r').includes('pv-handle'), 'readonly must not have a handle');
  assert.ok(get('a').includes('pv-ring'), 'selected handle has a ring');
  const noHandle = base('demo', CANDIDATE_ILLUSTRATED, [
    { kind: 'arrow', id: 'h', role: 'input', from: vec2(0, 0), to: vec2(1, 0), handle: true, state: 'readonly' },
  ]);
  assert.ok(!noHandle.includes('pv-handle'));
});

test('overlong labels and bad states are rejected', () => {
  assert.throws(() => base('demo', CANDIDATE_ILLUSTRATED, [
    { kind: 'point', id: 'p', role: 'input', at: vec2(0, 0), label: { text: 'x'.repeat(201), anchor: 'mid' } },
  ]), RangeError);
  assert.throws(() => base('demo', CANDIDATE_ILLUSTRATED, [
    { kind: 'arrow', id: 'a', role: 'input', from: vec2(0, 0), to: vec2(1, 0), state: 'bogus' },
  ]), RangeError);
});
