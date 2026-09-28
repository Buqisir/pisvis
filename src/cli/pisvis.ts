#!/usr/bin/env node
// pisvis CLI — thin adapter over the authoring API. stdout is exactly one JSON
// result per invocation (except --help which prints human text). Exit codes:
//   0 success · 1 domain failure (ok:false result) · 2 usage error · 3 I/O error
import {
  linkSync, lstatSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { authoring } from '../agent.js';

const MAX_INPUT_BYTES = 256 * 1024;
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$/;

interface CliResult { json: unknown; exit: number }

const CHECKS = { structure: 'failed', math: 'not_run', physics: 'not_applicable', visual: 'not_run' } as const;

function usageError(message: string, hint?: string): CliResult {
  return {
    json: { ok: false, errors: [{ code: 'usage-error', path: '', message, hint }], checks: CHECKS },
    exit: 2,
  };
}
function ioError(message: string, hint?: string): CliResult {
  return {
    json: { ok: false, errors: [{ code: 'io-error', path: '', message, hint }], checks: CHECKS },
    exit: 3,
  };
}
function domain(result: unknown): CliResult {
  return { json: result, exit: (result as { ok: boolean }).ok ? 0 : 1 };
}

const HELP = `pisvis — Agent 可视化创作 CLI（A1）

用法:
  pisvis capabilities [--keyword <词>] [--kind <类型>]
  pisvis describe <id> --version <n>
  pisvis create --input <file|->
  pisvis validate --input <file|->
  pisvis update --input <file|->          # 文件内容 {"document": ..., "operations": [...]}
  pisvis render --input <file|-> --out-dir <dir> [--name <base>] [--overwrite]
  pisvis --help | <cmd> --help

输入 --input - 从 stdin 读取 JSON。输入文件上限 256 KiB。
stdout 始终输出单个 JSON 结果；诊断只走 stderr。
退出码: 0 成功 · 1 领域失败(ok:false) · 2 用法错误 · 3 I/O 错误
render 在 --out-dir 下写 <name>.scene.json / <name>.svg / <name>.report.json；
默认不覆盖已有文件（--overwrite 才会覆盖），--name 只允许 [A-Za-z0-9._-]。`;

async function readStdin(): Promise<{ text: string } | CliResult> {
  // incremental read — never buffer an unbounded stream
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for await (const chunk of process.stdin) {
      total += (chunk as Buffer).length;
      if (total > MAX_INPUT_BYTES) {
        process.stdin.destroy();
        return domain({
          ok: false,
          errors: [{ code: 'too-large', path: '', message: 'stdin 输入超过 256 KiB' }],
          checks: CHECKS,
        });
      }
      chunks.push(chunk as Buffer);
    }
    return { text: Buffer.concat(chunks).toString('utf8') };
  } catch (e) {
    return ioError(`无法读取 stdin：${e instanceof Error ? e.message : String(e)}`);
  }
}

async function readInput(flag: string | undefined): Promise<{ text: string } | CliResult> {
  if (flag === undefined) {
    return usageError('缺少 --input <file|->', '用 --input 指定 JSON 文件，或用 - 从 stdin 读取');
  }
  if (flag === '-') {
    if (process.stdin.isTTY === true) {
      return usageError('stdin 是终端，拒绝等待交互输入', '请管道输入 JSON 或提供文件路径');
    }
    return readStdin();
  }
  let st;
  try {
    st = statSync(flag);
  } catch (e) {
    return ioError(`无法读取输入文件「${flag}」：${e instanceof Error ? e.message : String(e)}`);
  }
  if (!st.isFile()) return ioError(`「${flag}」不是普通文件`);
  if (st.size > MAX_INPUT_BYTES) {
    return domain({ ok: false, errors: [{ code: 'too-large', path: '', message: '输入文件超过 256 KiB' }], checks: CHECKS });
  }
  try {
    return { text: readFileSync(flag, 'utf8') };
  } catch (e) {
    return ioError(`无法读取输入文件「${flag}」：${e instanceof Error ? e.message : String(e)}`);
  }
}

function parseJson(text: string): { data: unknown } | CliResult {
  try {
    return { data: JSON.parse(text) as unknown };
  } catch {
    return domain({ ok: false, errors: [{ code: 'invalid-json', path: '', message: '输入不是合法 JSON' }], checks: CHECKS });
  }
}

function writeArtifacts(
  outDir: string, name: string,
  files: { suffix: string; content: string; mimeType: string }[],
  overwrite: boolean,
): { artifacts: { path: string; bytes: number; mimeType: string }[] } | CliResult {
  const finals = files.map((f) => join(outDir, `${name}${f.suffix}`));
  const temps = finals.map((f) => `${f}.${process.pid}.tmp`);
  // (a) validate every target before writing anything — old artifacts stay intact
  for (const final of finals) {
    let st;
    try {
      st = lstatSync(final);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') continue;
      return ioError(`无法检查「${final}」：${e instanceof Error ? e.message : String(e)}`);
    }
    if (st.isSymbolicLink()) return ioError(`拒绝写入符号链接目标「${final}」`);
    if (!overwrite) {
      return ioError(`产物「${final}」已存在`, '确认后加 --overwrite，或换 --name/--out-dir');
    }
    if (!st.isFile()) return ioError(`「${final}」存在且不是普通文件，拒绝覆盖`);
  }
  // (b) write all temp files; failure here only cleans temps, never targets
  try {
    for (const [i, tmp] of temps.entries()) writeFileSync(tmp, files[i]!.content);
  } catch (e) {
    for (const tmp of temps) { try { unlinkSync(tmp); } catch { /* best effort */ } }
    return ioError(`写入临时产物失败：${e instanceof Error ? e.message : String(e)}`);
  }
  // (c) commit — link keeps no-clobber semantics even against a race
  const created: string[] = [];
  try {
    for (const [i, tmp] of temps.entries()) {
      if (overwrite) renameSync(tmp, finals[i]!);
      else { linkSync(tmp, finals[i]!); unlinkSync(tmp); }
      created.push(finals[i]!);
    }
  } catch (e) {
    for (const tmp of temps) { try { unlinkSync(tmp); } catch { /* best effort */ } }
    if (!overwrite) {
      for (const p of created) { try { unlinkSync(p); } catch { /* best effort */ } }
    }
    return ioError(
      `提交产物失败：${e instanceof Error ? e.message : String(e)}`,
      (e as NodeJS.ErrnoException).code === 'EEXIST' ? '目标文件已存在；确认后加 --overwrite' : '检查 --out-dir 权限',
    );
  }
  const artifacts = created.map((p, i) => ({
    path: p, bytes: statSync(p).size, mimeType: files[i]!.mimeType,
  }));
  return { artifacts };
}

async function main(argv: string[]): Promise<CliResult> {
  const [cmd, ...rest] = argv;
  if (cmd === undefined || cmd === '--help' || cmd === '-h' || cmd === 'help') {
    return { json: null, exit: 0 };
  }
  if (rest.includes('--help') || rest.includes('-h')) {
    return { json: null, exit: 0 };
  }

  let opts;
  try {
    opts = parseArgs({
      args: rest, allowPositionals: true, strict: true,
      options: {
        keyword: { type: 'string' },
        kind: { type: 'string' },
        version: { type: 'string' },
        input: { type: 'string' },
        'out-dir': { type: 'string' },
        name: { type: 'string' },
        overwrite: { type: 'boolean', default: false },
      },
    });
  } catch (e) {
    return usageError(`无法解析参数：${e instanceof Error ? e.message : String(e)}`, '运行 pisvis --help 查看用法');
  }
  const pos = opts.positionals;

  switch (cmd) {
    case 'capabilities':
      return domain(authoring.listCapabilities({
        ...(opts.values.keyword !== undefined ? { keyword: opts.values.keyword } : {}),
        ...(opts.values.kind !== undefined ? { kind: opts.values.kind } : {}),
      }));
    case 'describe': {
      const id = pos[0];
      if (id === undefined) return usageError('describe 需要能力 id', '例：pisvis describe arrow --version 1');
      const version = Number(opts.values.version);
      if (!Number.isInteger(version)) {
        return usageError('describe 需要 --version <整数>', '例：pisvis describe arrow --version 1');
      }
      return domain(authoring.describeCapability({ id, version }));
    }
    case 'create': case 'validate': case 'update': {
      const input = await readInput(opts.values.input);
      if (!('text' in input)) return input;
      const parsed = parseJson(input.text);
      if (!('data' in parsed)) return parsed;
      return domain(cmd === 'create'
        ? authoring.createScene(parsed.data as never)
        : cmd === 'validate'
          ? authoring.validateScene(parsed.data as never)
          : authoring.updateScene(parsed.data as never));
    }
    case 'render': {
      const input = await readInput(opts.values.input);
      if (!('text' in input)) return input;
      const parsed = parseJson(input.text);
      if (!('data' in parsed)) return parsed;
      const outDir = opts.values['out-dir'];
      if (outDir === undefined) return usageError('render 需要 --out-dir <目录>', '目录必须已存在');
      let st;
      try {
        st = statSync(outDir);
      } catch {
        return ioError(`输出目录「${outDir}」不存在`, '先创建目录再运行 render');
      }
      if (!st.isDirectory()) return ioError(`「${outDir}」不是目录`);
      const rendered = authoring.renderScene(parsed.data as never);
      if (!rendered.ok) return domain(rendered);
      const name = opts.values.name ?? rendered.document.instanceId;
      if (!NAME_PATTERN.test(name)) {
        return usageError(`--name「${name}」不合法`, '只允许 [A-Za-z0-9._-]，不能以 . 开头');
      }
      const { svg, ...report } = rendered;
      const docText = JSON.stringify(rendered.document, null, 2) + '\n';
      const written = writeArtifacts(outDir, name, [
        { suffix: '.scene.json', content: docText, mimeType: 'application/json' },
        { suffix: '.svg', content: svg, mimeType: 'image/svg+xml' },
        { suffix: '.report.json', content: JSON.stringify(report, null, 2) + '\n', mimeType: 'application/json' },
      ], opts.values.overwrite === true);
      if (!('artifacts' in written)) return written;
      return domain({ ...report, artifacts: written.artifacts });
    }
    default:
      return usageError(`未知命令「${cmd}」`, '运行 pisvis --help 查看用法');
  }
}

const result = await main(process.argv.slice(2));
if (result.json === null) {
  process.stdout.write(HELP + '\n');
} else {
  process.stdout.write(JSON.stringify(result.json, null, 2) + '\n');
}
process.exitCode = result.exit;
