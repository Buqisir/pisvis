# 初始化交接记录

日期：2026-09-28（UTC+08）。基线为仓库初始提交 `750153e2fab95598d1bbbf1e2493cc85aadc85f2`。
基线仅含 `README.md` 与 `LICENSE`；本次保留原 Apache-2.0 LICENSE，不改仓库公开性。

## 本次交付

最小 TypeScript 单包工程、自己的向量/坐标/箭头几何、无 DOM 的 SVG 输出、实验页源码、
Node 内建测试，以及架构、依赖、六册题材地图、路线和 Skill。
没有把教材 PDF 或扫描图写入仓库，没有接入英语题库、模型 API 或第三方图形运行时。

## 实际验证

沙盒环境：Node `22.16.0`，npm `10.9.2`，预装 TypeScript `5.8.3`。

执行 `npm run check`：

- `tsc --noEmit -p tsconfig.json`：通过（含实验页 TypeScript）。
- `tsc -p tsconfig.build.json`：通过（仅核心，ES2022 lib，不包含 DOM 类型）。
- `node --test tests/*.test.mjs`：25 个测试通过、0 失败、0 跳过。

测试涵盖非有限值、零/极小向量、坐标往返、不同方向和短箭头、SVG 确定性、文字转义及无 DOM 导入。
这些不等于全部边界、物理正确性或浏览器交互已得到证明。

## 没有验证、不可误报的部分

沙盒 GitHub/npm 直连 DNS 不可用，`git clone`/依赖联网获取未成功；GitHub 读写通过连接器完成。
核心检查使用的是预装编译器，并非由一次完整 `npm install` 建立的环境。
未生成锁文件，未完成 Vite 安装、`npm run build:demo`、`npm run dev` 或真实浏览器验收；
未验证建议的 Node 24 环境。没有配置 GitHub CI，也没有执行发布或部署。

## 本地 Agent 的第一个动作

先读当前 M1 GitHub Issue。复核 Node/依赖版本，安装并生成真实锁文件，在干净环境跑 `npm ci` 和
`npm run verify:all`，打开实验页确认现有参数/重置路径，再开始拖动交互。通过后更新此记录，
写清版本、命令、浏览器与证据；不要抹掉初始化时的已知限制或把尚未做的步骤标成完成。
