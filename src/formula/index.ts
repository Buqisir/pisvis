/**
 * Controlled KaTeX adapter (docs/ARCHITECTURE.md §7, REUSE_AND_BINDINGS.md §3):
 * registered formula ids + finite numeric params only — user/agent text never
 * enters the TeX string. Per-call isolation: renderToString is pure, no shared
 * macros/state; trust:false blocks \href/\includegraphics/\html*, throwOnError
 * turns bad TeX into a structured error. DOM-free: works in plain Node.
 */

import katex from 'katex';
import { PROJECTILE_FORMULAS } from './projectile.js';
import type { FormulaSpec } from './projectile.js';

export interface FormulaInfo {
  readonly id: string;
  readonly name: string;
}

export type FormulaErrorCode =
  | 'unknown-formula'
  | 'bad-value'
  | 'not-applicable'
  | 'formula-render';

export interface FormulaError {
  readonly code: FormulaErrorCode;
  readonly message: string;
  /** value key that failed validation, for bad-value errors */
  readonly key?: string;
}

export type FormulaResult =
  | { readonly ok: true; readonly id: string; readonly tex: string; readonly html: string }
  | { readonly ok: false; readonly id: string; readonly errors: readonly FormulaError[] };

export interface RenderFormulaOptions {
  /** true -> KaTeX displayMode (block); default inline */
  readonly display?: boolean;
}

const REGISTRY: ReadonlyMap<string, FormulaSpec> = new Map(
  PROJECTILE_FORMULAS.map((f) => [f.id, f]),
);

export function listFormulas(): readonly FormulaInfo[] {
  return PROJECTILE_FORMULAS.map((f) => ({ id: f.id, name: f.name }));
}

const fail = (id: string, errors: readonly FormulaError[]): FormulaResult => ({
  ok: false,
  id,
  errors,
});

export function renderFormula(
  id: string,
  values: Record<string, unknown>,
  opts?: RenderFormulaOptions,
): FormulaResult {
  const spec = REGISTRY.get(id);
  if (spec === undefined) {
    return fail(id, [{
      code: 'unknown-formula',
      message: `未注册的公式 id：${id}（用 listFormulas() 查目录，不要猜名字）`,
    }]);
  }
  const src: Record<string, unknown> =
    typeof values === 'object' && values !== null ? values : {};
  const nums: Record<string, number> = {};
  const errors: FormulaError[] = [];
  for (const key of spec.requires) {
    const v = src[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      nums[key] = v;
    } else {
      errors.push({ code: 'bad-value', key, message: `${id} 需要有限数值 ${key}，收到 ${String(v)}` });
    }
  }
  if (errors.length > 0) return fail(id, errors);
  const blocked = spec.applicable?.(nums);
  if (blocked != null) return fail(id, [{ code: 'not-applicable', message: blocked }]);
  let tex: string;
  try {
    tex = spec.build(nums);
  } catch (e) {
    return fail(id, [{
      code: 'bad-value',
      message: `数值组合产生非有限结果：${e instanceof Error ? e.message : String(e)}`,
    }]);
  }
  try {
    const html = katex.renderToString(tex, {
      throwOnError: true,
      trust: false,
      strict: 'warn',
      output: 'html',
      displayMode: opts?.display === true,
    });
    return { ok: true, id, tex, html };
  } catch (e) {
    return fail(id, [{
      code: 'formula-render',
      message: `KaTeX 排版失败：${e instanceof Error ? e.message : String(e)}`,
    }]);
  }
}

export function renderAll(
  ids: readonly string[],
  values: Record<string, unknown>,
  opts?: RenderFormulaOptions,
): readonly FormulaResult[] {
  return ids.map((id) => renderFormula(id, values, opts));
}
