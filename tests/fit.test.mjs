import test from 'node:test';
import assert from 'node:assert/strict';
import { fitViewport, vec2, worldToScreen } from '../dist/index.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('all points fit inside the rect minus the margin, centered', () => {
  const pts = [vec2(-4, -2), vec2(4, 2), vec2(0, 0)];
  const v = fitViewport(pts, 640, 360, 36);
  for (const p of pts) {
    const s = worldToScreen(p, v);
    assert.ok(s.x >= 36 - 1e-9 && s.x <= 640 - 36 + 1e-9, `x ${s.x}`);
    assert.ok(s.y >= 36 - 1e-9 && s.y <= 360 - 36 + 1e-9, `y ${s.y}`);
  }
  // uniform scale: the tighter axis decides; extents touch both margins there
  close(v.pixelsPerUnit, Math.min((640 - 72) / 8, (360 - 72) / 4));
  const c = worldToScreen(vec2(0, 0), v);
  close(c.x, 320); close(c.y, 180);
});

test('derived results beyond the input range are not clipped', () => {
  const pts = [vec2(-4, -4), vec2(4, -4), vec2(8, 8)]; // inputs [-4,4], sum to 8
  const v = fitViewport(pts, 500, 400, 40);
  const s = worldToScreen(vec2(8, 8), v);
  assert.ok(s.x <= 460 && s.y >= 40, 'boundary result stays inside');
});

test('degenerate extents stay finite and centered', () => {
  const one = fitViewport([vec2(3, -1)], 640, 360, 40);
  assert.ok(Number.isFinite(one.pixelsPerUnit));
  const p = worldToScreen(vec2(3, -1), one);
  close(p.x, 320); close(p.y, 180);
  const flat = fitViewport([vec2(0, 0), vec2(5, 0)], 640, 360, 40);
  assert.ok(Number.isFinite(flat.pixelsPerUnit));
  const a = worldToScreen(vec2(0, 0), flat);
  const b = worldToScreen(vec2(5, 0), flat);
  close(a.y, 180); close(b.y, 180);
  close(b.x - a.x, 560); // full available width
});

test('bad inputs fail explicitly', () => {
  assert.throws(() => fitViewport([], 640, 360, 40), RangeError);
  assert.throws(() => fitViewport([vec2(0, 0)], 640, 360, 180), RangeError);
  assert.throws(() => fitViewport([vec2(0, 0)], 640, 360, -5), RangeError);
  assert.throws(() => fitViewport([{ x: NaN, y: 0 }], 640, 360, 40), RangeError);
  assert.throws(() => fitViewport([vec2(0, 0)], 0, 360, 40), RangeError);
});
