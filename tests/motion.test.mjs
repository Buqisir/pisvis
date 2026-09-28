import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TEACHING_TARGETS, prefersReducedMotion, planTeachingSequence, runTeachingSequence,
} from '../dist/motion/index.js';

// Runs under plain Node: importing the adapter must not need window/document.
test('module imports under Node; prefersReducedMotion is false without matchMedia', () => {
  assert.equal(typeof window, 'undefined');
  assert.equal(prefersReducedMotion(), false);
});

const STYLE_KEYS = ['opacity', 'x', 'y', 'scale'];
const PHYSICS_GEOMETRY = ['ball', 'trajectory', 'arrow', 'vector', 'ground', 'path', 'line'];

test('plan: ordered container-level steps, bounded durations, ease-out only', () => {
  const plan = planTeachingSequence(false);
  // 显示情境 → 展开速度分解 → 聚焦公式/图像
  assert.deepEqual(plan.map((s) => s.target), ['scene', 'vectors', 'panels']);
  assert.ok(plan.length >= 2 && plan.length <= 4);
  for (const step of plan) {
    assert.ok(TEACHING_TARGETS.includes(step.target), `target ${step.target} is a known container`);
    assert.ok(!PHYSICS_GEOMETRY.includes(step.target), `${step.target} must not be physics geometry`);
    assert.ok(step.duration > 0 && step.duration <= 1, `duration ${step.duration}s within (0, 1]`);
    assert.ok(step.delay >= 0);
    assert.equal(step.ease, 'easeOut');
    // every animated property lands at its `to` value; container props only
    for (const key of Object.keys(step.from)) {
      assert.ok(STYLE_KEYS.includes(key), `from.${key}`);
      assert.ok(key in step.to, `from.${key} must reach to.${key}`);
    }
    for (const key of Object.keys(step.to)) assert.ok(STYLE_KEYS.includes(key), `to.${key}`);
    assert.ok(Object.keys(step.to).length > 0, 'step must define a final state');
  }
  const delays = plan.map((s) => s.delay);
  assert.deepEqual([...delays].sort((a, b) => a - b), delays, 'staged reveal order');
});

test('plan: reduced collapses to a zero-time instant-apply plan', () => {
  const plan = planTeachingSequence(true);
  assert.deepEqual(plan.map((s) => s.target), planTeachingSequence(false).map((s) => s.target));
  for (const step of plan) {
    assert.equal(step.duration, 0);
    assert.equal(step.delay, 0);
    assert.ok(TEACHING_TARGETS.includes(step.target));
    assert.ok(Object.keys(step.to).length > 0);
  }
});

// Plain {style:{}} objects stand in for Elements: the adapter only writes
// container style props, so the DOM-free paths are fully exercisable here.
const fakeEl = () => ({ style: {} });

test('run reduced: final state applied synchronously, finished resolves, no animation', async () => {
  const scene = fakeEl(); const vectors = fakeEl(); const panels = fakeEl();
  const seq = runTeachingSequence({ scene, vectors, panels }, { reduced: true });
  assert.equal(scene.style.opacity, '1');
  assert.equal(scene.style.transform, 'translate(0px, 0px) scale(1)');
  assert.equal(vectors.style.opacity, '1');
  assert.equal(vectors.style.transform, 'translate(0px, 0px) scale(1)');
  assert.equal(panels.style.opacity, '1');
  assert.equal(panels.style.transform, 'translate(0px, 0px) scale(1)');
  assert.ok(seq.finished instanceof Promise);
  await seq.finished;
  seq.cancel(); // idempotent no-op after instant apply
  await seq.finished;
});

test('run reduced: missing targets skip their step, present targets still apply', async () => {
  const panels = fakeEl();
  const seq = runTeachingSequence({ panels }, { reduced: true });
  assert.equal(panels.style.opacity, '1');
  await seq.finished;
});

test('run without DOM falls back to instant apply (no animate call, no throw)', async () => {
  const scene = fakeEl(); const vectors = fakeEl();
  const seq = runTeachingSequence({ scene, vectors }, { reduced: false });
  // Node has no window: the runner must present the final state directly
  assert.equal(scene.style.opacity, '1');
  assert.equal(vectors.style.scale, undefined); // scale lives in transform
  assert.equal(vectors.style.transform, 'translate(0px, 0px) scale(1)');
  await seq.finished;
  seq.cancel();
  assert.equal(scene.style.opacity, '1', 'cancel leaves the presented end state');
});

test('run: empty targets still returns a settled handle', async () => {
  const seq = runTeachingSequence({});
  assert.equal(typeof seq.cancel, 'function');
  await seq.finished;
});
