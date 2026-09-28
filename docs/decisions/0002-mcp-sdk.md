# 0002 · 采用 @modelcontextprotocol/server（A1-2）

日期：2026-09-28（UTC+08）。关联：[Issue #6](https://github.com/Buqisir/pisvis/issues/6) / [DEPENDENCIES](../DEPENDENCIES.md)。

## 问题

A1-2 需要一个符合 MCP 协议、可被宿主（Agent）配置的 stdio 工具服务器，
协议生命周期/传输由官方 SDK 承担，业务工具薄封我们的创作 API。

## 为什么借用而不是自研

MCP 协议有 JSON-RPC 传输、初始化/版本协商、能力通告、Schema 校验等通用职责；
自研即复制协议层且得不到生态工具的互操作验证。SDK 也负责传输层 stdout 纪律。

## 版本与元数据（npm，2026-09-28 核对）

- `@modelcontextprotocol/server@2.0.0`：MIT，发布于 2026-07-27（>7 天）。
  **不选 2.1.0**（发布于 2026-09-23，仅 5 天，按 7 天规则弃用）。
- `@modelcontextprotocol/client@2.0.0`：MIT，devDependency，仅测试用。
- 协议版本协商：客户端请求 2025-11-25 时协商为 2025-11-25（SDK 支持
  2025-11-25 / 2025-06-18 / 2025-03-26 / 2024-11-05 / 2024-10-07）。

## 传递依赖

- server → `@modelcontextprotocol/core@2.0.0` + `zod@4.6.5`（2 个，SDK 自身实现需要）。
- client（dev-only）→ 上述 + cross-spawn/path-key/shebang-command/shebang-regex/which/isexe/
  eventsource/eventsource-parser/jose/pkce-challenge（共 11 个，仅测试链）。
- 业务 Schema 不写在 zod 上：工具 input/output 均用 valibot → `toStandardJsonSchema`
  （Standard Schema + `~standard.jsonSchema`，registerTool 原生接受）。

## 集成方式与测试

`src/mcp/server.ts` → `dist/mcp/server.js`（bin `pisvis-mcp`）。六个 pisvis_* 工具
1:1 对应 API，从同一注册表生成定义；MCP 代码不出现在根 `./agent` 入口的导入图
（import-graph 测试断言）。`tests/mcp.test.mjs` 用官方 client+stdio 跑真实握手与
工具调用并与直接 API 深相等；InMemoryTransport 验证测试注册表扩展性。

## 实测体积

- 新增源码：src/mcp ~7 kB → dist/mcp/server.js ~8 kB（不含 SDK）。
- node_modules：server ~6.3 MB、core ~1.3 MB、zod ~6.1 MB（含 sourcemap/dts；
  生产路径仅需 server+core+zod，client 全链仅测试安装）。
- 发布包 tarball 83 kB / 71 文件（unpacked 223 kB，含 dist+skills+docs）。

## 移除路径

删除 dependencies 中 server 包 + src/mcp + tests/mcp.test.mjs + bin pisvis-mcp；
devDeps 中 client 同时移除。`./agent`/CLI/Skill 不受影响。
