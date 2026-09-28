import type { QuestionInstance } from './types.js';

/** 冻结实例及其内部字段：目录是共享不可变数据，运行态各会话自持。 */
function freezeInstance(q: QuestionInstance): QuestionInstance {
  return Object.freeze({
    ...q,
    params: Object.freeze({ ...q.params }),
    steps: Object.freeze(q.steps.slice()),
    editableParams: Object.freeze(q.editableParams.slice()),
  });
}

const TEMPLATE = { templateId: 'horizontal-projectile', templateVersion: 1 } as const;

/**
 * 平抛原创小题三则：同一 horizontal-projectile@1 模板、不同教学目标。
 * 全部为本项目自编示例，数值手算可核对（T=√(2h/g)，R=uT，v=(u,−gt)）。
 */
export const PROJECTILE_QUESTIONS: readonly QuestionInstance[] = Object.freeze([
  freezeInstance({
    ...TEMPLATE,
    id: 'q-landing-time',
    title: '平抛落地时间',
    source: '原创示例（pisvis 自编，不引自任何教辅）',
    goal: '由高度求落地时间 T=√(2h/g)：h=45 m、g=10 m/s² → T=3 s',
    params: { h: 45, u: 10, g: 10, t: 0 },
    steps: [
      '读题：小球自 h=45 m 处以 u=10 m/s 水平抛出，g=10 m/s²',
      '竖直方向是自由落体：h=gT²/2，解出 T=√(2h/g)=3 s',
      '把 t 拖到 3，看小球落在 (30, 0)，顺手核对 R=uT=30 m',
    ],
    editableParams: ['h', 'u', 'g'],
  }),
  freezeInstance({
    ...TEMPLATE,
    id: 'q-range',
    title: '平抛水平射程',
    source: '原创示例（pisvis 自编，不引自任何教辅）',
    goal: '由高度与初速度求水平射程：T=√(2h/g)=2 s，R=uT=15×2=30 m',
    params: { h: 20, u: 15, g: 10, t: 0 },
    steps: [
      '读题：h=20 m、u=15 m/s、g=10 m/s²，求水平射程',
      '先求飞行时间 T=√(2h/g)=2 s，射程只在这一步用到 h',
      '水平方向匀速：R=uT=30 m；拖 t 看落点读数',
    ],
    editableParams: ['h', 'u', 'g'],
  }),
  freezeInstance({
    ...TEMPLATE,
    id: 'q-velocity-decompose',
    title: '某时刻速度分解',
    source: '原创示例（pisvis 自编，不引自任何教辅）',
    goal: '把 t=1 s 的速度正交分解：vx=u=10 m/s，vy=−gt=−10 m/s，v=(10,−10)',
    params: { h: 20, u: 10, g: 10, t: 1 },
    steps: [
      '读题：h=20 m、u=10 m/s、g=10 m/s²，求 t=1 s 时速度的分量',
      '水平分量不变：vx=u=10 m/s；竖直分量 vy=−gt=−10 m/s',
      '看图中 v 与 vx、vy 虚线箭头：分量合成即合速度，|v|=10√2 m/s',
    ],
    editableParams: ['h', 'u', 'g'],
  }),
]);
