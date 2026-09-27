import test from 'node:test';
import assert from 'node:assert/strict';
import { renderArrowSvg, vec2 } from '../dist/index.js';

const input = {
  start: vec2(-2, -1), end: vec2(2, 1),
  viewport: { originPx: vec2(320, 180), pixelsPerUnit: 50 },
  widthPx: 640, heightPx: 360, label: '向量 A',
};
test('pure renderer imports and runs in Node without DOM globals', () => {
  assert.equal(typeof document, 'undefined');
  assert.match(renderArrowSvg(input), /^<svg xmlns=/);
});
test('output is deterministic and has no IDs shared between scenes', () => {
  assert.equal(renderArrowSvg(input), renderArrowSvg(input));
  assert.doesNotMatch(renderArrowSvg(input), /\sid=/);
});
test('caption and accessibility text are escaped', () => {
  const svg = renderArrowSvg({ ...input, label: `<script>alert("x")</script>&'` });
  assert.doesNotMatch(svg, /<script/);
  assert.match(svg, /&lt;script&gt;/);
  assert.match(svg, /&quot;x&quot;/);
  assert.match(svg, /&amp;&apos;/);
});
test('unsupported XML characters fail explicitly', () => {
  for (const label of ['a\u0000b', '\uD800']) {
    assert.throws(() => renderArrowSvg({ ...input, label }), RangeError);
  }
  assert.match(renderArrowSvg({ ...input, label: '方向 → 😀' }), /方向 → 😀/);
});
test('coincident endpoints draw a point, never a fabricated direction', () => {
  const svg = renderArrowSvg({ ...input, end: input.start });
  assert.match(svg, /<circle /);
  assert.doesNotMatch(svg, /<polygon|NaN|Infinity/);
});
test('renderer rejects invalid dimensions and viewports', () => {
  for (const bad of [0, -1, Infinity, NaN]) {
    assert.throws(() => renderArrowSvg({ ...input, widthPx: bad }), RangeError);
    assert.throws(() => renderArrowSvg({ ...input, heightPx: bad }), RangeError);
  }
});
test('no external resources, executable SVG or foreignObject', () => {
  const svg = renderArrowSvg(input);
  assert.doesNotMatch(svg, /<script|<foreignObject|<image|\shref=|\son[a-z]+=/);
  assert.match(svg, /role="img"/);
  assert.match(svg, /<title>向量 A<\/title>/);
});
