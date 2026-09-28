# pisvis · Agent 入口索引

## 提供给 Agent 的接口（同一纯数据 API 的三种形态）

| 形态 | 入口 | 适用 |
| --- | --- | --- |
| JS API | `import { authoring } from 'pisvis/agent'` | 在 Node/浏览器中直接调用 |
| CLI | `npx pisvis`（dist/cli/pisvis.js） | 脚本与 Agent 进程外调用 |
| MCP | `npx pisvis-mcp`（dist/mcp/server.js） | 宿主配置后模型直调工具 |

## 能力目录

- `arrow@1`（math-diagram）：二维向量箭头，含坐标轴与标签。输入 start/end/label，
  派生 delta/length/direction。
- `vector-add@1`（math-diagram）：两向量平行四边形合成。输入 a/b/labels，
  派生 r/rLength/rDirection。
- `vector-decompose@1`（math-diagram）：向量正交分解到坐标轴。输入 v/label，
  派生 vx/vy/length/direction。

均输出规范化场景文档、自包含 SVG 与检查报告。发现更多能力 →
`pisvis_list_capabilities` / `pisvis capabilities`。

## 接入

- Skill：`skills/pisvis-authoring/`（Agent Skills 格式；references/ 有 CLI/MCP/错误码/文档细节）。
- MCP 宿主配置：`mcp.example.json`（本地 node 直调或 npx/bin 两种形态）。
- 注意：安装 npm 包≠模型自动发现 —— 宿主须加载 Skill 或配置 MCP 服务器。

## 边界

无量纲数学示意；`checks.physics` 恒 `not_applicable`（不做受力分析）；
不执行任意代码，不访问文件系统（除 CLI 显式文件参数），无网络依赖。
