import * as v from 'valibot';
import { toJsonSchema } from '@valibot/to-json-schema';
import { scale, vec2 } from '../../math/vec2.js';
import type { Vec2 } from '../../math/vec2.js';
import {
  flightRange, flightTime, landingSpeed, midpointX, stateAt, trajectoryPoints,
} from '../../models/projectile.js';
import type { SceneItem } from '../../render/scene.js';
import type { CapabilityDefinition, SceneDocument } from '../types.js';
import { axesRange } from './axes.js';

// shared with projectile-speed-graph so both views stay on identical bounds
export const projectileParamsSchema = v.strictObject({
  // editor bounds (product scope, not physical limits) — model card §4
  h: v.pipe(v.number(), v.finite(), v.gtValue(0), v.maxValue(100)),
  u: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(40)),
  g: v.pipe(v.number(), v.finite(), v.minValue(1), v.maxValue(20)),
  // t <= T is a cross-field bound and lives in physicsCheck instead
  t: v.optional(v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1e6)), 0),
});
type ProjectileParams = v.InferOutput<typeof projectileParamsSchema>;

const paramsJsonSchema = toJsonSchema(projectileParamsSchema, { errorMode: 'ignore' }) as Record<string, unknown>;

const T_EPS = 1e-9;
const TRAJ_SEGMENTS = 48;

function derive(params: Record<string, unknown>): Record<string, unknown> {
  const p = params as unknown as ProjectileParams;
  const s = stateAt(p);
  const T = flightTime(p.h, p.g);
  const R = flightRange(p.u, p.h, p.g);
  return {
    position: s.position,
    velocity: s.velocity,
    speed: s.speed,
    alphaDeg: s.alphaDeg,
    displacement: s.displacement,
    displacementLength: s.displacementLength,
    thetaDeg: s.thetaDeg,
    landed: s.landed,
    T,
    R,
    landingSpeed: landingSpeed(p.u, p.h, p.g),
    midpointX: midpointX(p),
  } satisfies Record<string, unknown>;
}

function scene(
  params: Record<string, unknown>,
  derived: Record<string, unknown>,
  _presentation: SceneDocument['presentation'],
): SceneItem[] {
  const p = params as unknown as ProjectileParams;
  const P = derived['position'] as Vec2;
  const velocity = derived['velocity'] as Vec2;
  const T = derived['T'] as number;
  const R = derived['R'] as number;
  const vT = derived['landingSpeed'] as number;
  const midX = derived['midpointX'] as number | null;
  const launch = vec2(0, p.h);

  const land = vec2(R, 0);
  // shared velocity display scale: arrows are drawn in world units, so the
  // landing-speed arrow spans 34% of the scene's largest dimension — one k
  // for v, vx, vy keeps their relative lengths truthful across time
  const k = (0.34 * Math.max(R, p.h, 1)) / vT;
  const vd = scale(velocity, k);
  const vTip = vec2(P.x + vd.x, P.y + vd.y);
  const vxTip = vec2(P.x + velocity.x * k, P.y);
  const vyTip = vec2(P.x, P.y + velocity.y * k);
  const extEnd = midX !== null && midX > 0 ? vec2(midX, p.h) : null;

  const fit = [
    launch, land, P, vTip, vxTip, vyTip,
    ...(extEnd !== null ? [extEnd] : []),
  ];
  const { minX, maxX, minY, maxY, tick } = axesRange(fit, 1);

  // the 轨迹 label rides on whichever half of the path is longer — the other
  // half is too short to label without crowding the ball/landing labels
  const doneLong = p.t > T / 2;
  const trajLabel = { text: '轨迹', anchor: 'mid' as const, style: 'text' as const };
  const items: SceneItem[] = [
    { kind: 'axes', id: 'ax', x: [minX, maxX], y: [minY, maxY], tick, grid: true },
  ];
  if (p.t > T_EPS) {
    items.push({
      kind: 'path', id: 'traj-done', role: 'guide',
      points: trajectoryPoints(p.h, p.u, p.g, 0, Math.min(p.t, T), TRAJ_SEGMENTS),
      ...(doneLong ? { label: trajLabel } : {}),
    });
  }
  if (p.t < T - T_EPS) {
    items.push({
      kind: 'path', id: 'traj-todo', role: 'guide', dashed: true,
      points: trajectoryPoints(p.h, p.u, p.g, Math.min(p.t, T), T, TRAJ_SEGMENTS),
      ...(doneLong ? {} : { label: trajLabel }),
    });
  }
  items.push(
    {
      kind: 'point', id: 'o', role: 'component', at: launch,
      label: { text: 'O', anchor: 'mid', offsetPx: { x: -4, y: -2 }, style: 'variable' },
    },
    {
      kind: 'point', id: 'land', role: 'component', at: land,
      label: { text: '落点', anchor: 'mid', offsetPx: { x: 0, y: 60 }, style: 'text' },
    },
  );
  if (extEnd !== null) {
    items.push({ kind: 'segment', id: 'ext', role: 'guide', from: P, to: extEnd, dashed: true });
  }
  items.push(
    {
      kind: 'point', id: 'ball', role: 'input', at: P,
      label: { text: 'P', anchor: 'mid', offsetPx: { x: 8, y: -10 }, style: 'variable' },
    },
    {
      kind: 'arrow', id: 'v', role: 'derived', from: P, to: vTip, state: 'readonly',
      label: { text: 'v', anchor: 'end', style: 'variable' },
    },
  );
  // a component that equals v would redraw the exact same arrow — show the
  // zero sibling's marker instead and let v carry the direction
  if (Math.abs(velocity.x) > T_EPS && Math.abs(velocity.y) > T_EPS) {
    items.push(
      {
        kind: 'arrow', id: 'vx', role: 'component', from: P, to: vxTip, dashed: true,
        label: { text: 'vx', anchor: 'mid', offsetPx: { x: 10, y: -48 }, style: 'variable' },
      },
      {
        kind: 'arrow', id: 'vy', role: 'component', from: P, to: vyTip, dashed: true,
        label: { text: 'vy', anchor: 'mid', offsetPx: { x: -2, y: 0 }, style: 'variable' },
      },
    );
  } else if (Math.abs(velocity.x) <= T_EPS) {
    items.push({
      kind: 'arrow', id: 'vx', role: 'component', from: P, to: vxTip,
      label: { text: 'vx', anchor: 'end', style: 'variable' },
    });
  } else {
    items.push({
      kind: 'arrow', id: 'vy', role: 'component', from: P, to: vyTip,
      label: { text: 'vy', anchor: 'mid', offsetPx: { x: -4, y: 20 }, style: 'variable' },
    });
  }
  return items;
}

function fitPoints(params: Record<string, unknown>, derived: Record<string, unknown>): Vec2[] {
  const p = params as unknown as ProjectileParams;
  const P = derived['position'] as Vec2;
  const velocity = derived['velocity'] as Vec2;
  const R = derived['R'] as number;
  const vT = derived['landingSpeed'] as number;
  const midX = derived['midpointX'] as number | null;
  const k = (0.34 * Math.max(R, p.h, 1)) / vT;
  const vd = scale(velocity, k);
  const pts = [
    vec2(0, p.h), vec2(R, 0), P,
    vec2(P.x + vd.x, P.y + vd.y),
    vec2(P.x + velocity.x * k, P.y),
    vec2(P.x, P.y + velocity.y * k),
    ...(midX !== null && midX > 0 ? [vec2(midX, p.h)] : []),
  ];
  const range = axesRange(pts, 1);
  return [
    ...pts,
    { x: range.minX, y: range.minY }, { x: range.maxX, y: range.maxY },
  ];
}

export const horizontalProjectileV1: CapabilityDefinition = Object.freeze({
  id: 'horizontal-projectile',
  version: 1,
  title: '平抛运动（水平抛出）',
  summary: '从高度 h 以水平初速度 u 抛出的小球：x=ut、y=h−gt²/2，恒定 g、忽略空气阻力。渲染抛出点、参数化轨迹（已过段实线/未过段虚线）、t 时刻位置 P 与速度 v 及分量 vx、vy。',
  goodFor: ['平抛运动示意', '速度正交分解与轨迹/落点读数', '落地时间、水平距离、某时刻速度'],
  notFor: ['斜抛/竖直上抛等其他抛体', '含空气阻力或变化重力', '弹跳或穿地后的运动', '受力分析题'],
  keywords: {
    zh: ['平抛', '平抛运动', '抛体', '水平抛出', '落地时间', '射程', '速度分解'],
    en: ['horizontal projectile', 'projectile motion', 'trajectory', 'time of flight'],
  },
  kind: 'physics-model',
  available: true,
  outputs: ['scene-json', 'svg', 'report'] as const,
  runtime: 'Node >=22.12 或现代浏览器；无需 DOM',
  unit: 'si',
  coordinates: '世界坐标：x 向右、y 向上（m）；抛出点 (0,h)、落点 (R,0)；v/vx/vy 箭头锚在小球位置 P，长度按显示比例 k 换算',
  assumptions: [
    '恒定重力 g 竖直向下，忽略空气阻力，水平地面 y=0，小球视为质点',
    't>T 不计算穿地运动；本模板不覆盖斜抛、竖直上抛或弹跳',
  ],
  paramsSchema: projectileParamsSchema,
  paramsJsonSchema,
  writable: ['h', 'u', 'g', 't'],
  derivedFields: [
    'position', 'velocity', 'speed', 'alphaDeg', 'thetaDeg',
    'displacement', 'displacementLength', 'landed',
    'T', 'R', 'landingSpeed', 'midpointX',
  ],
  operations: ['set-h', 'set-u', 'set-g', 'set-t', 'set-theme', 'set-canvas', 'set-viewport'],
  constraints: [
    '单位 SI：h 用 m、u 用 m/s、g 用 m/s²、t 用 s；文档 unit 字段为 si',
    '编辑器范围（产品边界，非物理限制）：h ∈ (0,100]、u ∈ [0,40]、g ∈ [1,20]、t ≥ 0 且有限',
    't ≤ T=√(2h/g) 由 physics 阶段校验（schema 无法表达跨字段上界）；越界返回 out-of-range',
    '速度箭头共用显示比例 k = 0.34·max(R,h,1)/|v(T)|（s），k 与 t 无关，v/vx/vy 真实等比缩放；某分量与 v 重合时该分量箭头不重复绘制（零分量仍以零向量标记显示）',
    'u=0 为自由落体退化：轨迹用 t 参数化（竖直线），不调用 y∝x² 式；速度/位移为零向量时角度为 null（t=0 时 thetaDeg=null；u=0 且 t=0 时 alphaDeg 也为 null），调用方需判空',
    'O、P、v、vx、vy、轨迹、落点标签为固定构造，本轮不可改名',
    '虚线 ext 为速度反向延长线，交抛出高度线于 xP/2（例 3 不变量，可用于测试核对）',
  ],
  defaults: {
    presentation: {
      theme: { id: 'illustrated', version: 2 },
      canvas: { width: 640, height: 360 },
      viewport: { mode: 'fit' as const },
    },
  },
  examples: {
    minimal: {
      templateId: 'horizontal-projectile', templateVersion: 1,
      params: { h: 20, u: 10, g: 10, t: 1 },
    },
    variant: {
      document: {
        schemaVersion: 1, instanceId: 'horizontal-projectile-example',
        templateId: 'horizontal-projectile', templateVersion: 1, unit: 'si',
        params: { h: 20, u: 10, g: 10, t: 1 },
        presentation: {
          theme: { id: 'illustrated', version: 2 },
          canvas: { width: 640, height: 360 },
          viewport: { mode: 'fit' },
        },
      },
      operations: [
        { op: 'set-t', value: 2 },
      ],
    },
    failure: {
      request: {
        templateId: 'horizontal-projectile', templateVersion: 1,
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
  warnings: (params: Record<string, unknown>, derived: Record<string, unknown>) => {
    const p = params as unknown as ProjectileParams;
    const w: string[] = [];
    if (p.u === 0) {
      w.push('u=0 自由落体退化：轨迹为竖直直线，v_x 恒为零向量，不使用除以 u 的轨迹式');
    }
    if (derived['landed'] === true) {
      w.push(`t=${p.t} 已到飞行时间：小球落地于 (${derived['R']}, 0)`);
    }
    return w;
  },
  derive: (p: Record<string, unknown>) => derive(p),
  scene,
  fitPoints,
});
