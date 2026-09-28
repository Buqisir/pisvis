# 0001 · 采用 valibot + @valibot/to-json-schema（A1-1）

日期：2026-09-28（UTC+08）。关联：[Issue #6](https://github.com/Buqisir/pisvis/issues/6) / [DEPENDENCIES](../DEPENDENCIES.md)。

## 问题

A1 需要对 Agent 提交的场景文档、参数与修改命令做运行时校验，并把同一套约束导出成
机器可读的 JSON Schema 供发现入口使用。

## 为什么借用而不是自研

输入校验是通用能力，不承载项目语义；自研校验器会重复发明 schema/错误路径/边界处理。
选 valibot 的原因：运行时校验与静态类型同源、API 体积小、`to-json-schema` 官方包可导出
JSON Schema，避免为 API/CLI/MCP 手写两套业务 Schema（Issue #6 §3 的决定）。

## 版本与元数据（npm，2026-09-28 核对）

- `valibot@1.5.0`：MIT，发布于 2026-09-09（>7 天），运行时 `dependencies`，**无传递依赖**。
- `@valibot/to-json-schema@1.8.0`：MIT，更新于 2026-09-11，运行时 `dependencies`，
  无传递依赖，`peerDependencies: valibot ^1.5.0`（已满足）。
- `@types/node@24.13.5`：MIT，devDependency，仅用于 CLI 构建。

环境：Node 24.15.0 / npm 11.12.1；npm ci 复现，锁文件随 PR 提交。

## 集成方式与测试

valibot 只进入 `./agent` 子入口与 CLI：根 `.` 入口保持零依赖（import-graph 测试断言
dist/index.js 无 valibot/node: 引用）。`./agent` 不含 node: 引用（可在浏览器使用）。
`tests/agent.test.mjs` 覆盖正常路径、全部错误码、限制与注册表扩展性；
`tests/cli.test.mjs` 以子进程驱动真实 CLI。

## 实测体积

- 根入口 dist/index.js 静态图：37.2 kB / 14 文件（未引入 valibot，bare imports 为空）。
- dist/agent.js 静态图：67.7 kB / 16 文件（api.js 27.9 kB 为主）；CLI pisvis.js 9.6 kB。
- valibot 包体积 ~291 kB、to-json-schema ~166 kB（node_modules 实测，按需子入口加载）。

## 已知边界与移除路径

- `toJsonSchema` 无法转换 `finite()` 等运行时动作（errorMode:'ignore' 跳过）；
  这些约束保留在运行时并在能力 constraints 中明示。
- 移除：删除 package.json 依赖 + `./agent` 入口 + CLI；根入口不受影响。
