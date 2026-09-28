// npm pack -> install into a throwaway consumer project OUTSIDE the repo
// (path with spaces) -> verify the package actually works for an Agent:
// bins, pisvis/agent import, skill files, llms.txt, relative doc links.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORK = mkdtempSync(join(tmpdir(), 'pisvis pack test '));
const fail = (m) => { console.error(`FAIL ${m}`); rmSync(WORK, { recursive: true, force: true }); process.exit(1); };
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: opts.cwd ?? WORK, encoding: 'utf8', env: opts.env }).trim();

try {
  // 1. pack
  const out = run('npm', ['pack', '--pack-destination', WORK], { cwd: ROOT });
  const tarball = join(WORK, out.split('\n').pop());
  if (!existsSync(tarball)) fail(`npm pack output ${out}`);
  const bytes = statSync(tarball).size;
  console.log(`tarball ${out.split('/').pop()} ${bytes} bytes`);

  // 2. consumer project (path contains a space)
  const consumer = join(WORK, 'consumer dir');
  mkdirSync(consumer, { recursive: true });
  run('npm', ['init', '-y'], { cwd: consumer });
  run('npm', ['install', tarball, '--no-audit', '--no-fund'], { cwd: consumer });
  const pkgDir = join(consumer, 'node_modules/pisvis');
  if (!existsSync(pkgDir)) fail('pisvis not installed');

  // 3. expected package contents
  for (const p of [
    'dist/index.js', 'dist/agent.js', 'dist/cli/pisvis.js', 'dist/mcp/server.js',
    'skills/pisvis-authoring/SKILL.md',
    'skills/pisvis-authoring/references/cli.md', 'skills/pisvis-authoring/references/mcp.md',
    'skills/pisvis-authoring/references/errors.md', 'skills/pisvis-authoring/references/document.md',
    'skills/pisvis-authoring/assets/examples/arrow-create-minimal.json',
    'skills/pisvis-authoring/assets/examples/horizontal-projectile-create-minimal.json',
    'skills/pisvis-authoring/assets/examples/vector-add-create-minimal.json',
    'skills/pisvis-authoring/assets/examples/vector-decompose-create-minimal.json',
    'llms.txt', 'docs/agent/README.md', 'docs/agent/mcp.example.json', 'README.md', 'LICENSE',
  ]) {
    if (!existsSync(join(pkgDir, p))) fail(`missing packaged file ${p}`);
  }

  // 4. bins: CLI
  const cli = run('npx', ['pisvis', 'capabilities'], { cwd: consumer });
  const caps = JSON.parse(cli.slice(cli.indexOf('{')));
  if (caps.total !== 4 || caps.items[0].id !== 'arrow' ||
      caps.items[1].id !== 'horizontal-projectile' ||
      caps.items[2].id !== 'vector-add' || caps.items[3].id !== 'vector-decompose') {
    fail('npx pisvis capabilities wrong');
  }

  // 5. bins: MCP server via stdio handshake
  const mcpCode = `
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
const t = new StdioClientTransport({command:'npx', args:['pisvis-mcp']});
const c = new Client({name:'p',version:'0'});
await c.connect(t);
const tools = (await c.listTools()).tools.map(x=>x.name);
const r = await c.callTool({name:'pisvis_create_scene',arguments:{templateId:'arrow',templateVersion:1,params:{start:{x:0,y:0},end:{x:3,y:4}}}});
console.log(JSON.stringify({tools, length: r.structuredContent.derived.length}));
await c.close();
`;
  mkdirSync(join(consumer, 'scripts'), { recursive: true });
  const mcpScript = join(consumer, 'scripts', 'mcp-probe.mjs');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(mcpScript, mcpCode);
  run('npm', ['install', '@modelcontextprotocol/client@2.0.0', '--no-audit', '--no-fund'], { cwd: consumer });
  const mcp = JSON.parse(run(process.execPath, [mcpScript], { cwd: consumer }));
  if (!mcp.tools.includes('pisvis_render_scene') || mcp.length !== 5) fail('pisvis-mcp probe failed');

  // 6. pisvis/agent import
  const agentCode = `
const api = (await import('pisvis/agent')).authoring;
const r = api.createScene({templateId:'arrow',templateVersion:1,params:{start:{x:0,y:0},end:{x:3,y:4}}});
console.log(JSON.stringify({ok:r.ok, length:r.derived?.length}));
`;
  writeFileSync(mcpScript, agentCode);
  const agent = JSON.parse(run(process.execPath, [mcpScript], { cwd: consumer }));
  if (!agent.ok || agent.length !== 5) fail('pisvis/agent import failed');

  // 7. packaged markdown links resolve within the package
  const walkMd = (dir, acc = []) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walkMd(p, acc); else if (e.name.endsWith('.md') || e.name === 'llms.txt') acc.push(p);
    }
    return acc;
  };
  let badLinks = 0;
  for (const md of walkMd(pkgDir)) {
    const text = readFileSync(md, 'utf8');
    for (const m of text.matchAll(/\]\(([^)\s]+)\)|^- ([a-z0-9_./-]+\.(?:md|json|txt))\s/gm)) {
      const href = m[1] ?? m[2];
      if (/^(https?:|mailto:|#)/.test(href)) continue;
      const target = resolve(dirname(md), href.split('#')[0]);
      if (!existsSync(target)) { console.error(`  dead link ${href} in ${md.slice(pkgDir.length)}`); badLinks++; }
    }
  }
  if (badLinks > 0) fail(`${badLinks} dead packaged links`);

  console.log('pack test OK');
} finally {
  if (!process.env.KEEP_PACK_TEST) rmSync(WORK, { recursive: true, force: true });
}
