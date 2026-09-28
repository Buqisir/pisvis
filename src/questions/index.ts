export type { QuestionInstance, QuestionMode, TeachingCue, TeachingStep } from './types.js';
export { PROJECTILE_QUESTIONS } from './projectile.js';
export {
  createSession,
  sessionApply,
  sessionDestroy,
  sessionRestoreOriginal,
  sessionSetTime,
  sessionUpdateParams,
} from './session.js';
export type {
  CreateSessionOptions,
  CreateSessionResult,
  ProjectileParamPatch,
  QuestionSession,
  SessionError,
  SessionFailure,
  SessionMutatorResult,
} from './session.js';
