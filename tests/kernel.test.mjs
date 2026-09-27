import test from 'node:test';
import assert from 'node:assert/strict';
import { vec2, add, sub, scale, dot, magnitude, normalize,
  worldToScreen, screenToWorld, buildArrow } from '../dist/index.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
const view = { originPx: vec2(320, 180), pixelsPerUnit: 50 };

test('vector arithmetic', () => {
  assert.deepEqual(add(vec2(1, 2), vec2(3, 4)), vec2(4, 6));
  assert.deepEqual(sub(vec2(1, 2), vec2(3, 4)), vec2(-2, -2));
  assert.deepEqual(scale(vec2(1, 2), 3), vec2(3, 6));
  assert.equal(dot(vec2(1, 2), vec2(3, 4)), 11);
});
test('3-4-5 magnitude and normalization', () => {
  assert.equal(magnitude(vec2(3, 4)), 5);
  assert.deepEqual(normalize(vec2(3, 4)), vec2(0.6, 0.8));
});
test('zero vector has no direction', () => assert.equal(normalize(vec2(0, 0)), null));
test('tiny finite vectors normalize without inverse overflow', () => {
  assert.deepEqual(normalize(vec2(1e-320, 0)), vec2(1, 0));
});
test('nonfinite coordinates and factors are rejected', () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.throws(() => vec2(bad, 0), RangeError);
    assert.throws(() => magnitude({ x: 0, y: bad }), RangeError);
    assert.throws(() => scale(vec2(1, 0), bad), RangeError);
  }
});
test('unrepresentable arithmetic fails explicitly', () => {
  assert.throws(() => add(vec2(1e308, 0), vec2(1e308, 0)), RangeError);
});
test('operations do not mutate inputs', () => {
  const v = Object.freeze(vec2(3, 4));
  scale(v, 4); normalize(v);
  assert.deepEqual(v, vec2(3, 4));
});
test('positive world y maps upward on screen', () => {
  assert.deepEqual(worldToScreen(vec2(1, 1), view), vec2(370, 130));
});
test('coordinate round trips across origins and scales', () => {
  for (const pixelsPerUnit of [0.01, 1, 50, 1000]) {
    for (const x of [-3.5, 0, 7]) for (const y of [-8, 0, 2.5]) {
      const v = { originPx: vec2(140, -80), pixelsPerUnit };
      const p = screenToWorld(worldToScreen(vec2(x, y), v), v);
      close(p.x, x); close(p.y, y);
    }
  }
});
test('invalid view scales and origins fail', () => {
  for (const pixelsPerUnit of [0, -1, NaN, Infinity]) {
    assert.throws(() => worldToScreen(vec2(0, 0), { ...view, pixelsPerUnit }), RangeError);
    assert.throws(() => screenToWorld(vec2(0, 0), { ...view, pixelsPerUnit }), RangeError);
  }
  assert.throws(() => worldToScreen(vec2(0, 0), { ...view, originPx: { x: NaN, y: 0 } }), RangeError);
});
test('coincident arrow endpoints have explicit geometry', () => {
  assert.deepEqual(buildArrow(vec2(2, 3), vec2(2, 3)), { kind: 'zero', point: vec2(2, 3) });
});
for (const end of [vec2(100, 0), vec2(0, 100), vec2(-100, 0), vec2(0, -100), vec2(-70, 70)]) {
  test(`arrow head has correct direction for ${end.x},${end.y}`, () => {
    const shape = buildArrow(vec2(0, 0), end);
    assert.equal(shape.kind, 'arrow');
    assert.deepEqual(shape.tip, end);
    close(magnitude(sub(shape.tip, shape.base)), 12);
    close(dot(sub(shape.left, shape.base), sub(shape.tip, shape.base)), 0);
    assert.ok(dot(sub(shape.tip, shape.base), end) > 0);
  });
}
test('short arrows shrink both head dimensions', () => {
  const s = buildArrow(vec2(0, 0), vec2(1, 0));
  assert.equal(s.kind, 'arrow'); close(s.base.x, 0.55);
  close(magnitude(sub(s.left, s.right)), 8 * 0.45 / 12);
});
test('arrow geometry rejects bad dimensions and invalid inputs', () => {
  for (const bad of [0, -1, NaN, Infinity]) {
    assert.throws(() => buildArrow(vec2(0, 0), vec2(1, 0), bad), RangeError);
    assert.throws(() => buildArrow(vec2(0, 0), vec2(1, 0), 12, bad), RangeError);
  }
  assert.throws(() => buildArrow({ x: NaN, y: 0 }, vec2(1, 0)), RangeError);
});
