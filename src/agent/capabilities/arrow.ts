import * as v from 'valibot';
import { toJsonSchema } from '@valibot/to-json-schema';
import { magnitude, sub } from '../../math/vec2.js';
import type { Vec2 } from '../../math/vec2.js';
import type { SceneItem } from '../../render/scene.js';
import type { CapabilityDefinition, SceneDocument } from '../types.js';
import { axesRange } from './axes.js';
import { labelSchema, labelStyle, pointSchema } from './fields.js';

const paramsSchema = v.strictObject({
  start: pointSchema,
  end: pointSchema,
  label: v.optional(labelSchema),
});
type ArrowParams = v.InferOutput<typeof paramsSchema>;

// finite() has no JSON Schema equivalent — export keeps runtime-only checks in
// `constraints` instead of silently dropping them (see the capability record).
const paramsJsonSchema = toJsonSchema(paramsSchema, { errorMode: 'ignore' }) as Record<string, unknown>;

function derive(params: Record<string, unknown>): Record<string, unknown> {
  const p = params as unknown as ArrowParams;
  const delta = sub(p.end, p.start);
  const length = magnitude(delta);
  const direction = length === 0
    ? null
    : { radians: Math.atan2(delta.y, delta.x), degrees: (Math.atan2(delta.y, delta.x) * 180) / Math.PI };
  return { delta, length, direction } satisfies Record<string, unknown>;
}

function scene(
  params: Record<string, unknown>,
  _derived: Record<string, unknown>,
  _presentation: SceneDocument['presentation'],
): SceneItem[] {
  const p = params as unknown as ArrowParams;
  const label = p.label ?? '向量';
  const { minX, maxX, minY, maxY, tick } = axesRange([p.start, p.end]);
  const items: SceneItem[] = [
    { kind: 'axes', id: 'ax', x: [minX, maxX], y: [minY, maxY], tick, grid: true },
    {
      kind: 'arrow', id: 'v', role: 'input', from: p.start, to: p.end,
      label: { text: label, anchor: 'mid', style: labelStyle(label) },
    },
  ];
  return items;
}

function fitPoints(params: Record<string, unknown>): Vec2[] {
  const p = params as unknown as ArrowParams;
  const r = axesRange([p.start, p.end]);
  return [
    p.start, p.end, { x: 0, y: 0 },
    { x: r.minX, y: r.minY }, { x: r.maxX, y: r.maxY },
  ];
}

export const arrowV1: CapabilityDefinition = Object.freeze({
  id: 'arrow',
  version: 1,
  title: '向量箭头',
  summary: '从起点到终点的二维无量纲箭头，含坐标轴、网格与标签；派生位移、长度与方向。',
  goodFor: ['向量示意', '位移/差向量展示', '坐标系内单箭头'],
  notFor: ['受力分析', '真实物理单位', '多向量组合（暂用各能力叠加说明）'],
  keywords: {
    zh: ['箭头', '向量', '位移', '坐标'],
    en: ['arrow', 'vector', 'displacement', 'coordinate'],
  },
  kind: 'math-diagram',
  available: true,
  outputs: ['scene-json', 'svg', 'report'] as const,
  runtime: 'Node >=22.12 或现代浏览器；无需 DOM',
  unit: 'dimensionless',
  coordinates: '世界坐标：x 向右、y 向上；与 SVG 像素分离',
  assumptions: ['无量纲数学示意，不能据此保证受力分析正确'],
  paramsSchema,
  paramsJsonSchema,
  writable: ['start', 'end', 'label'],
  derivedFields: ['delta', 'length', 'direction'],
  operations: ['set-start', 'set-end', 'set-label', 'set-theme', 'set-canvas', 'set-viewport'],
  constraints: [
    'start/end 坐标必须为有限数，|x|、|y| ≤ 1e6（含 Infinity/NaN 检查，JSON Schema 无法表达 finite，由运行时校验）',
    'label ≤ 200 字符且不得含控制字符',
    '端点可以重合（零向量：direction 为 null，渲染为零向量标记）',
  ],
  defaults: {
    label: '向量',
    presentation: {
      theme: { id: 'illustrated', version: 2 },
      canvas: { width: 640, height: 360 },
      viewport: { mode: 'fit' as const },
    },
  },
  examples: {
    minimal: {
      templateId: 'arrow', templateVersion: 1,
      params: { start: { x: 0, y: 0 }, end: { x: 3, y: 4 } },
    },
    variant: {
      document: {
        schemaVersion: 1, instanceId: 'arrow-example',
        templateId: 'arrow', templateVersion: 1, unit: 'dimensionless',
        params: { start: { x: 0, y: 0 }, end: { x: 3, y: 4 }, label: '向量' },
        presentation: {
          theme: { id: 'illustrated', version: 2 },
          canvas: { width: 640, height: 360 },
          viewport: { mode: 'fit' },
        },
      },
      operations: [{ op: 'set-end', value: { x: 0, y: 4 } }, { op: 'set-label', value: '位移 d' }],
    },
    failure: {
      request: {
        templateId: 'arrow', templateVersion: 1,
        params: { start: { x: 0, y: 0 } },
      },
      expectedCode: 'missing-field' as const,
      fix: '补上 params.end，例如 {x: 3, y: 4}；用 describe 查看完整 params Schema',
    },
  },
  derive: (p: Record<string, unknown>) => derive(p),
  scene,
  fitPoints: (p: Record<string, unknown>) => fitPoints(p),
});
