import test from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTILE_QUESTIONS } from '../dist/questions/projectile.js';
import {
  createSession, sessionApply, sessionDestroy, sessionRestoreOriginal,
  sessionSetTime, sessionUpdateParams,
} from '../dist/questions/session.js';

const byId = Object.fromEntries(PROJECTILE_QUESTIONS.map((q) => [q.id, q]));
const sessionOf = (q) => {
  const r = createSession(q);
  assert.ok(r.ok, `${q.id}: ${JSON.stringify(r.errors)}`);
  return r.session;
};

// ---- catalog --------------------------------------------------------------------

test('catalog: three authored instances, valid ids, original sources, distinct goals', () => {
  assert.equal(PROJECTILE_QUESTIONS.length, 3);
  for (const q of PROJECTILE_QUESTIONS) {
    assert.match(q.id, /^[a-z][a-z0-9-]{0,63}$/);
    assert.equal(q.templateId, 'horizontal-projectile');
    assert.equal(q.templateVersion, 1);
    assert.match(q.source, /原创/);
    assert.ok(q.steps.length >= 2, `${q.id} steps`);
    assert.deepEqual([...q.editableParams].sort(), ['g', 'h', 'u']);
  }
  assert.equal(new Set(PROJECTILE_QUESTIONS.map((q) => q.goal)).size, 3,
    'each instance has a distinct teaching goal');
});

// ---- session creation -------------------------------------------------------------

test('each instance creates a valid session with hand-computed T/R', () => {
  // T = sqrt(2h/g), R = u*T — hand-checked constants, not copied from the model
  const expect = {
    'q-landing-time': { T: 3, R: 30 },
    'q-range': { T: 2, R: 30 },
    'q-velocity-decompose': { T: 2, R: 20 },
  };
  for (const q of PROJECTILE_QUESTIONS) {
    const s = sessionOf(q);
    assert.equal(s.document.instanceId, q.id);
    assert.equal(s.document.templateId, 'horizontal-projectile');
    assert.deepEqual(s.document.presentation, {
      theme: { id: 'illustrated', version: 2 },
      canvas: { width: 640, height: 360 },
      viewport: { mode: 'fit' },
    });
    assert.equal(s.mode, 'original');
    assert.deepEqual(s.modifiedParams, []);
    assert.equal(s.destroyed, false);
    assert.equal(s.derived.T, expect[q.id].T, `${q.id} T`);
    assert.equal(s.derived.R, expect[q.id].R, `${q.id} R`);
  }
});

test('velocity-decompose instance starts at t=1 with v = (10, -10)', () => {
  const s = sessionOf(byId['q-velocity-decompose']);
  assert.equal(s.document.params.t, 1);
  assert.deepEqual(s.derived.velocity, { x: 10, y: -10 });
  assert.equal(s.derived.speed, Math.hypot(10, 10));
});

// ---- mode transitions ---------------------------------------------------------------

test('t scrub is allowed in original mode and does not switch it', () => {
  const s = sessionOf(byId['q-landing-time']);
  const r = sessionSetTime(s, 1.5);
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.equal(s.mode, 'original');
  assert.equal(s.document.params.t, 1.5);
  assert.equal(s.derived.position.x, 15);
  assert.deepEqual(s.modifiedParams, []);
});

test('editing a condition param switches to explore and records modifiedParams', () => {
  const s = sessionOf(byId['q-landing-time']);
  const r = sessionUpdateParams(s, { h: 30 });
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.equal(s.mode, 'explore');
  assert.deepEqual(s.modifiedParams, ['h']);
  assert.equal(s.document.params.h, 30);
  assert.equal(s.derived.T, Math.sqrt(6));
  // t-only update never flips mode back or into explore
  const t = sessionUpdateParams(s, { t: 0.5 });
  assert.ok(t.ok);
  assert.equal(s.mode, 'explore');
  assert.deepEqual(s.modifiedParams, ['h']);
  // setting the diverged key back to the original value clears the mark,
  // but the session stays in explore until restore
  const back = sessionUpdateParams(s, { h: 45 });
  assert.ok(back.ok);
  assert.equal(s.mode, 'explore');
  assert.deepEqual(s.modifiedParams, []);
});

test('restore applies original params (including t) and returns to original mode', () => {
  const s = sessionOf(byId['q-range']);
  sessionSetTime(s, 1);
  assert.ok(sessionUpdateParams(s, { h: 40, u: 5 }).ok);
  assert.equal(s.mode, 'explore');
  assert.deepEqual([...s.modifiedParams].sort(), ['h', 'u']);
  const r = sessionRestoreOriginal(s);
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.equal(s.mode, 'original');
  assert.deepEqual(s.modifiedParams, []);
  assert.equal(s.document.params.h, 20);
  assert.equal(s.document.params.u, 15);
  assert.equal(s.document.params.g, 10);
  assert.equal(s.document.params.t, 0);
  assert.equal(s.derived.R, 30);
});

test('sessionApply: non-condition ops keep mode, editable ops flip to explore', () => {
  const s = sessionOf(byId['q-range']);
  const themed = sessionApply(s, [
    { op: 'set-theme', value: { id: 'linework', version: 1 } },
  ]);
  assert.ok(themed.ok, JSON.stringify(themed.errors));
  assert.equal(s.mode, 'original');
  assert.equal(s.document.presentation.theme.id, 'linework');
  const edited = sessionApply(s, [{ op: 'set-h', value: 30 }]);
  assert.ok(edited.ok);
  assert.equal(s.mode, 'explore');
  assert.deepEqual(s.modifiedParams, ['h']);
});

// ---- failure keeps last valid state ----------------------------------------------------

test('rejected update keeps last valid document/derived and mode', () => {
  const s = sessionOf(byId['q-landing-time']);
  const doc = s.document;
  const derived = s.derived;
  const bad = sessionUpdateParams(s, { h: -5 });
  assert.equal(bad.ok, false);
  assert.equal(bad.errors[0].code, 'out-of-range');
  assert.equal(s.document, doc, 'document identity preserved');
  assert.equal(s.derived, derived);
  assert.equal(s.mode, 'original');
  assert.deepEqual(s.modifiedParams, []);
  // physics check also rejects: t beyond the new flight domain
  const s2 = sessionOf(byId['q-velocity-decompose']); // t = 1
  const over = sessionUpdateParams(s2, { h: 2 }); // T = sqrt(0.4) < 1
  assert.equal(over.ok, false);
  assert.equal(over.errors[0].code, 'out-of-range');
  assert.equal(s2.document.params.h, 20);
  assert.equal(s2.mode, 'original');
  // scrub past T is rejected the same way
  const badT = sessionSetTime(s2, 5);
  assert.equal(badT.ok, false);
  assert.equal(s2.document.params.t, 1);
});

// ---- isolation + lifecycle ----------------------------------------------------------------

test('two sessions on the same instance are fully independent', () => {
  const q = byId['q-range'];
  const a = sessionOf(q);
  const b = sessionOf(q);
  assert.notEqual(a, b);
  assert.notEqual(a.document, b.document);
  assert.ok(sessionUpdateParams(a, { h: 80 }).ok);
  assert.ok(sessionSetTime(a, 2).ok);
  assert.equal(a.mode, 'explore');
  assert.equal(b.mode, 'original');
  assert.equal(b.document.params.h, 20);
  assert.equal(b.document.params.t, 0);
  assert.equal(b.derived.T, 2);
  assert.equal(b.derived.R, 30);
  // the shared immutable instance itself is untouched
  assert.equal(q.params.h, 20);
});

test('destroyed session rejects every later mutator', () => {
  const s = sessionOf(byId['q-landing-time']);
  assert.ok(sessionDestroy(s).ok);
  assert.equal(s.destroyed, true);
  for (const r of [
    sessionSetTime(s, 1),
    sessionUpdateParams(s, { h: 10 }),
    sessionRestoreOriginal(s),
    sessionDestroy(s),
  ]) {
    assert.equal(r.ok, false);
    assert.equal(r.errors[0].code, 'destroyed');
  }
  assert.equal(s.document.params.h, 45, 'state frozen at last valid');
});
