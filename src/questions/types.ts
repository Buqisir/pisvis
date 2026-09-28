/**
 * 题目实例层的纯数据类型（REUSE_AND_BINDINGS §1：题目实例与实例运行态分开）。
 * 这里只有不可变题面数据；运行态（当前文档、模式、已改条件）见 session.ts。
 */

/** 'original' = 原题模式（题设未被改动）；'explore' = 探索模式（题设被改动过）。 */
export type QuestionMode = 'original' | 'explore';

export interface QuestionInstance {
  /** 实例 ID：匹配 /^[a-z][a-z0-9-]{0,63}$/；同时用作 SceneDocument.instanceId。 */
  readonly id: string;
  /** 已注册能力的精确 id 与版本，如 'horizontal-projectile' + 1；不用 latest。 */
  readonly templateId: string;
  readonly templateVersion: number;
  readonly title: string;
  /** 来源定位；原创题写明「原创」，引用题写书名与页码，不编造。 */
  readonly source: string;
  /** 教学目标：这一题要学生看懂什么（含可核对答案）。 */
  readonly goal: string;
  /**
   * 原题条件。对 horizontal-projectile@1 为 { h, u, g, t }，
   * SI 单位：h 用 m、u 用 m/s、g 用 m/s²、t 用 s；取值边界由能力 schema 校验。
   */
  readonly params: Record<string, unknown>;
  /** 教学步骤：课堂讲解顺序的短句，不含可执行内容。 */
  readonly steps: readonly string[];
  /**
   * 探索模式下允许改动的题设字段（对平抛题为 ['h','u','g']）。
   * t 不列入：时间 scrub 在两种模式下都允许，且不算题设修改。
   */
  readonly editableParams: readonly string[];
}
