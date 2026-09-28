import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { InMemoryTransport } from '@modelcontextprotocol/client';
import * as v from 'valibot';
import { toJsonSchema } from '@valibot/to-json-schema';
import { authoring, createAuthoringApi } from '../dist/agent.js';
import { createMcpServer } from '../dist/mcp/server.js';
import { arrowV1 } from '../dist/agent.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = join(ROOT, 'dist/mcp/server.js');
const CREATE = { templateId: 'arrow', templateVersion: 1, params: { start: { x: 0, y: 0 }, end: { x: 3, y: 4 } } };

async function withClient(fn) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [SERVER] });
  const client = new Client({ name: 'pisvis-mcp-test', version: '0.0.0' });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}
const call = (client, name, args) => client.callTool({ name, arguments: args });

test('tools/list exposes the six pisvis tools with schemas', async () => {
  await withClient(async (client) => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), [
      'pisvis_create_scene', 'pisvis_describe_capability', 'pisvis_list_capabilities',
      'pisvis_render_scene', 'pisvis_update_scene', 'pisvis_validate_scene',
    ]);
    for (const t of tools) {
      assert.ok(t.description.length > 0);
      assert.ok(t.inputSchema, `${t.name} has inputSchema`);
      assert.ok(t.outputSchema, `${t.name} has outputSchema`);
    }
  });
});

test('full flow over stdio matches direct API calls deep-equal', async () => {
  await withClient(async (client) => {
    const list = (await call(client, 'pisvis_list_capabilities', {})).structuredContent;
    assert.deepEqual(list, authoring.listCapabilities());

    const describe = (await call(client, 'pisvis_describe_capability', { id: 'arrow', version: 1 })).structuredContent;
    assert.deepEqual(describe, authoring.describeCapability({ id: 'arrow', version: 1 }));

    const created = (await call(client, 'pisvis_create_scene', CREATE)).structuredContent;
    assert.deepEqual(created, authoring.createScene(CREATE));
    assert.equal(created.derived.length, 5);

    const updated = (await call(client, 'pisvis_update_scene', {
      document: created.document,
      operations: [{ op: 'set-end', value: { x: 0, y: 4 } }],
    })).structuredContent;
    assert.equal(updated.derived.length, 4);
    assert.equal(updated.document.params.label, '向量');
    assert.deepEqual(updated.document.presentation, created.document.presentation);
    assert.equal(updated.document.instanceId, created.document.instanceId);

    const validated = (await call(client, 'pisvis_validate_scene', { document: updated.document })).structuredContent;
    assert.equal(validated.documentHash, updated.documentHash);

    const rendered = (await call(client, 'pisvis_render_scene', { document: updated.document })).structuredContent;
    const viaApi = authoring.renderScene({ document: updated.document });
    assert.deepEqual(rendered, viaApi);
    assert.equal(rendered.mimeType, 'image/svg+xml');
    assert.ok(rendered.bytes <= 64 * 1024);
    const r = await call(client, 'pisvis_render_scene', { document: updated.document });
    assert.ok(r.content.some((c) => c.type === 'text' && c.text.includes('<svg')), 'svg inline in content');
  });
});

test('domain failures come back isError with stable codes', async () => {
  await withClient(async (client) => {
    const cases = [
      ['unknown-capability', 'pisvis_create_scene', { templateId: 'nope', templateVersion: 1, params: {} }],
      ['unknown-version', 'pisvis_create_scene', { templateId: 'arrow', templateVersion: 9, params: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } }],
      ['out-of-range', 'pisvis_create_scene', { templateId: 'arrow', templateVersion: 1, params: { start: { x: 0, y: 0 }, end: { x: 2e6, y: 0 } } }],
    ];
    for (const [code, tool, args] of cases) {
      const r = await call(client, tool, args);
      assert.equal(r.isError, true, `${code}: ${JSON.stringify(r).slice(0, 200)}`);
      assert.equal(r.structuredContent.ok, false);
      assert.equal(r.structuredContent.errors[0].code, code);
    }
    const uv = await call(client, 'pisvis_create_scene', cases[1][2]);
    assert.deepEqual(uv.structuredContent.errors[0].allowedValues, [1]);
    const doc = (await call(client, 'pisvis_create_scene', CREATE)).structuredContent.document;
    const ro = await call(client, 'pisvis_update_scene', { document: doc, operations: [{ op: 'set-length', value: 9 }] });
    assert.equal(ro.isError, true);
    assert.equal(ro.structuredContent.errors[0].code, 'readonly-field');
  });
});

test('stdout carries only JSON-RPC — no log pollution', async () => {
  const proc = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '';
  proc.stdout.on('data', (d) => { out += d; });
  const send = (o) => proc.stdin.write(JSON.stringify(o) + '\n');
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'probe', version: '0' } } });
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  proc.kill('SIGTERM');
  await new Promise((resolve) => proc.on('close', resolve));
  const lines = out.split('\n').filter((l) => l.trim() !== '');
  assert.ok(lines.length >= 2, 'got responses');
  for (const line of lines) {
    const msg = JSON.parse(line);
    assert.equal(msg.jsonrpc, '2.0', `non-JSON-RPC line: ${line.slice(0, 80)}`);
  }
  const init = JSON.parse(lines[0]);
  assert.equal(init.result.protocolVersion, '2025-11-25');
});

test('a test-only registry flows through MCP tools unchanged', async () => {
  const pointSchema = v.strictObject({
    at: v.strictObject({ x: v.pipe(v.number(), v.finite()), y: v.pipe(v.number(), v.finite()) }),
  });
  const testCap = {
    id: 'test-dot', version: 1, title: '测试点', summary: 'test only',
    goodFor: [], notFor: [], keywords: { zh: [], en: [] },
    kind: 'math-diagram', available: true,
    outputs: ['scene-json', 'svg', 'report'],
    runtime: 'test', unit: 'dimensionless',
    coordinates: 'x 右 y 上', assumptions: ['无量纲数学示意，不能据此保证受力分析正确'],
    paramsSchema: pointSchema,
    paramsJsonSchema: toJsonSchema(pointSchema, { errorMode: 'ignore' }),
    writable: ['at'], derivedFields: ['diag'], operations: ['set-at'],
    constraints: ['test'], defaults: { presentation: arrowV1.defaults.presentation },
    examples: { minimal: {}, variant: {}, failure: { request: {}, expectedCode: 'invalid-type', fix: 'x' } },
    derive: (p) => ({ diag: Math.hypot(p.at.x, p.at.y) }),
    scene: (p) => [{ kind: 'point', id: 'p', role: 'input', at: p.at }],
    fitPoints: (p) => [p.at, { x: 0, y: 0 }],
  };
  const api = createAuthoringApi([testCap]);
  const server = createMcpServer(api);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'probe', version: '0' });
  await client.connect(clientSide);
  try {
    const r = await call(client, 'pisvis_create_scene', {
      templateId: 'test-dot', templateVersion: 1, params: { at: { x: 3, y: 4 } },
    });
    assert.equal(r.structuredContent.ok, true);
    assert.equal(r.structuredContent.derived.diag, 5);
  } finally {
    await client.close();
    await server.close();
  }
});
