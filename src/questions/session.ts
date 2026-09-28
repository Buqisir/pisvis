import { authoring } from '../agent/index.js';
import type {
  ApiError, AuthoringApi, ErrorCode, Failure, SceneDocument,
  SceneOperation, SceneSuccess,
} from '../agent/types.js';
import type { QuestionInstance, QuestionMode } from './types.js';

// ---- session types ------------------------------------------------------------

/** 会话层错误：destroyed/invalid-session 由本层产生，其余直接沿用 ApiError 的码。 */
export interface SessionError {
  readonly code: ErrorCode | 'destroyed' | 'invalid-session';
  readonly path: string;
  readonly message: string;
}

export interface SessionFailure {
  readonly ok: false;
  readonly errors: readonly SessionError[];
}

/** 变更返回值：成功时是 updateScene 的 SceneSuccess；失败时会话停在最后有效状态。 */
export type SessionMutatorResult = SceneSuccess | Failure | SessionFailure;

export type CreateSessionResult =
  | { readonly ok: true; readonly session: QuestionSession }
  | { readonly ok: false; readonly errors: readonly ApiError[] };

/**
 * 一题的运行态（REUSE_AND_BINDINGS §1 的「实例运行态」）。
 * 字段经 getter 暴露且只读；每次成功变更整体替换 document/derived，
 * 失败则保持最后有效状态。无 DOM、无定时器，帧循环/监听由页面层自持。
 */
export interface QuestionSession {
  readonly instance: QuestionInstance;
  readonly document: SceneDocument;
  readonly derived: Record<string, unknown>;
  readonly mode: QuestionMode;
  /** 相对原题已偏离的题设字段（editableParams 的子集，按声明顺序）。 */
  readonly modifiedParams: readonly string[];
  readonly destroyed: boolean;
}

export interface ProjectileParamPatch {
  readonly h?: number;
  readonly u?: number;
  readonly g?: number;
  readonly t?: number;
}

// ---- internals ----------------------------------------------------------------

interface SessionState {
  readonly api: AuthoringApi;
  document: SceneDocument;
  derived: Record<string, unknown>;
  mode: QuestionMode;
  modifiedParams: readonly string[];
  destroyed: boolean;
}

const states = new WeakMap<QuestionSession, SessionState>();

const PARAM_KEYS = ['h', 'u', 'g', 't'] as const;

function fail(code: SessionError['code'], message: string): SessionFailure {
  return { ok: false, errors: [{ code, path: 'session', message }] };
}

/** set-<key> 操作触及的题设字段名（editableParams 的交集）。 */
function touchedEditable(
  instance: QuestionInstance,
  operations: readonly SceneOperation[],
): boolean {
  return operations.some((o) => {
    const key = o.op.startsWith('set-') ? o.op.slice(4) : '';
    return instance.editableParams.includes(key);
  });
}

/** 先校验完整候选再原子提交：成功后替换 document/derived 并回调模式簿记。 */
function mutate(
  session: QuestionSession,
  operations: readonly SceneOperation[],
  onSuccess?: (st: SessionState) => void,
): SessionMutatorResult {
  const st = states.get(session);
  if (st === undefined) return fail('invalid-session', '不是 createSession 返回的会话对象');
  if (st.destroyed) return fail('destroyed', '会话已销毁，不再接受任何修改');
  const r = st.api.updateScene({ document: st.document, operations });
  if (!r.ok) return r;
  st.document = r.document;
  st.derived = r.derived;
  if (st.mode === 'original' && touchedEditable(session.instance, operations)) {
    st.mode = 'explore';
  }
  st.modifiedParams = Object.freeze(diverged(session.instance, st.document));
  onSuccess?.(st);
  return r;
}

/** editableParams 中当前值与原题不同的字段。 */
function diverged(instance: QuestionInstance, doc: SceneDocument): string[] {
  return instance.editableParams.filter((k) => doc.params[k] !== instance.params[k]);
}

// ---- public API -----------------------------------------------------------------

export interface CreateSessionOptions {
  /** 覆盖默认 instanceId（默认 instance.id）；同屏多会话同题时用于隔离文档 id。 */
  readonly instanceId?: string;
}

/**
 * 用题目实例建会话：经 authoring.createScene 走同一校验边界，
 * 默认表现 illustrated@2、canvas 640×360、viewport fit；起始为原题模式。
 */
export function createSession(
  instance: QuestionInstance,
  api: AuthoringApi = authoring,
  options?: CreateSessionOptions,
): CreateSessionResult {
  const r = api.createScene({
    templateId: instance.templateId,
    templateVersion: instance.templateVersion,
    params: instance.params,
    instanceId: options?.instanceId ?? instance.id,
    presentation: {
      theme: { id: 'illustrated', version: 2 },
      canvas: { width: 640, height: 360 },
      viewport: { mode: 'fit' },
    },
  });
  if (!r.ok) return { ok: false, errors: r.errors };
  const st: SessionState = {
    api,
    document: r.document,
    derived: r.derived,
    mode: 'original',
    modifiedParams: Object.freeze([]),
    destroyed: false,
  };
  const session: QuestionSession = {
    instance,
    get document() { return st.document; },
    get derived() { return st.derived; },
    get mode() { return st.mode; },
    get modifiedParams() { return st.modifiedParams; },
    get destroyed() { return st.destroyed; },
  };
  states.set(session, st);
  return { ok: true, session };
}

/** 时间 scrub：两种模式都允许，不改变 mode —— t 不是题设条件。 */
export function sessionSetTime(session: QuestionSession, t: number): SessionMutatorResult {
  return mutate(session, [{ op: 'set-t', value: t }]);
}

/**
 * 改题设参数。patch 中含 editableParams 的字段时，原题模式自动切到
 * explore 并记录 modifiedParams；t 永远不算题设修改。
 */
export function sessionUpdateParams(
  session: QuestionSession,
  patch: ProjectileParamPatch,
): SessionMutatorResult {
  const operations: SceneOperation[] = [];
  for (const key of PARAM_KEYS) {
    const value = patch[key];
    if (value !== undefined) operations.push({ op: `set-${key}`, value });
  }
  return mutate(session, operations);
}

/**
 * 通用操作通道：set-theme/set-labels 这类非题设操作也走同一条校验边界；
 * 触及 editableParams 的 set-<key> 同样触发原题→探索切换。
 */
export function sessionApply(
  session: QuestionSession,
  operations: readonly SceneOperation[],
): SessionMutatorResult {
  return mutate(session, operations);
}

/** 恢复原题：把 instance.params（含 t）整体写回，回到原题模式并清空已改标记。 */
export function sessionRestoreOriginal(session: QuestionSession): SessionMutatorResult {
  const operations: SceneOperation[] = Object.keys(session.instance.params).map((k) => ({
    op: `set-${k}`,
    value: session.instance.params[k],
  }));
  return mutate(session, operations, (st) => {
    st.mode = 'original';
    st.modifiedParams = Object.freeze([]);
  });
}

/**
 * 生命周期钩子：标记销毁，之后所有变更返回 { code: 'destroyed' } 错误。
 * rAF/指针监听等资源由页面层另行清理，本层不持有。
 */
export function sessionDestroy(
  session: QuestionSession,
): { readonly ok: true } | SessionFailure {
  const st = states.get(session);
  if (st === undefined) return fail('invalid-session', '不是 createSession 返回的会话对象');
  if (st.destroyed) return fail('destroyed', '会话已销毁');
  st.destroyed = true;
  return { ok: true };
}
