# pisvis MCP 服务器参考

入口：`node <path>/dist/mcp/server.js`（安装后 `npx pisvis-mcp` / `pisvis-mcp`）。
stdio 传输；stdout 只承载协议，日志在 stderr。协议版本按客户端协商
（客户端请求 2025-11-25 时协商为 2025-11-25；SDK 2.0.0 还支持 2025-06-18/2025-03-26/2024-11-05/2024-10-07）。

宿主配置示例见 docs/agent/mcp.example.json（npm 包内同路径）。

## 工具

| 工具 | 作用 |
| --- | --- |
<!-- BEGIN GENERATED tools -->
| `pisvis_list_capabilities` | 列出当前可调用能力目录（keyword/kind 过滤） |
| `pisvis_describe_capability` | 某能力/版本的 Schema、约束、默认值、例子 |
| `pisvis_create_scene` | 从能力+参数生成规范化文档、派生值与检查状态 |
| `pisvis_validate_scene` | 校验文档并返回规范化副本（不写状态） |
| `pisvis_update_scene` | 白名单修改操作，全成功或全失败 |
| `pisvis_render_scene` | 输出自包含 SVG（≤64 KiB 内联） |
<!-- END GENERATED tools -->

## 结果形态

- 每个工具返回 `{content, structuredContent}`；`structuredContent` 就是 API 结果信封
  （与 `pisvis` CLI 的 stdout JSON 同构——同一 `ok`/`errors`/`checks`/`derived`/`documentHash` 结构）。
- 领域失败：`isError:true` + `structuredContent.ok:false`，错误结构不变（code/path/hint）。
  未知工具/格式错误参数按 MCP 协议层报错处理。
- `pisvis_render_scene` 的 SVG 以内联 text content 返回（mimeType 在 structuredContent，
  为 `image/svg+xml`）；SVG >64 KiB 时返回 `too-large` 领域错误，建议改用 CLI render 落盘。
- 无资源/文件系统能力；每次调用独立无状态，不存在“当前场景”。

## 宿主注意

`math-diagram` 类能力（如 arrow）不评估物理正确性，`checks.physics` 为 `not_applicable`；
未来物理模板能力会带自己的 physics 检查。不要把数学示意当物理结论交付。
