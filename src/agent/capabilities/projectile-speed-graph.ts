import { toJsonSchema } from '@valibot/to-json-schema';
import type * as v from 'valibot';
import { vec2 } from '../../math/vec2.js';
import type { Vec2 } from '../../math/vec2.js';
import { flightTime } from '../../models/projectile.js';
import type { SceneItem } from '../../render/scene.js';
import type { CapabilityDefinition, SceneDocument } from '../types.js';
import { tickFor } from './axes.js';
import { projectileParamsSchema } from './horizontal-projectile.js';

type ProjectileParams = v.InferOutput<typeof projectileParamsSchema>;

const paramsJsonSchema = toJsonSchema(projectileParamsSchema, { errorMode: 'ignore' }) as Record<string, unknown>;

const T_EPS = 1e-9;

interface GraphRange {
  readonly xTick: number;
  readonly yTick: number;
  readonly yMin: number;
  readonly yMax: number;
}

// The graph's world is (t, v): x is exactly the flight domain [0,T]; y covers
// [−gT, u] with a pad above (axesRange-style hi end) so the vx line and axis
// names stay off the frame edge even when u=0 and vx lies on the t axis.
// Each axis gets its own tick — seconds and m/s share no natural division.
function graphRange(p: ProjectileParams, T: number): GraphRange {
  const yTick = tickFor(Math.max(p.u + p.g * T, 1));
  return {
    xTick: tickFor(T),
    yTick,
    yMin: Math.floor((-p.g * T) / yTick) * yTick,
    yMax: Math.floor(p.u / yTick) * yTick + yTick + 0.5,
  };
}

function derive(params: Record<string, unknown>): Record<string, unknown> {
  const p = params as unknown as ProjectileParams;
  return {
    T: flightTime(p.h, p.g),
    vx: p.u,
    vy: -p.g * p.t + 0, // +0 normalizes -0 at t=0 (same rule as the model)
  } satisfies Record<string, unknown>;
}

function scene(
  params: Record<string, unknown>,
  derived: Record<string, unknown>,
  _presentation: SceneDocument['presentation'],
): SceneItem[] {
  const p = params as unknown as ProjectileParams;
  const T = derived['T'] as number;
  const { xTick, yTick, yMin, yMax } = graphRange(p, T);
  const tc = Math.min(p.t, T);
  const vxT = p.u;
  const vyT = -p.g * tc + 0; // -g·0 = -0; normalize like the model does
  const items: SceneItem[] = [
    {
      kind: 'axes', id: 'ax', x: [0, T], y: [yMin, yMax],
      xTick, yTick, xName: 't / s', yName: 'v / (m/s)', grid: true,
    },
    {
      kind: 'path', id: 'vx-line', role: 'component',
      points: [vec2(0, p.u), vec2(T, p.u)],
      label: { text: 'vx', anchor: 'mid', offsetPx: { x: 28, y: -12 }, style: 'variable' },
    },
    {
      kind: 'path', id: 'vy-line', role: 'derived',
      points: [vec2(0, 0), vec2(T, -p.g * T)],
      label: { text: 'vy', anchor: 'mid', offsetPx: { x: 34, y: 0 }, style: 'variable' },
    },
  ];
  // zero-length guides render as nothing — keep the points, drop the segment
  if (Math.abs(vxT - vyT) > T_EPS) {
    items.push({
      kind: 'segment', id: 't-cursor', role: 'guide',
      from: vec2(tc, vxT), to: vec2(tc, vyT), dashed: true,
    });
  }
  // 'mid' anchors sit above the point; push the text inward so t=0 and t=T
  // don't clip at the canvas edges.
  const inward = tc < T / 2 ? 26 : -26;
  items.push(
    {
      kind: 'point', id: 'vx-t', role: 'input', at: vec2(tc, vxT),
      label: { text: 'vx(t)', anchor: 'mid', offsetPx: { x: inward, y: -4 }, style: 'variable' },
    },
    {
      kind: 'point', id: 'vy-t', role: 'input', at: vec2(tc, vyT),
      label: { text: 'vy(t)', anchor: 'mid', offsetPx: { x: inward, y: -2 }, style: 'variable' },
    },
  );
  return items;
}

function fitPoints(params: Record<string, unknown>, derived: Record<string, unknown>): Vec2[] {
  const p = params as unknown as ProjectileParams;
  const T = derived['T'] as number;
  const tc = Math.min(p.t, T);
  const { yMin, yMax } = graphRange(p, T);
  return [
    vec2(0, p.u), vec2(T, p.u),
    vec2(0, 0), vec2(T, -p.g * T),
    vec2(tc, p.u), vec2(tc, -p.g * tc + 0),
    vec2(0, yMin), vec2(T, yMax),
  ];
}

export const projectileSpeedGraphV1: CapabilityDefinition = Object.freeze({
  id: 'projectile-speed-graph',
  version: 1,
  title: '平抛速度分量—时间图像（v–t 图）',
  summary: '同一平抛快照的第二视图：横轴为时间 t（s）、纵轴为速度分量 v（m/s），画出 vx(t)=u 水平线与 vy(t)=−gt 下降直线，t 时刻游标标出 vx(t)、vy(t) 读数。',
  goodFor: ['速度分量随时间变化的函数图', 'v–t 图读数、斜率（=−g）与面积讨论', '与 horizontal-projectile 情境图并列对照'],
  notFor: ['运动情境/轨迹图（用 horizontal-projectile）', '斜抛/含阻力等其他抛体', '受力分析题'],
  keywords: {
    zh: ['速度时间图像', 'v-t 图', '函数图', '速度分量', '平抛', '第二视图'],
    en: ['velocity-time graph', 'v(t) graph', 'function graph', 'speed graph', 'projectile'],
  },
  kind: 'physics-model',
  available: true,
  outputs: ['scene-json', 'svg', 'report'] as const,
  runtime: 'Node >=22.12 或现代浏览器；无需 DOM',
  unit: 'si',
  coordinates: '函数图坐标：横轴 t（s）向右、纵轴 v（m/s）向上；两轴独立刻度（xTick/yTick），不是等比例情境空间，不能用图内长度比物理量',
  assumptions: [
    '与 horizontal-projectile 同一模型：恒定重力 g 竖直向下、忽略空气阻力、质点',
    '只画飞行时间域 [0,T] 内的分量函数；t>T 不计算穿地运动',
  ],
  paramsSchema: projectileParamsSchema,
  paramsJsonSchema,
  writable: ['h', 'u', 'g', 't'],
  derivedFields: ['T', 'vx', 'vy'],
  operations: ['set-h', 'set-u', 'set-g', 'set-t', 'set-theme', 'set-canvas', 'set-viewport'],
  constraints: [
    '与 horizontal-projectile 共用同一 params Schema：h ∈ (0,100]、u ∈ [0,40]、g ∈ [1,20]、t ∈ [0,1e6] 有限（SI：m、m/s、m/s²、s）',
    't ≤ T=√(2h/g) 由 physics 阶段校验（schema 无法表达跨字段上界）；越界返回 out-of-range',
    '两轴量纲不同：xTick=tickFor(T)、yTick=tickFor(u+gT) 独立刻度；函数图不当运动情境图读',
    'u=0 退化：vx 线与 t 轴重合仍照常绘制（零函数即正确图像）；vx(t)=vy(t) 时省略零长游标虚线但保留两个读数点',
    'vx、vy、vx(t)、vy(t)、轴名 t / s 与 v / (m/s) 为固定构造，本轮不可改名',
  ],
  defaults: {
    presentation: {
      theme: { id: 'illustrated', version: 2 },
      canvas: { width: 640, height: 360 },
      // stretch：t 与 v 量纲不同，必须两轴独立刻度映射才读得动；
      // 图内长度不携带物理语义（情境图仍用等比例 fit）。
      viewport: { mode: 'stretch' as const },
    },
  },
  examples: {
    minimal: {
      templateId: 'projectile-speed-graph', templateVersion: 1,
      params: { h: 20, u: 10, g: 10, t: 1 },
    },
    variant: {
      document: {
        schemaVersion: 1, instanceId: 'projectile-speed-graph-example',
        templateId: 'projectile-speed-graph', templateVersion: 1, unit: 'si',
        params: { h: 20, u: 10, g: 10, t: 1 },
        presentation: {
          theme: { id: 'illustrated', version: 2 },
          canvas: { width: 640, height: 360 },
          viewport: { mode: 'stretch' },
        },
      },
      operations: [
        { op: 'set-t', value: 0.5 },
      ],
    },
    failure: {
      request: {
        templateId: 'projectile-speed-graph', templateVersion: 1,
        params: { h: 20, u: 10, g: 10, t: 5 },
      },
      expectedCode: 'out-of-range' as const,
      fix: 't 必须落在飞行时间域 [0,T]：本例 h=20、g=10 → T=√(2·20/10)=2 s，t=5 已穿地；改 set-t ≤ 2 或调 h/g/u',
    },
  },
  physicsCheck: (params: Record<string, unknown>) => {
    const p = params as unknown as ProjectileParams;
    const T = flightTime(p.h, p.g);
    if (p.t > T + T_EPS) {
      return [{
        code: 'out-of-range' as const,
        path: 'document.params.t',
        message: `时间 t 超出飞行时间域：t=${p.t} > T=${T} s（落地后不计算穿地运动）`,
        expected: `0 <= t <= ${T}`,
        hint: 'T=√(2h/g)；可 set-t 到时间域内，或先调整 h/g/u',
      }];
    }
    return [];
  },
  warnings: (params: Record<string, unknown>) => {
    const p = params as unknown as ProjectileParams;
    const w: string[] = [];
    if (p.u === 0) {
      w.push('u=0：vx≡0，vx 图线与 t 轴重合（仍是正确图像），vx(t) 读数为 0');
    }
    return w;
  },
  derive: (p: Record<string, unknown>) => derive(p),
  scene,
  fitPoints,
});
