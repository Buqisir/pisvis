# 基础依赖决策：自研语义，借用通用能力

更新：2026-09-28（UTC+08）。本次是文档与 Spec 更新，未改 package.json、未安装推荐库、未创建锁文件。

## 已声明的起点与历史验证

| 项目 | 当前记录 |
| --- | --- |
| TypeScript 5.8.3 | 初始化沙盒实际使用的预装编译器；不是长期冻结要求或最新版声明 |
| Vite 8.0.10 | 初始化已核对官方 release 的实验页开发依赖；完整安装/演示构建仍待 M1 |
| node:test / node:assert | 当前核心测试，无需现在改成 Vitest |
| SVG/HTML/CSS | 现有显示底座；Pointer Events 在 M1 实现 |
| 运行时 dependencies | 初始化为空；不等于未来全项目必须为零 |

初始化 Node 22.16.0、npm 10.9.2、TypeScript 5.8.3 下通过核心检查和 25 个测试；
建议的 Node 24、Vite 构建与真实浏览器并未在初始化验收。详见 [交接](HANDOFF.md)。

M1 在联网环境核对受支持工具链、正式版本与安全修复，说明升级理由，生成真实 package-lock.json，
再以 npm ci 复现。不要用 --force 掩盖错误，也不手写完整性数据。不要仅因为版本号更大而批量升级。

## 修正零依赖的边界

保留小而可解释的纯数学/几何内核，当前继续无第三方运行时依赖；无 DOM、无网络、无导入副作用是硬边界。
这不意味着实例控制、校验、公式、动效和渲染适配也必须零依赖。
领域/模型代码可按证明过的收益通过局部适配借用几何能力，不为抽象的“纯洁性”重写成熟基础设施。

选中的依赖不进入存档格式，不把第三方运行时对象暴露成所有模板都必须继承的父类。
一个简单包装足够时，不提前发明通用依赖注入容器或多包工作区。

## 近期采用计划

A1-1 已采用 `valibot@1.5.0` + `@valibot/to-json-schema@1.8.0`（运行时依赖，仅 `./agent` 子入口与 CLI）
——见 [decisions/0001-valibot](decisions/0001-valibot.md)。@preact/signals-core 推迟到真实响应式
多视图需求出现时（M2 控制器）。M3 使用 katex 做公式面板、motion 的 JavaScript API 做有限教学序列。
简单图元和数字输入不因这些依赖而自动引入 React 或其他 UI 框架。

这些是明确的优先选择，不是要求执行者再无期限重做选型。遇到兼容性或维护问题可提出短 ADR 与替代。
完整候选（含 thi.ng、PixiJS、Penrose/Bloom、SceneryStack、TypeGPU）及官方证据见 [技术参考](TECH_RADAR.md)。
后五类不在本轮直接安装，按 [隔离实验](EXPERIMENTS.md) 的实际触发条件处理。

## 包边界和体积

保持一个包、清晰模块。先通过独立导入入口/按需加载隔离公式、动效与后续 GPU 能力；
根入口不要 eager re-export 会初始化浏览器/GPU 的模块。数学入口在 Node 导入无需 window/document。
以构建产物/依赖图测试确认没有意外捆绑，不靠“工具支持 tree shaking”作保证。

按需加载减少下载/启动负担，不自动减少 npm 安装的传递依赖。若未来大型可选后端真的进入发布产品，
再根据消费者需求决定子包、peer 或 optional 依赖及错误处理，不能误称它们天然零成本。
本阶段保留 private:true，不发布 npm、不部署、不动其他仓库。

## 每次引入/升级的简短记录

记录：解决的问题；自研/借用的比较；精确版本与正式发布/包元数据来源；核对日期；许可和资产；
直接/传递依赖范围；实际 Node/npm/浏览器；集成测试；产物增量；移除/替换方式。
采用说明最好与该 PR 同步落到 docs/decisions/，有真实决定时才增加文件，不预建大量空模板。

运行时使用的包如实声明为运行时依赖，不能放进 devDependencies 以假装零依赖；
只在独立实验里使用的依赖与生产入口隔离，实验锁文件也必须真实。
不依赖线上 CDN 的 latest，不执行未经审查的远程安装命令，不为一次实验增加生产凭据。

许可分别核对代码、字体、纹理、示例和品牌；不从容器复制字体文件给项目。
检查公开安全信息和锁文件中的已知问题，记录未解决项；一次自动检查不等于完整安全审计。

## 官方工程参考

- [TypeScript strict](https://www.typescriptlang.org/tsconfig/strict.html)
- [Vite 入门与运行环境](https://vite.dev/guide/)
- [初始化 Vite release](https://github.com/vitejs/vite/releases/tag/v8.0.10)
- [Node test runner](https://nodejs.org/api/test.html)

这些链接供 M1 复核工具链。本次未重新安装它们；浏览器新特性的回退与视觉安排见 [视觉设计](VISUAL_DESIGN.md)。
