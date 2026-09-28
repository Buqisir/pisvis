# pisvis CLI 参考

入口：`node <path>/dist/cli/pisvis.js` 或安装后 `npx pisvis` / `pisvis`。
stdout 恒为单个 JSON（成功与失败都如此），便于解析；诊断只走 stderr。
经 `npm run` 调用会在 stdout 混入 npm 前缀——机器解析请直调 node/npx。

## 子命令

| 命令 | 输入 | 说明 |
| --- | --- | --- |
| `capabilities [--keyword k] [--kind k]` | — | 能力精简目录 |
| `describe <id> --version <n>` | — | Schema/约束/默认值/例子 |
| `create --input <file\|->` | `{templateId,templateVersion,params,presentation?,instanceId?}` | 规范化文档+派生值 |
| `validate --input <file\|->` | `{document}` | 校验+规范化副本 |
| `update --input <file\|->` | `{document,operations}` | 白名单操作（从 describe 的 operations 读），全成功或全失败 |
| `render --input <file\|-> --out-dir <dir> [--name base] [--overwrite]` | `{document}` | 写 3 个产物 |
| `--help` / `<cmd> --help` | — | 人类可读用法 |

`--input -` 读 stdin；stdin 超过 256 KiB 在流式读取中直接拒绝（too-large）。
输入文件先 stat，>256 KiB 在读入前拒绝。

## 退出码

- `0`：ok（含 --help）
- `1`：领域失败，stdout 是 `{ok:false, errors:[{code,path,hint?}]}`（含 too-large/invalid-json）
- `2`：用法错误，stdout 是 usage-error JSON（未知命令/缺参/坏 --name）
- `3`：I/O 错误，stdout 是 io-error JSON（读不到文件、out-dir 缺失/不存在、产物已存在且无 --overwrite、符号链接目标）

## render 产物

默认名 = document.instanceId，写 `<name>.scene.json` / `<name>.svg` / `<name>.report.json`。
SVG 自带样式（主题变量+基础规则内联），可直接在浏览器打开。
先写临时文件再原子提交：无 `--overwrite` 时目标已存在则整批失败且不写任何文件；
失败在中途也不会损坏已有产物（旧文件保持字节不变）。`--name` 只允许
`[A-Za-z0-9][A-Za-z0-9._-]{0,100}`，防路径穿越；符号链接目标一律拒绝。
