# 交接记录

## A. 初始化记录（保留历史，不因新设计更新而改写）

日期：2026-09-28（UTC+08）。初始基线 750153e2fab95598d1bbbf1e2493cc85aadc85f2 仅有 README 与 LICENSE。
初始化提交 d2168de3827fe6fbee680a155d016964148f2049 保留 Apache-2.0 LICENSE 和仓库公开性。

交付了最小 TypeScript 单包工程、向量/坐标/箭头几何、无 DOM SVG 输出、实验页源码、
Node 内建测试，以及架构、依赖、六册题材地图、路线和 Skill。
没有上传教材 PDF/扫描图，没有接入英语题库、模型 API 或第三方图形运行时。

### 初始化实际验证

沙盒：Node 22.16.0，npm 10.9.2，预装 TypeScript 5.8.3。
执行 npm run check：tsc --noEmit -p tsconfig.json 通过（含实验页类型）；
tsc -p tsconfig.build.json 通过（核心 ES2022，不含 DOM 类型）；
node --test tests/*.test.mjs 为 25 通过、0 失败、0 跳过。

涵盖非有限值、零/极小向量、坐标往返、不同方向/短箭头、SVG 确定性、文字转义及无 DOM 导入。
不等于全部边界、物理正确性或浏览器交互已证明。

### 初始化没有验证的部分

当时沙盒 GitHub/npm 直连 DNS 不可用，git clone/联网依赖获取未成功；GitHub 读写经连接器完成。
核心使用预装编译器，不是一次完整 npm install 建立的环境。
未生成锁文件，未完成 Vite 安装、build:demo、dev 或真实浏览器验收；未验证建议的 Node 24。
没有配置 CI，没有发布或部署。

这些是初始化时的环境事实，不推断所有后续环境同样不可联网。

## B. 产品/依赖方向补充（本次文档更新）

依据维护者后续讨论，把目标补齐为：特色二维视觉、组件/装置关系/题型三层复用、题目条件—数学—图形绑定，
同时避免把所有通用能力重写一遍。官方能力来源重新核对并列入 docs/TECH_RADAR.md，
来源能力、项目采用决定和未实施状态分别标注。

新增 PRODUCT、VISUAL_DESIGN、REUSE_AND_BINDINGS、TECH_RADAR、EXPERIMENTS；
同步 README、AGENTS、ARCHITECTURE、DEPENDENCIES、ROADMAP 与创作 Skill。
原 CURRICULUM 的目录级研究记录保留；M3 Issue 提供平抛正文定位和独立工程验收数据，
仍要求执行者实际核对正文，不把定位信息冒称完整模型审查。

本次只改 Markdown 文档和 GitHub Issue，不改 src、tests、playground、package.json、构建配置或 LICENSE；
不安装依赖、不执行新代码测试、不宣称新的性能/浏览器结果。
本次记录的外部库尚未完成 pisvis 集成测试，候选视觉样板尚未获得维护者批准。

## C. 下一位本地 Agent 的入口

总纲：[Issue #2](https://github.com/Buqisir/pisvis/issues/2)。
先执行 [M1 #1](https://github.com/Buqisir/pisvis/issues/1)，复核版本、提交真实锁文件、
干净 npm ci / verify:all / 浏览器验证，再完成原生箭头拖动。
M1 验收后执行 [M2 #3](https://github.com/Buqisir/pisvis/issues/3)，再执行 [M3 #4](https://github.com/Buqisir/pisvis/issues/4)。

M1 小内核继续零运行时依赖；新产品方向允许 M2/M3 在实例/校验/表现适配中使用选定依赖，
不把“允许合理依赖”解释为现在全部安装。不要跳过工程复现，也不要一口气实现全部总纲。

先核对最新 main 和进行中的 PR，已经实际完成的工作以新证据为准，不因为本记录历史状态而重复覆盖。
后续结果用追加记录说明提交、环境、命令、浏览器、证据和未测项，不抹去初始化时的限制。
