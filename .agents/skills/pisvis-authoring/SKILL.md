---
name: pisvis-authoring
description: Author reproducible 2D teaching diagrams (currently: math arrows/vectors) through the pisvis authoring API — via the `pisvis` CLI or the `pisvis-*` MCP tools. Use when a teacher asks for a vector/diagram visual with real, verifiable outputs. Not for physics simulation, free-form SVG art, or capabilities not in the registry.
compatibility: Node >= 22.12 (for the CLI), or a host with the pisvis MCP server configured. No DOM needed.
---

# pisvis-authoring（消费者 Skill）

通过 pisvis 的结构化创作 API 生成可复现的教学图示。**只调用目录中真实注册的能力**；
不知道能力是否存在时先 `listCapabilities`，不要凭记忆猜。

## 前置条件（二选一）

- **CLI**：`node <path>/dist/cli/pisvis.js`（或安装后 `npx pisvis`）。每条命令 stdout 输出
  单个 JSON 结果；退出码 0 成功 / 1 领域失败 / 2 用法错误 / 3 I/O 错误。
- **MCP**：宿主已配置 `pisvis-mcp` 服务器时直接用 `pisvis_*` 六个工具。

细节见 references/cli.md、references/mcp.md、references/errors.md、references/document.md。

## 工作流

1. **发现**：`capabilities` / `pisvis_list_capabilities` → 能力目录是唯一事实来源
   （例如 `arrow@1`），版本和清单以目录返回值为准。
2. **描述**：`describe <id> --version <n>` → 读输入 Schema、必填条件、范围、默认主题、
   **该能力支持的修改操作（`operations` 字段）** 与例子。
3. **核对条件**：Schema 填不齐（如未知端点、单位不符）→ **向用户追问**，不要编造物理/数学条件；
   不要拿文档/代码库里的近似能力顶替。
4. **创建**：`create` → 得到规范文档 + `derived` + `documentHash`。
5. **校验**：`validate` 复核文档（往返保存的文档必须先 validate 再用）。
6. **渲染**：`render` → SVG + 报告；读 `checks` 与 `warnings`，把结果交付给用户。
7. **局部修改**：`update` + `describe` 返回的 `operations` 白名单——操作集合随能力不同而不同，
   不要凭记忆传 op；全成功或全失败，旧文档不受影响。
8. **保存交付**：保存生成的 `.scene.json`（可复现、可再校验）；hash 用来核对一致性。

## 错误处理

`ok:false` 时读 `errors[].code/path/hint`，按 references/errors.md 修正后重试；
`hint` 给出可执行的下一步。不要重复提交同一失败请求。

## 检查状态语义（checks）

- `structure`：字段/类型/范围是否通过。
- `math`：派生计算是否成功（如方向、长度）。
- `physics`：`arrow` 这类纯 `math-diagram` 能力**不做物理验证**，返回 `not_applicable`；
  数学示意不能当受力分析结论交付。未来物理模板能力会报告自己的 `physics` 检查结果。
- `visual`：布局/可读性检查，目前 `not_run`。

## 边界

- 不执行任意代码、不读写场景以外的文件、不访问网络。
- 坐标是世界坐标（x 右、y 上），无量纲；不是 SVG 像素也不是物理单位。
- 能力缺失（如平抛、多箭头）→ 如实报告缺口并停止，不读源码自造实现。
