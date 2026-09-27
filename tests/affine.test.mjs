import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAffine, invertAffine, vec2 } from '../dist/index.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const closeVec = (p, q) => { close(p.x, q.x); close(p.y, q.y); };
const IDENTITY = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

test('identity keeps the point and inverts to itself', () => {
  const p = vec2(3, -2);
  assert.deepEqual(applyAffine(p, IDENTITY), p);
  const inverse = invertAffine(IDENTITY);
  assert.ok(inverse);
  assert.deepEqual(applyAffine(p, inverse), p);
});

test('scale and translate round-trip', () => {
  const m = { a: 2, b: 0, c: 0, d: -3, e: 10, f: -4 };
  const p = vec2(1.5, -2.25);
  assert.deepEqual(applyAffine(p, m), vec2(13, 2.75));
  const inverse = invertAffine(m);
  assert.ok(inverse);
  closeVec(applyAffine(applyAffine(p, m), inverse), p);
});

test('rotation plus skew round-trip', () => {
  const angle = Math.PI / 7;
  const m = {
    a: Math.cos(angle), b: Math.sin(angle),
    c: -Math.sin(angle) + 0.3, d: Math.cos(angle),
    e: -40, f: 25,
  };
  const p = vec2(-12.3, 8.7);
  const inverse = invertAffine(m);
  assert.ok(inverse);
  closeVec(applyAffine(applyAffine(p, m), inverse), p);
});

test('singular and degenerate matrices return null', () => {
  assert.equal(invertAffine({ a: 0, b: 0, c: 0, d: 0, e: 1, f: 2 }), null);
  assert.equal(invertAffine({ a: 1, b: 2, c: 3, d: 6, e: 0, f: 0 }), null);
  assert.equal(invertAffine({ a: 2, b: 4, c: 1, d: 2, e: 9, f: 9 }), null);
  assert.equal(invertAffine({ a: 1e-200, b: 0, c: 0, d: 1e-200, e: 0, f: 0 }), null);
  assert.equal(invertAffine({ a: 1, b: 0, c: 0, d: Number.EPSILON / 4, e: 0, f: 0 }), null);
});

test('non-finite entries are rejected', () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.throws(() => applyAffine(vec2(0, 0), { ...IDENTITY, a: bad }), RangeError);
    assert.throws(() => invertAffine({ ...IDENTITY, e: bad }), RangeError);
  }
  assert.throws(() => applyAffine({ x: NaN, y: 0 }, IDENTITY), RangeError);
});
