// Generates the agent-facing docs that must stay in sync with the built code:
// - skills/pisvis-authoring/assets/examples/*.json   (from registry examples)
// - generated blocks inside skills/.../references/*.md (markers BEGIN/END GENERATED)
// - .agents/skills/pisvis-authoring/                 (mirror of skills dir)
// Run: node scripts/agent-docs.mjs --write | --check
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, cpSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authoring, CAPABILITY_REGISTRY, ERROR_CODES, ERROR_DOCS } from '../dist/agent.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = join(ROOT, 'skills/pisvis-authoring');
const MIRROR = join(ROOT, '.agents/skills/pisvis-authoring');
const MODE = process.argv[2];
if (MODE !== '--write' && MODE !== '--check') {
  console.error('usage: agent-docs.mjs --write|--check');
  process.exit(2);
}

const TOOLS = [
  ['pisvis_list_capabilities', '列出当前可调用能力目录（keyword/kind 过滤）'],
  ['pisvis_describe_capability', '某能力/版本的 Schema、约束、默认值、例子'],
  ['pisvis_create_scene', '从能力+参数生成规范化文档、派生值与检查状态'],
  ['pisvis_validate_scene', '校验文档并返回规范化副本（不写状态）'],
  ['pisvis_update_scene', '白名单修改操作，全成功或全失败'],
  ['pisvis_render_scene', '输出自包含 SVG（≤64 KiB 内联）'],
];

const pretty = (o) => JSON.stringify(o, null, 2) + '\n';

const files = new Map(); // path -> content

// -- assets/examples (one trio per registered capability) ----------------------
for (const cap of CAPABILITY_REGISTRY) {
  files.set(join(SKILL, `assets/examples/${cap.id}-create-minimal.json`),
    pretty(cap.examples.minimal));
  files.set(join(SKILL, `assets/examples/${cap.id}-update-variant.json`),
    pretty(cap.examples.variant));
  files.set(join(SKILL, `assets/examples/${cap.id}-failure.json`), pretty({
    request: cap.examples.failure.request,
    expectedCode: cap.examples.failure.expectedCode,
    fix: cap.examples.failure.fix,
  }));
}

// -- generated blocks in references -------------------------------------------
const toolsBlock = [
  `<!-- BEGIN GENERATED tools -->`,
  ...TOOLS.map(([n, d]) => `| \`${n}\` | ${d} |`),
  `<!-- END GENERATED tools -->`,
].join('\n');
const errorsContent = [
  `# 错误码（自动生成，勿手改）`,
  ``,
  `来源：src/agent/errors.ts + types.ts ERROR_CODES。每个错误都带 \`code\` / \`path\` / \`message\`，`,
  `可能另带 \`expected\` / \`allowedValues\` / \`hint\`。`,
  ``,
  `| code | 含义 | 修正 |`,
  `| --- | --- | --- |`,
  ...ERROR_CODES.map((c) => `| \`${c}\` | ${ERROR_DOCS[c].meaning} | ${ERROR_DOCS[c].fix} |`),
  ``,
].join('\n');
const themesBlock = [
  `<!-- BEGIN GENERATED themes -->`,
  `当前注册主题（精确 id+版本，不解析 latest）：`,
  ``,
  `- \`illustrated@2\`（默认，provisional）`,
  `- \`linework@1\`（候选）`,
  `<!-- END GENERATED themes -->`,
].join('\n');

function patchBlock(file, begin, end, content) {
  const src = readFileSync(file, 'utf8');
  const re = new RegExp(`<!-- BEGIN GENERATED ${begin} -->[\\s\\S]*?<!-- END GENERATED ${end} -->`);
  if (!re.test(src)) throw new Error(`${file}: no GENERATED ${begin} block`);
  return src.replace(re, content.split('\n')[0] ? content : content);
}

// -- assemble ----------------------------------------------------------------
const errorsPath = join(SKILL, 'references/errors.md');
files.set(errorsPath, errorsContent);
files.set(join(SKILL, 'references/mcp.md'),
  patchBlock(join(SKILL, 'references/mcp.md'), 'tools', 'tools', toolsBlock));
files.set(join(SKILL, 'references/document.md'),
  patchBlock(join(SKILL, 'references/document.md'), 'themes', 'themes', themesBlock));

// -- write or check ------------------------------------------------------------
let drift = 0;
for (const [file, content] of files) {
  if (existsSync(file) && readFileSync(file, 'utf8') === content) continue;
  if (MODE === '--check') {
    console.error(`DRIFT ${file}`);
    drift++;
  } else {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
    console.log(`wrote ${file}`);
  }
}
if (MODE === '--write') {
  rmSync(MIRROR, { recursive: true, force: true });
  mkdirSync(dirname(MIRROR), { recursive: true });
  cpSync(SKILL, MIRROR, { recursive: true });
  console.log(`mirrored ${SKILL} -> ${MIRROR}`);
} else {
  // mirror drift: compare directory trees
  const walk = (d, acc = {}) => {
    if (!existsSync(d)) return acc;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p, acc); else acc[join(d, e.name)] = readFileSync(p, 'utf8');
    }
    return acc;
  };
  const a = walk(SKILL), b = walk(MIRROR);
  const aRel = new Set(Object.keys(a).map((k) => k.slice(SKILL.length)));
  const bRel = new Set(Object.keys(b).map((k) => k.slice(MIRROR.length)));
  if (aRel.size !== bRel.size || [...aRel].some((r) => !bRel.has(r))) {
    console.error('DRIFT mirror file list differs'); drift++;
  } else {
    for (const [k, text] of Object.entries(a)) {
      const rel = k.slice(SKILL.length);
      const mk = MIRROR + rel;
      if (b[mk] !== text) { console.error(`DRIFT mirror ${rel}`); drift++; }
    }
  }
}
if (drift > 0) { console.error(`${drift} drifted file(s) — run npm run agent-docs:write`); process.exit(1); }
if (MODE === '--check') console.log('agent-docs: no drift');
