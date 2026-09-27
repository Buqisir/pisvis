# 基础依赖决策

初始化日期：2026-09-28（UTC+08）。这是小项目的起点，不是长期冻结的版本清单。

## 当前选择

| 组件 | 类别 | 用途 |
| --- | --- | --- |
| TypeScript 5.8.3 | 开发依赖 | 严格类型检查、ESM 与 `.d.ts` 输出 |
| Vite 8.0.10 | 开发依赖 | 实验页开发服务器和构建；不进入核心运行时代码 |
| `node:test` / `node:assert` | Node 内建 | 当前数学与序列化测试，不另装测试框架 |
| SVG / HTML / CSS | 浏览器原生 | 图形显示与实验页 |
| Pointer Events | 后续使用的浏览器原生 API | 首轮拖动；本次还没有交互实现 |

当前 `dependencies` 为空（未声明运行时依赖），不引入 React、JSXGraph、React Flow、D3、Konva、Three.js、
物理引擎或 Agent SDK。不是否定这些工具，而是当前问题希望由项目自己实现。

之前讨论过 Vitest；初始化阶段改用 Node 自带测试，少加一个工具，且能直接验证构建后的库。
未来确有需求时可评估 Vitest 或 Playwright。工具用于验证，不应替代自有图形算法。

## 版本与复现边界

TypeScript 5.8.3 是本轮沙盒已有并实际运行的编译器；Vite 8.0.10 已核对其官方正式 release。
这些是明确的起始版本，**不宣称为当前最新、长期最佳或已完成安全审计的版本**。
建议本地使用 Node 24；首次联网任务复核支持状态和安全更新，必要时有记录地调整精确版本。
仅在沙盒 Node 22.16.0 下运行核心检查，不能据此声称完成了 Node 24 全流程验证。

本轮沙盒无法解析 GitHub/npm 网络地址，完整 `npm install` 未完成；没有编造锁文件。
本地 Agent 先安装与复核依赖，提交真实 `package-lock.json`，再在干净环境跑 `npm ci`、`npm run verify:all`。
锁文件生成后再接入只读权限的 CI。初始化不建立自动发布或部署流程。
仅固定直接依赖 **不能锁住传递依赖**；当前工程尚未达到完整可复现安装的验收门槛。

## 引入新依赖的门槛

写一份短 ADR：具体要解决什么，自己写/引入分别有什么代价，许可与维护状况，新增运行时代码范围，
是否能隔离在渲染器、适配层或开发工具中，以及未来如何替换。不要为了“以后可能用到”先全部装上。

## 官方参考（与教材内容分开）

- TypeScript 5.8.3 包元数据：https://registry.npmjs.org/typescript/5.8.3
- TypeScript strict：https://www.typescriptlang.org/tsconfig/strict.html
- Vite 8.0.10 release：https://github.com/vitejs/vite/releases/tag/v8.0.10
- Vite 入门与运行环境：https://vite.dev/guide/
- Node 测试工具：https://nodejs.org/api/test.html
- SVG 2：https://www.w3.org/TR/SVG2/
- Pointer Events：https://www.w3.org/TR/pointerevents3/
