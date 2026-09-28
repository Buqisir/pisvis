import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from 'valibot';
import { projectileSpeedGraphV1 as cap } from '../dist/agent/capabilities/projectile-speed-graph.js';
import { horizontalProjectileV1 as hp } from '../dist/agent/capabilities/horizontal-projectile.js';
import { renderSceneSvg } from '../dist/render/scene.js';
import { THEME_ILLUSTRATED } from '../dist/index.js';

const FIXTURE = { h: 20, u: 10, g: 10, t: 1 }; // T = 2, vy(1) = -10

test('params schema is shared with horizontal-projectile (same accepts/rejects)', () => {
  assert.equal(cap.paramsSchema, hp.paramsSchema, 'schema object is shared, not duplicated');
  const cases = [
    { h: 20, u: 10, g: 10, t: 1 },
    { h: 20, u: 10, g: 10 },           // t optional (default 0)
    { h: 20, u: 0, g: 10, t: 2 },
    { h: 0, u: 10, g: 10 },
    { h: 101, u: 10, g: 10 },
    { h: 20, u: -1, g: 10 },
    { h: 20, u: 41, g: 10 },
    { h: 20, u: 10, g: 0.5 },
    { h: 20, u: 10, g: 21 },
    { h: 20, u: 10, g: 10, t: -1 },
    { h: 20, u: 10, g: 10, t: Infinity },
    { h: 20, u: 10, g: 10, t: 'x' },
    { h: 20, u: 10, g: 10, extra: 1 },
    { u: 10, g: 10 },
  ];
  for (const params of cases) {
    assert.equal(
      v.safeParse(cap.paramsSchema, params).success,
      v.safeParse(hp.paramsSchema, params).success,
      JSON.stringify(params),
    );
  }
});

test('derive: T, vx, vy for the fixture; -0 normalized at t=0', () => {
  const d = cap.derive(FIXTURE);
  assert.equal(d.T, 2);
  assert.equal(d.vx, 10);
  assert.equal(d.vy, -10);
  const d0 = cap.derive({ h: 20, u: 10, g: 10, t: 0 });
  assert.equal(d0.vy, 0);
  assert.equal(Object.is(d0.vy, -0), false);
});

test('physicsCheck: t beyond flight time → out-of-range on document.params.t', () => {
  const errs = cap.physicsCheck({ h: 20, u: 10, g: 10, t: 9 });
  assert.equal(errs.length, 1);
  assert.equal(errs[0].code, 'out-of-range');
  assert.equal(errs[0].path, 'document.params.t');
  assert.equal(cap.physicsCheck({ h: 20, u: 10, g: 10, t: 2 }).length, 0);
  assert.equal(cap.physicsCheck({ h: 20, u: 10, g: 10, t: 0 }).length, 0);
});

test('scene: axes carry t/v names + per-axis ticks; both lines and cursor emitted', () => {
  const items = cap.scene(FIXTURE, cap.derive(FIXTURE), cap.defaults.presentation);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));

  const ax = byId['ax'];
  assert.equal(ax.kind, 'axes');
  assert.deepEqual([...ax.x], [0, 2]);
  assert.equal(ax.xName, 't / s');
  assert.equal(ax.yName, 'v / (m/s)');
  assert.ok(ax.xTick > 0 && ax.yTick > 0);
  assert.notEqual(ax.xTick, ax.yTick, 's and m/s axes need independent ticks');
  assert.equal(ax.grid, true);

  const vx = byId['vx-line'];
  assert.equal(vx.kind, 'path');
  assert.equal(vx.role, 'component');
  assert.deepEqual(vx.points, [{ x: 0, y: 10 }, { x: 2, y: 10 }]);
  assert.equal(vx.label.text, 'vx');

  const vy = byId['vy-line'];
  assert.equal(vy.kind, 'path');
  assert.equal(vy.role, 'derived');
  assert.deepEqual(vy.points, [{ x: 0, y: 0 }, { x: 2, y: -20 }]);
  assert.equal(vy.label.text, 'vy');

  const cursor = byId['t-cursor'];
  assert.equal(cursor.kind, 'segment');
  assert.equal(cursor.role, 'guide');
  assert.equal(cursor.dashed, true);
  assert.deepEqual(cursor.from, { x: 1, y: 10 });
  assert.deepEqual(cursor.to, { x: 1, y: -10 });

  for (const [id, text, at] of [
    ['vx-t', 'vx(t)', { x: 1, y: 10 }],
    ['vy-t', 'vy(t)', { x: 1, y: -10 }],
  ]) {
    const pt = byId[id];
    assert.equal(pt.kind, 'point');
    assert.equal(pt.role, 'input');
    assert.equal(pt.label.text, text);
    assert.deepEqual(pt.at, at);
  }
});

test('fitPoints covers axes corners, line endpoints and cursor points', () => {
  const d = cap.derive(FIXTURE);
  const items = cap.scene(FIXTURE, d, cap.defaults.presentation);
  const ax = items.find((i) => i.kind === 'axes');
  const fit = cap.fitPoints(FIXTURE, d);
  const has = (x, y) => fit.some((p) => p.x === x && p.y === y);
  assert.ok(has(0, ax.y[0]) && has(2, ax.y[1]), 'axes corners');
  for (const p of [[0, 10], [2, 10], [2, -20], [1, 10], [1, -10]]) {
    assert.ok(has(p[0], p[1]), `point ${p}`);
  }
});

test('u=0 degenerate: vx line still drawn on the t axis; coincident cursor keeps points only', () => {
  const free = { h: 20, u: 0, g: 10, t: 1 };
  const items = cap.scene(free, cap.derive(free), cap.defaults.presentation);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.deepEqual(byId['vx-line'].points, [{ x: 0, y: 0 }, { x: 2, y: 0 }]);
  assert.ok(byId['vy-line'], 'vy line still emitted');
  assert.ok(byId['t-cursor'], 'vx(t)=0 vs vy(t)=-10 → real guide segment');

  const origin = { h: 20, u: 0, g: 10, t: 0 };
  const items0 = cap.scene(origin, cap.derive(origin), cap.defaults.presentation);
  const byId0 = Object.fromEntries(items0.map((i) => [i.id, i]));
  assert.equal(byId0['t-cursor'], undefined, 'vx(t)=vy(t)=0 → no zero-length guide');
  assert.deepEqual(byId0['vx-t'].at, { x: 0, y: 0 });
  assert.deepEqual(byId0['vy-t'].at, { x: 0, y: 0 });
});

// ---- renderer level (axes xName/yName + xTick/yTick) --------------------------

const view = { originPx: { x: 80, y: 170 }, pixelsPerUnit: 6 };
const svgFor = (items) => renderSceneSvg({
  instanceId: 'g', title: 'v–t', widthPx: 400, heightPx: 300,
  viewport: view, theme: THEME_ILLUSTRATED, items,
});

test('renderer: axes xName/yName render; per-axis ticks differ when xTick != yTick', () => {
  const svg = svgFor([
    {
      kind: 'axes', id: 'ax', x: [0, 2], y: [-20, 16],
      xTick: 0.5, yTick: 5, xName: 't / s', yName: 'v / (m/s)', grid: true,
    },
  ]);
  assert.ok(svg.includes('>t / s<'), 'x axis name');
  assert.ok(svg.includes('>v / (m/s)<'), 'y axis name');
  assert.ok(svg.includes('>0.5<'), 'x tick 0.5 — impossible from yTick=5');
  assert.ok(svg.includes('>-20<'), 'y tick -20 — impossible from xTick=0.5');
});

test('renderer: default axis names stay x/y; bad names and ticks rejected', () => {
  const svg = svgFor([{ kind: 'axes', id: 'ax', x: [0, 2], y: [-2, 2], tick: 1 }]);
  assert.ok(svg.includes('>x<') && svg.includes('>y<'));
  for (const bad of [
    { kind: 'axes', id: 'ax', x: [0, 1], y: [0, 1], tick: 1, xName: 'n'.repeat(201) },
    { kind: 'axes', id: 'ax', x: [0, 1], y: [0, 1], tick: 1, yName: 42 },
    { kind: 'axes', id: 'ax', x: [0, 1], y: [0, 1], tick: 1, xTick: 0 },
    { kind: 'axes', id: 'ax', x: [0, 1], y: [0, 1], tick: 1, yTick: -2 },
    { kind: 'axes', id: 'ax', x: [0, 1], y: [0, 1], tick: 1, xTick: NaN },
  ]) {
    assert.throws(() => svgFor([bad]), RangeError, JSON.stringify(bad));
  }
  // names escape through xml() like label text
  const esc = svgFor([
    { kind: 'axes', id: 'ax', x: [0, 1], y: [0, 1], tick: 1, xName: 'a<b' },
  ]);
  assert.ok(esc.includes('&lt;') && !esc.includes('>a<b<'));
});

test('capability scene renders end-to-end through renderSceneSvg', () => {
  const items = cap.scene(FIXTURE, cap.derive(FIXTURE), cap.defaults.presentation);
  const svg = svgFor(items);
  for (const frag of ['>t / s<', '>v / (m/s)<', '>vx<', '>vy<', '>vx(t)<', '>vy(t)<', 'pv-grid', 'pv-role-guide']) {
    assert.ok(svg.includes(frag), frag);
  }
});
