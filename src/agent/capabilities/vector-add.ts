import * as v from 'valibot';
import { toJsonSchema } from '@valibot/to-json-schema';
import { add, magnitude } from '../../math/vec2.js';
import type { Vec2 } from '../../math/vec2.js';
import type { SceneItem } from '../../render/scene.js';
import type { CapabilityDefinition, SceneDocument } from '../types.js';
import { axesRange } from './axes.js';
import { labelSchema, labelStyle, pointSchema } from './fields.js';

const paramsSchema = v.strictObject({
  a: pointSchema,
  b: pointSchema,
  labels: v.optional(v.strictObject({
    a: v.optional(labelSchema),
    b: v.optional(labelSchema),
    r: v.optional(labelSchema),
  })),
});
type VectorAddParams = v.InferOutput<typeof paramsSchema>;

// finite() has no JSON Schema equivalent — export keeps runtime-only checks in
// `constraints` instead of silently dropping them (see the capability record).
const paramsJsonSchema = toJsonSchema(paramsSchema, { errorMode: 'ignore' }) as Record<string, unknown>;

const ZERO: Vec2 = { x: 0, y: 0 };

function derive(params: Record<string, unknown>): Record<string, unknown> {
  const p = params as unknown as VectorAddParams;
  const r = add(p.a, p.b);
  const rLength = magnitude(r);
  const rDirection = rLength === 0
    ? null
    : { radians: Math.atan2(r.y, r.x), degrees: (Math.atan2(r.y, r.x) * 180) / Math.PI };
  return { r, rLength, rDirection } satisfies Record<string, unknown>;
}

function scene(
  params: Record<string, unknown>,
  derived: Record<string, unknown>,
  _presentation: SceneDocument['presentation'],
): SceneItem[] {
  const p = params as unknown as VectorAddParams;
  const r = derived['r'] as Vec2;
  const labelA = p.labels?.a ?? 'A';
  const labelB = p.labels?.b ?? 'B';
  const labelR = p.labels?.r ?? 'R';
  // one tick of negative headroom: O sits +16px under the x axis, B′ mid
  // labels can dip below too — mirrors the hand-padded ranges in gallery.ts
  const { minX, maxX, minY, maxY, tick } = axesRange([ZERO, p.a, p.b, r], 1);
  return [
    { kind: 'axes', id: 'ax', x: [minX, maxX], y: [minY, maxY], tick, grid: true },
    {
      kind: 'arrow', id: 'a', role: 'input', from: ZERO, to: p.a,
      label: { text: labelA, anchor: 'end', style: labelStyle(labelA) },
    },
    {
      kind: 'arrow', id: 'b', role: 'input', from: ZERO, to: p.b,
      label: { text: labelB, anchor: 'end', style: labelStyle(labelB) },
    },
    {
      kind: 'arrow', id: 'bt', role: 'guide', from: p.a, to: r, dashed: true,
      label: { text: 'B′', anchor: 'mid', style: 'variable' },
    },
    { kind: 'segment', id: 'para', role: 'guide', from: p.b, to: r, dashed: true },
    {
      kind: 'arrow', id: 'r', role: 'derived', from: ZERO, to: r, state: 'readonly',
      label: { text: labelR, anchor: 'end', style: labelStyle(labelR) },
    },
    {
      kind: 'point', id: 'o', role: 'component', at: ZERO,
      label: { text: 'O', anchor: 'start', offsetPx: { x: 0, y: 16 }, style: 'variable' },
    },
  ];
}

function fitPoints(params: Record<string, unknown>, derived: Record<string, unknown>): Vec2[] {
  const p = params as unknown as VectorAddParams;
  const r = derived['r'] as Vec2;
  const range = axesRange([ZERO, p.a, p.b, r], 1);
  return [
    ZERO, p.a, p.b, r,
    { x: range.minX, y: range.minY }, { x: range.maxX, y: range.maxY },
  ];
}

export const vectorAddV1: CapabilityDefinition = Object.freeze({
  id: 'vector-add',
  version: 1,
  title: '向量合成（平行四边形）',
  summary: '两个从原点出发的向量 A、B 按平行四边形法则合成：B′ 平移到 A 末端、对边用虚线段表示，合向量 R=A+B 以只读派生箭头显示。',
  goodFor: ['向量加法示意', '平行四边形/三角形法则', '两位移或分量的合成'],
  notFor: ['受力分析与力的物理判定', '三个及以上向量', '真实物理单位'],
  keywords: {
    zh: ['向量合成', '平行四边形', '合向量', '位移合成', '向量加法'],
    en: ['vector addition', 'resultant', 'parallelogram', 'vector sum'],
  },
  kind: 'math-diagram',
  available: true,
  outputs: ['scene-json', 'svg', 'report'] as const,
  runtime: 'Node >=22.12 或现代浏览器；无需 DOM',
  unit: 'dimensionless',
  coordinates: '世界坐标：x 向右、y 向上；与 SVG 像素分离；a、b 为从原点出发的位置向量',
  assumptions: ['无量纲数学示意，不能据此保证受力分析或力的合成正确'],
  paramsSchema,
  paramsJsonSchema,
  writable: ['a', 'b', 'labels'],
  derivedFields: ['r', 'rLength', 'rDirection'],
  operations: ['set-a', 'set-b', 'set-labels', 'set-theme', 'set-canvas', 'set-viewport'],
  constraints: [
    'a/b 坐标必须为有限数，|x|、|y| ≤ 1e6（含 Infinity/NaN 检查，JSON Schema 无法表达 finite，由运行时校验）',
    'labels 可只给部分键（如 {a: "α"}），未给键保留原值；每个标签 ≤ 200 字符且不含控制字符',
    'B′ 与原点 O 标签固定；a=−b 时合向量为零向量（rDirection 为 null，渲染为零向量标记）',
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
      templateId: 'vector-add', templateVersion: 1,
      params: { a: { x: 2, y: 1 }, b: { x: 0.5, y: 1.8 } },
    },
    variant: {
      document: {
        schemaVersion: 1, instanceId: 'vector-add-example',
        templateId: 'vector-add', templateVersion: 1, unit: 'dimensionless',
        params: { a: { x: 2, y: 1 }, b: { x: 0.5, y: 1.8 } },
        presentation: {
          theme: { id: 'illustrated', version: 2 },
          canvas: { width: 640, height: 360 },
          viewport: { mode: 'fit' },
        },
      },
      operations: [
        { op: 'set-b', value: { x: -1, y: 0.5 } },
        { op: 'set-labels', value: { r: 'R合' } },
      ],
    },
    failure: {
      request: {
        templateId: 'vector-add', templateVersion: 1,
        params: { a: { x: 1, y: 1 } },
      },
      expectedCode: 'missing-field' as const,
      fix: '补上 params.b，例如 {x: 0.5, y: 1.8}；用 describe 查看完整 params Schema',
    },
  },
  derive: (p: Record<string, unknown>) => derive(p),
  scene,
  fitPoints,
});
