/// <reference lib="dom" />
// Thin motion (motion.dev) adapter for the Issue #4 limited teaching sequence.
// This module is the DOM isolation point: the kernel build uses lib ES2022, so
// DOM types are declared per-file rather than relaxing the shared config.
// `motion/mini`'s ESM entry has no top-level DOM access, so a static import
// stays safe under plain Node; DOM is only touched inside the functions below.

import { animate } from 'motion/mini';

type AnimationControls = ReturnType<typeof animate>;
type DOMKeyframes = Parameters<typeof animate>[1];

/**
 * Container-level element keys a teaching sequence may animate. Never name
 * physics geometry: the ball, trajectory and vector arrows inside the scene
 * are owned by the document/render path and by the user's own playback clock.
 */
export type TeachingTarget = 'scene' | 'vectors' | 'panels';
export const TEACHING_TARGETS: readonly TeachingTarget[] = ['scene', 'vectors', 'panels'];

/** Container style props only: opacity and flat translate/scale. */
export interface MotionStepStyle {
  readonly opacity?: number;
  readonly x?: number;
  readonly y?: number;
  readonly scale?: number;
}

export interface MotionStep {
  readonly target: TeachingTarget;
  readonly from: MotionStepStyle;
  readonly to: MotionStepStyle;
  /** Seconds; each step stays under 1s. */
  readonly duration: number;
  /** Seconds after the sequence starts. */
  readonly delay: number;
  readonly ease: 'easeOut';
}

const SEQUENCE: readonly MotionStep[] = [
  // 显示情境 → 展开速度分解 → 聚焦公式/图像
  { target: 'scene', from: { opacity: 0, y: 12 }, to: { opacity: 1, y: 0 }, duration: 0.45, delay: 0, ease: 'easeOut' },
  { target: 'vectors', from: { opacity: 0.25, scale: 1.06 }, to: { opacity: 1, scale: 1 }, duration: 0.3, delay: 0.4, ease: 'easeOut' },
  { target: 'panels', from: { opacity: 0, y: 8 }, to: { opacity: 1, y: 0 }, duration: 0.4, delay: 0.65, ease: 'easeOut' },
];

/**
 * The ordered teaching plan. `reduced` collapses every step to zero time —
 * an instant-apply plan whose `to` states the runner writes synchronously.
 */
export function planTeachingSequence(reduced: boolean): readonly MotionStep[] {
  if (!reduced) return SEQUENCE;
  return SEQUENCE.map((step) => ({ ...step, duration: 0, delay: 0 }));
}

/** Safe in SSR/Node: false when window/matchMedia are unavailable. */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const STYLE_KEYS = ['opacity', 'x', 'y', 'scale'] as const;

function keyframesOf(step: MotionStep): DOMKeyframes {
  const def: Partial<Record<(typeof STYLE_KEYS)[number], number[]>> = {};
  for (const key of STYLE_KEYS) {
    const to = step.to[key];
    if (to === undefined) continue; // a `from`-only key is never animated
    const from = step.from[key];
    def[key] = from === undefined ? [to] : [from, to];
  }
  return def as DOMKeyframes;
}

/** Writes a step's final styles directly — no animation, no motion objects. */
function applyFinalState(el: Element, to: MotionStepStyle): void {
  const style = (el as { style?: CSSStyleDeclaration }).style;
  if (style === undefined) return;
  if (to.x !== undefined || to.y !== undefined || to.scale !== undefined) {
    style.transform = `translate(${to.x ?? 0}px, ${to.y ?? 0}px) scale(${to.scale ?? 1})`;
  }
  if (to.opacity !== undefined) style.opacity = String(to.opacity);
}

export type TeachingTargets = Partial<Record<TeachingTarget, Element>>;

export interface TeachingSequence {
  /** Cancels every animation this run started, then presents the final state. */
  cancel(): void;
  /** Resolves when the sequence has finished or been cancelled. */
  readonly finished: Promise<void>;
}

export function runTeachingSequence(
  targets: TeachingTargets,
  opts: { readonly reduced?: boolean } = {},
): TeachingSequence {
  const reduced = opts.reduced ?? prefersReducedMotion();
  const steps = planTeachingSequence(reduced);

  let resolveFinished: () => void = () => {};
  const finished = new Promise<void>((resolve) => { resolveFinished = resolve; });
  const applyFinals = (): void => {
    for (const step of steps) {
      const el = targets[step.target];
      if (el !== undefined) applyFinalState(el, step.to);
    }
  };

  // Reduced motion — or no DOM at all — presents the end state directly and
  // never starts an animation, so no rAF can leak.
  if (reduced || typeof window === 'undefined' || typeof window.document === 'undefined') {
    applyFinals();
    resolveFinished();
    return { cancel: () => {}, finished };
  }

  const controls: AnimationControls[] = [];
  let pending = 0;
  const onStepDone = (): void => {
    pending -= 1;
    if (pending <= 0) resolveFinished();
  };
  for (const step of steps) {
    const el = targets[step.target];
    if (el === undefined) continue; // a missing container skips only its step
    pending += 1;
    // type:'tween' is explicit — motion defaults transform props to spring,
    // and no spring may drive teaching presentation either.
    const control = animate(el, keyframesOf(step), {
      type: 'tween', duration: step.duration, delay: step.delay, ease: step.ease,
    });
    controls.push(control);
    // finished resolves on completion; both branches settle the step so a
    // future reject-on-cancel change can never wedge the sequence.
    void control.finished.then(onStepDone, onStepDone);
  }
  if (pending === 0) resolveFinished();

  return {
    cancel(): void {
      for (const control of controls) control.cancel();
      // land on the presented end state, never a mid-flight or hidden frame
      applyFinals();
      resolveFinished();
    },
    finished,
  };
}
