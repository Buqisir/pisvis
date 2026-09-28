import * as v from 'valibot';
import { toJsonSchema } from '@valibot/to-json-schema';
import { magnitude } from '../../math/vec2.js';
import type { Vec2 } from '../../math/vec2.js';
import type { SceneItem } from '../../render/scene.js';
import type { CapabilityDefinition, SceneDocument } from '../types.js';
import { axesRange } from './axes.js';
import { labelSchema, labelStyle, pointSchema } from './fields.js';

const paramsSchema = v.strictObject({
  v: pointSchema,
  label: v.optional(labelSchema),
});
type VectorDecomposeParams = v.InferOutput<typeof paramsSchema>;

// finite() has no JSON Schema equivalent — export keeps runtime-only checks in
// `constraints` instead of silently dropping them (see the capability record).
const paramsJsonSchema = toJsonSchema(paramsSchema, { errorMode: 'ignore' }) as Record<string, unknown>;

const ZERO: Vec2 = { x: 0, y: 0 };

function derive(params: Record<string, unknown>): Record<string, unknown> {
  const p = params as unknown as VectorDecomposeParams;
  const vx: Vec2 = { x: p.v.x, y: 0 };
  const vy: Vec2 = { x: 0, y: p.v.y };
  const length = magnitude(p.v);
  const direction = length === 0
    ? null
    : { radians: Math.atan2(p.v.y, p.v.x), degrees: (Math.atan2(p.v.y, p.v.x) * 180) / Math.PI };
  return { vx, vy, length, direction } satisfies Record<string, unknown>;
}

function scene(
  params: Record<string, unknown>,
  derived: Record<string, unknown>,
  _presentation: SceneDocument['presentation'],
): SceneItem[] {
  const p = params as unknown as VectorDecomposeParams;
  const vx = derived['vx'] as Vec2;
  const vy = derived['vy'] as Vec2;
  const label = p.label ?? 'V';
  // one tick of negative headroom: Vx/Vy labels offset below/left of the axes
  // (mirrors the hand-padded ranges in gallery.ts dec-*)
  const { minX, maxX, minY, maxY, tick } = axesRange([ZERO, p.v, vx, vy], 1);
  return [
    { kind: 'axes', id: 'ax', x: [minX, maxX], y: [minY, maxY], tick, grid: true },
    {
      kind: 'arrow', id: 'v', role: 'input', from: ZERO, to: p.v,
      label: { text: label, anchor: 'end', style: labelStyle(label) },
    },
    {
      kind: 'arrow', id: 'vx', role: 'component', from: ZERO, to: vx, dashed: true,
      label: { text: 'Vx', anchor: 'mid', offsetPx: { x: 0, y: 20 }, style: 'variable' },
    },
    {
      kind: 'arrow', id: 'vy', role: 'component', from: ZERO, to: vy, dashed: true,
      label: { text: 'Vy', anchor: 'mid', offsetPx: { x: 0, y: 26 }, style: 'variable' },
    },
    { kind: 'segment', id: 'gx', role: 'guide', from: p.v, to: vx, dashed: true },
    { kind: 'segment', id: 'gy', role: 'guide', from: p.v, to: vy, dashed: true },
    {
      kind: 'point', id: 'o', role: 'component', at: ZERO,
      label: { text: 'O', anchor: 'start', offsetPx: { x: 0, y: 16 }, style: 'variable' },
    },
  ];
}

function fitPoints(params: Record<string, unknown>, derived: Record<string, unknown>): Vec2[] {
  const p = params as unknown as VectorDecomposeParams;
  const vx = derived['vx'] as Vec2;
  const vy = derived['vy'] as Vec2;
  const range = axesRange([ZERO, p.v, vx, vy], 1);
  return [
    ZERO, p.v, vx, vy,
    { x: range.minX, y: range.minY }, { x: range.maxX, y: range.maxY },
  ];
}

export const vectorDecomposeV1: CapabilityDefinition = Object.freeze({
  id: 'vector-decompose',
  version: 1,
  title: '向量正交分解',
  summary: '把从原点出发的向量 V 正交分解到两条坐标轴：分量 Vx、Vy 以虚线分量箭头显示，V 末端与两分量用辅助虚线连成矩形。',
  goodFor: ['正交分解示意', '分量与合向量的关系', '向量在坐标轴上的投影'],
  notFor: ['沿任意方向（非正交）分解', '受力分析', '真实物理单位'],
  keywords: {
    zh: ['正交分解', '分量', '投影', '向量分解', '坐标轴'],
    en: ['decompose', 'components', 'projection', 'orthogonal', 'vector'],
  },
  kind: 'math-diagram',
  available: true,
  outputs: ['scene-json', 'svg', 'report'] as const,
  runtime: 'Node >=22.12 或现代浏览器；无需 DOM',
  unit: 'dimensionless',
  coordinates: '世界坐标：x 向右、y 向上；与 SVG 像素分离；v 为从原点出发的位置向量',
  assumptions: ['无量纲数学示意，不能据此保证受力分析正确'],
  paramsSchema,
  paramsJsonSchema,
  writable: ['v', 'label'],
  derivedFields: ['vx', 'vy', 'length', 'direction'],
  operations: ['set-v', 'set-label', 'set-theme', 'set-canvas', 'set-viewport'],
  constraints: [
    'v 坐标必须为有限数，|x|、|y| ≤ 1e6（含 Infinity/NaN 检查，JSON Schema 无法表达 finite，由运行时校验）',
    'label ≤ 200 字符且不得含控制字符；分量 Vx/Vy 与原点 O 标签固定',
    'v 在坐标轴上时相应分量为零向量；v=0 时方向为 null（渲染为零向量标记）',
  ],
  defaults: {
    label: 'V',
    presentation: {
      theme: { id: 'illustrated', version: 2 },
      canvas: { width: 640, height: 360 },
      viewport: { mode: 'fit' as const },
    },
  },
  examples: {
    minimal: {
      templateId: 'vector-decompose', templateVersion: 1,
      params: { v: { x: 2.4, y: 1.6 } },
    },
    variant: {
      document: {
        schemaVersion: 1, instanceId: 'vector-decompose-example',
        templateId: 'vector-decompose', templateVersion: 1, unit: 'dimensionless',
        params: { v: { x: 2.4, y: 1.6 }, label: 'V' },
        presentation: {
          theme: { id: 'illustrated', version: 2 },
          canvas: { width: 640, height: 360 },
          viewport: { mode: 'fit' },
        },
      },
      operations: [
        { op: 'set-v', value: { x: -1.5, y: 2 } },
        { op: 'set-label', value: 'F' },
      ],
    },
    failure: {
      request: {
        templateId: 'vector-decompose', templateVersion: 1,
        params: {},
      },
      expectedCode: 'missing-field' as const,
      fix: '补上 params.v，例如 {x: 2.4, y: 1.6}；用 describe 查看完整 params Schema',
    },
  },
  derive: (p: Record<string, unknown>) => derive(p),
  scene,
  fitPoints,
});
