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
- `horizontal-projectile@1`（physics-model，SI）：高度 h 处以水平初速度 u 抛出的
  平抛情境图。输入 h/u/g/t，派生 position/velocity/T/R/落点等；时间域 [0,T]。
- `projectile-speed-graph@1`（physics-model，SI）：同一平抛快照的 v–t 函数图
  （vx 常量线、vy=−gt 斜线、t 游标）。与 horizontal-projectile 共用同一
  params Schema；用作同一题目的第二视图。

均输出规范化场景文档、自包含 SVG 与检查报告。发现更多能力 →
`pisvis_list_capabilities` / `pisvis capabilities`。

## 接入

- Skill：`skills/pisvis-authoring/`（Agent Skills 格式；references/ 有 CLI/MCP/错误码/文档细节）。
- MCP 宿主配置：`mcp.example.json`（本地 node 直调或 npx/bin 两种形态）。
- 注意：安装 npm 包≠模型自动发现 —— 宿主须加载 Skill 或配置 MCP 服务器。

## 边界

math-diagram 能力为无量纲数学示意，`checks.physics` 为 `not_applicable`；
physics-model 能力按注册模型卡校验（`checks.physics` 可为 `passed`），
但不覆盖未注册的物理情形，不做受力分析。
不执行任意代码，不访问文件系统（除 CLI 显式文件参数），无网络依赖。
