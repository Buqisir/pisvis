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

## D. M1 实施记录

日期：2026-09-28（UTC+08）。实现 [Issue #1](https://github.com/Buqisir/pisvis/issues/1)：
工程复现（A，提交 cc0b22f）与原生 SVG 端点拖动（B，提交 e9730b8）。

### 环境

macOS 本机；Node 24.15.0 / npm 11.12.1（Homebrew node@24，对应 .nvmrc 的 24）。
TypeScript 6.0.3（由 5.8.3 升级，tsconfig 无需改动）、Vite 8.3.0（由 8.0.10）、
新增开发依赖 @playwright/test 1.63.0（Chromium build 1243）。核心运行时依赖仍为零。
GitHub Actions 固定到 v7 系列完整提交 SHA（checkout v7.0.1、setup-node v7.0.0、upload-artifact v7.0.1）。

### 实际执行

- `rm -rf node_modules dist demo-dist && npm ci && npm run check && npm run build:demo`：全部通过；
  dist/ 仅含 src 的 ESM .js 与 .d.ts，demo-dist 不污染库输出；npm audit 0 漏洞。
- `node --test tests/*.test.mjs`：30 通过 / 0 失败（初始化 25 + 本轮 affine 5）。
- `npm run test:browser`（Chromium，vite preview 127.0.0.1:4173）：19 通过 / 0 失败。
  代表性截图：test-results/screenshots/{drag-default,coincident-separated,invalid-input,mobile-layout,playground-arrow}.png（gitignored，不入库）。

### 本轮新增能力

- `src/core/affine.ts`：`applyAffine` / `invertAffine`，DOMMatrix 同构、无 DOM 依赖；
  det 为零或低于 EPSILON*s² 阈值返回 null，逆矩阵出现非有限值返回 null，输入非有限抛 RangeError。
- playground 重写为单一状态 `{start, end, zoom, selected}`：输入、SVG、拖动手柄、读数全部由其导出；
  number 输入改 `step="any"` 且只解析触发事件的字段（显示值舍入不回流状态）；
  原生 Pointer Events + `getScreenCTM()` 逆变换做 client→世界换算，演示层夹取 x∈[-4,4]、y∈[-2,2]；
  重合端点经「当前端点」单选（键盘可用）分离，选中手柄渲染在最上层；
  指针捕获挂在稳定的 #canvas 宿主上（SVG 每帧重建），覆盖 pointerup/cancel/lostpointercapture；
  非法输入置 aria-invalid、保留最后有效图形；#status 只承载错误与单次拖动结束提示，
  #readout（非 live）显示起点/终点/长度/方向。
- `.github/workflows/ci.yml`：push 到 main 与 PR 触发，permissions 只读，
  npm ci → check → build:demo → 安装 Chromium → 浏览器测试，失败时上传 playwright-report。

### 已修复的既有问题

初始化演示在 form reset 时用 queueMicrotask 重绘：微任务在浏览器恢复控件默认值之前运行，
导致重置后图形停在旧值、输入与图形脱节（实测输入已复原而读数仍显示旧长度）。
改为 setTimeout 调度（A 部分提交内已含）。

### 未验证 / 已知限制

- 浏览器测试仅 Chromium；Firefox、WebKit 与真实触摸设备未验收。
- 每次 pointermove 重建整个 SVG（含手柄）；当前规模可接受，未做增量更新。
- 无滚轮缩放/平移；缩放范围固定 20–60；标签固定不避让。
- 方向读数为相对 +x 轴的角度（1 位小数）；零向量显示「—」。
- 终点实心手柄会部分遮住箭头尖端；留给 M2 视觉样板统一处理。

## E. M2-A 视觉候选记录

日期：2026-09-28（UTC+08）。实现 [Issue #3](https://github.com/Buqisir/pisvis/issues/3) 的 A 部分：
主题 token、CSS 适配、场景序列化、视口自适应与双候选样板页。提交 f6823be。
两套主题均为候选，维护者尚未选择。

### 环境

macOS 本机；Node 24.15.0 / npm 11.12.1；TypeScript 6.0.3、Vite 8.3.0、@playwright/test 1.63.0（Chromium build 1243）。
本轮无新增依赖；核心运行时依赖仍为零。

### 实际执行

- `npm run check`：55 通过 / 0 失败（M1 的 30 + 本轮 theme 10、scene 11、fit 4）。
- `npm run test:browser`（Chromium）：31 通过 / 0 失败（M1 的 19 + gallery 12，含两主题文本重叠断言）。
  截图：test-results/screenshots/gallery-{a,b,compare,grayscale,long-labels,mobile}.png（不入库）。
- `npm run build:demo`：gallery 成为第二个 Vite 页面。产物增量（实测本机构建）：
  main(dd7194f) 演示页 ≈ index.html 2.2kB + js 8.3kB + css 1.5kB；
  本分支 index 页 ≈ 18.1kB（共享块把库代码拆出），gallery 页新增 ≈ 21.5kB（gallery.js 17.4kB + css 2.1kB + html 2.0kB）。
  总量小，无第三方运行时。
- dist/index.js 的无 DOM 导入测试（kernel.test.mjs「pure renderer imports and runs in Node」）继续通过：
  theme/scene/fit 均为纯数据与纯函数。

### 本轮新增能力

- `src/theme/tokens.ts`：ThemeDefinition/ColorRole/ColorToken + `checkTheme` 运行时校验（id、版本、色值格式、字号、动效白名单）。
- `src/theme/themes.ts`：`CANDIDATE_ILLUSTRATED`（soft）与 `CANDIDATE_LINEWORK`（flat），`CANDIDATE_THEMES` 汇总。
  srgb 值为 OKLCH→sRGB 实测换算；相对起点值修改：A component oklch(62% 0.13 65)→oklch(38% 0.08 62)
  （与 input/derived 的明度差不足 0.08 且提亮会破坏 3:1 对比度），B component 60%→61%（明度差恰好 0.08 无余量），
  两主题 focus 彩度 0.16→0.15（原值略超 sRGB 色域 ~1/255）；A component 虚线改 '4 4'、B 改 '5 3'（'1.5 3.5' 在细线宽下几乎不可见）。
- `src/theme/css.ts`：`themeToCssText(theme, selector)` — sRGB 块在前，`@supports` 升级 OKLCH；选择器与全部 token 严格白名单。
- `src/render/scene.ts`：`renderSceneSvg` — axes/arrow/point/segment、角色与状态类名、实例命名空间 id、
  url(#) 局部引用、零向量 pv-zero、错误态非纯色彩提示（衬底虚线）、手柄（readonly 无）、转义标签（≤200 字符）。
- `src/render/escape.ts`：xml 转义从 svg.ts 抽出共享（svg.ts 行为不变）。
- `src/core/fit.ts`：`fitViewport` 统一比例适配，退化范围按 1 世界单位处理。
- `gallery.html` + `playground/gallery.ts` + `playground/theme.css`：四节样板——图元/状态为独立小格（HTML 图注，
  不与坐标轴混排），退化与边界拆为四个独立面板，合成/分解为大图（720px 级，stage 填满卡宽）；
  主题单选与并排对比（≥1100px 双列）、灰度/减少动效/长标签开关、HTML 读数面板（与图形同源数据）。
- 标签定位：end 锚点沿箭头方向越出 tip；mid 锚点在水平项放下侧、竖直项放左侧、斜向取垂足侧；
  带手柄项的有效偏移至少越过手柄外环；刻度数字跳过轴线交点的斜角格。浏览器断言默认标签下
  同一 svg 内任意两个 text 的 bbox 互不重叠（A/B 主题均验）。
- `playground/format.ts`：fmt 抽出共享；vite.config.mjs 改多页构建；index.html 页头加样板链接。

### 已修正的实现问题

- scene 重复 id 校验曾误用 `Set.add` 返回值（恒真），改为 `has` + `add`。
- M1 键盘测试补链接受影响的断言方式（页头新增样板链接后 Tab 顺序多一站）。

### 未验证 / 已知限制

- 浏览器仅 Chromium；Firefox/WebKit、真实触摸、OKLCH 不支持环境下的 sRGB 降级路径未在旧浏览器实测。
- 长标签以固定锚点+人工偏移适配，无自动避让；CI（无中文字体包）可能与本机字形不同。
- tick 数字仅在 B（线描）显示；A 隐藏刻度文字。灰度只是检查开关，非打印管线。
- 主题切换几何不变的前提是两主题共用同一适配 margin（取两主题 safeMargin 最大值 36px）。
