#!/usr/bin/env node
// pisvis MCP stdio server — thin adapter over the authoring API.
// stdout carries the MCP protocol only (the transport owns it); logs go to stderr.
// Stateless: every tools/call is an independent request to the same pure API.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as v from 'valibot';
import { toStandardJsonSchema } from '@valibot/to-json-schema';
import { authoring } from '../agent.js';
import type { AuthoringApi } from '../agent.js';

const SVG_INLINE_LIMIT = 64 * 1024;

const idString = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]{0,63}$/));
const documentShape = v.looseObject({}); // the API owns full document validation
const sceneResultShape = v.looseObject({ ok: v.boolean() });

const TOOLS = [
  {
    name: 'pisvis_list_capabilities',
    title: '列出可用能力 · List capabilities',
    description: '返回当前可调用的可视化能力精简目录（无图像内容）。可按 keyword/kind 过滤。Lists the callable capability catalog.',
    inputSchema: v.strictObject({
      keyword: v.optional(v.string()),
      kind: v.optional(v.string()),
    }),
    call: (api: AuthoringApi, args: { keyword?: string; kind?: string }) =>
      api.listCapabilities(args),
  },
  {
    name: 'pisvis_describe_capability',
    title: '查看能力详情 · Describe capability',
    description: '返回指定能力/版本的输入输出 Schema、范围、默认值、例子与允许的修改操作。Requires exact id + version.',
    inputSchema: v.strictObject({ id: idString, version: v.pipe(v.number(), v.integer()) }),
    call: (api: AuthoringApi, args: { id: string; version: number }) =>
      api.describeCapability(args),
  },
  {
    name: 'pisvis_create_scene',
    title: '创建场景 · Create scene',
    description: '从注册能力与参数生成规范化场景文档、派生值与检查状态。Creates a normalized scene document.',
    inputSchema: v.strictObject({
      templateId: idString,
      templateVersion: v.pipe(v.number(), v.integer()),
      params: documentShape,
      presentation: v.optional(documentShape),
      instanceId: v.optional(idString),
    }),
    call: (api: AuthoringApi, args: Record<string, unknown>) => api.createScene(args as never),
  },
  {
    name: 'pisvis_validate_scene',
    title: '校验场景文档 · Validate document',
    description: '校验场景文档并返回规范化副本与诊断，不写任何状态。Validates a scene document, writes nothing.',
    inputSchema: v.strictObject({ document: documentShape }),
    call: (api: AuthoringApi, args: { document: unknown }) => api.validateScene(args),
  },
  {
    name: 'pisvis_update_scene',
    title: '修改场景 · Update scene',
    description: '对文档执行该能力在 describe 中声明的白名单修改操作；全成功或全失败。Capability-specific whitelisted ops from describe, all-or-nothing.',
    inputSchema: v.strictObject({
      document: documentShape,
      operations: v.array(v.strictObject({ op: v.string(), value: v.optional(v.unknown()) })),
    }),
    call: (api: AuthoringApi, args: { document: unknown; operations: readonly { op: string; value?: unknown }[] }) =>
      api.updateScene(args),
  },
  {
    name: 'pisvis_render_scene',
    title: '渲染 SVG · Render scene',
    description: '从已校验文档输出自包含样式的 SVG（≤64 KiB 内联返回；更大时返回 render-too-large）。Renders a self-contained standalone SVG.',
    inputSchema: v.strictObject({ document: documentShape }),
    call: (api: AuthoringApi, args: { document: unknown }) => api.renderScene(args),
  },
] as const;

function summaryOf(result: Record<string, unknown>): string {
  const e0 = (result['errors'] as readonly { code: string; path: string; message: string }[] | undefined)?.[0];
  if (e0 !== undefined) {
    return `失败 ${e0.code}${e0.path ? ` @ ${e0.path}` : ''}：${e0.message}`;
  }
  const derived = result['derived'] as Record<string, unknown> | undefined;
  const doc = result['document'] as { instanceId?: string } | undefined;
  if (derived !== undefined) {
    return `ok · ${doc?.instanceId ?? ''} · length=${String(derived['length'] ?? '')}`;
  }
  const items = result['items'] as readonly unknown[] | undefined;
  if (items !== undefined) return `ok · ${items.length} 项能力`;
  return 'ok';
}

function toToolResult(result: Record<string, unknown>) {
  const text = summaryOf(result);
  const svg = typeof result['svg'] === 'string' ? (result['svg'] as string) : null;
  const content: { type: 'text'; text: string }[] = [{ type: 'text', text }];
  if (result['ok'] === false) {
    return { isError: true, content, structuredContent: result };
  }
  if (svg !== null) content.push({ type: 'text', text: svg });
  return { content, structuredContent: result };
}

/** Renders through the API, enforcing the 64 KiB inline cap as a domain error. */
function renderCapped(api: AuthoringApi, document: unknown): Record<string, unknown> {
  const r = api.renderScene({ document }) as unknown as Record<string, unknown>;
  if (r.ok === true && Number(r.bytes) > SVG_INLINE_LIMIT) {
    return {
      ok: false,
      errors: [{
        code: 'too-large', path: 'document',
        message: `SVG 超过 ${SVG_INLINE_LIMIT / 1024} KiB 内联上限（${r.bytes} 字节）`,
        hint: '用 CLI render 输出到文件，或缩小画布 canvas',
      }],
      checks: { structure: 'passed', math: 'passed', physics: 'not_applicable', visual: 'not_run' },
    };
  }
  return r;
}

/** Build an MCP server instance from any AuthoringApi — registry agnostic. */
export function createMcpServer(api: AuthoringApi): McpServer {
  const server = new McpServer({ name: 'pisvis', version: '0.0.0' });
  for (const tool of TOOLS) {
    server.registerTool(tool.name, {
      title: tool.title,
      description: tool.description,
      inputSchema: toStandardJsonSchema(tool.inputSchema),
      outputSchema: toStandardJsonSchema(sceneResultShape),
    }, async (args: unknown) => {
      const result = tool.name === 'pisvis_render_scene'
        ? renderCapped(api, (args as { document: unknown }).document)
        : (tool.call as (a: AuthoringApi, args: unknown) => Record<string, unknown>)(api, args);
      return toToolResult(result as Record<string, unknown>);
    });
  }
  return server;
}

// started directly or through a bin symlink (npx resolves .bin/pisvis-mcp to this file)
const isMain = process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const server = createMcpServer(authoring);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('pisvis-mcp: stdio server ready\n');
}
