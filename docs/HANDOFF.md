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

### E.2 候选 C 与动效

2026-09-28（UTC+08）追加：维护者看过 A/B 后要求更“科技感”的方向——深色仪器感候选 C
（material: 'glow'）与纯 CSS/WAAPI 动效层，无新增依赖。

- 主题数据：`ThemeDefinition.text` 新增 `numericFamily`（三套主题同栈，等宽数字用于刻度与读数）；
  `material` 扩为 `'soft' | 'flat' | 'glow'`。C 的 input 由 oklch(84% 0.13 200) 调至 oklch(86% 0.13 200)
  ——原值与 component 明度差仅 0.07（要求 ≥0.08），调后 0.09，对比度 13.06:1，srgb 仍在色域内。
- 序列化：glow 主题输出命名空间隔离的 `feGaussianBlur` 滤镜（input/derived/component 箭头、点、手柄点）；
  grid 时额外输出半格细线（pv-gridline-minor）；soft/flat 输出不变。C 选中环有 2.4s 呼吸脉冲
  （pv-breathe），减少动效（媒体查询或 .pv-reduced-motion）下关闭。
- 动效层在 `playground/motion.ts` + `gallery.ts`，演示层专用：IntersectionObserver 每个格子入场一次
  （标记后跨重渲染不重播；「重播」按钮先取消场内动画再重放，不叠加）；场景一「联动演示」用 rAF 让
  B 沿圆周漂移（~6s 周期），逐帧经同一渲染管线重画并更新读数；暂停/复位/主题切换/可见性隐藏都
  干净停环。减少动效时无入场、演示不自动开始且按钮禁用。窗口上暴露 `__pvDemo` 计数用于测试。
- 单选 C 时整页转暗（`body[data-pv-page="dark"]`，读数变为半透明仪表板）；并排对比为三主题，
  宽屏 ≥1500px 三列、≥1100px 两列、以下纵向堆叠。
- 验证：`npm run check` 61 通过；`npm run test:browser` 43 通过（M1 19 + gallery 24，含入口动画
  终态=静态渲染、双主题重叠断言扩至 C、联动 R=A+B 读数与 SVG 一致性、播放中切主题恰好一条 rAF
  循环、快速两次重播不叠加）。截图含 gallery-c.png、gallery-c-mobile.png（暗色整页）。
- demo-dist 体积：gallery 页约 26.8kB（js 24.2kB + css 2.5kB + html 2.1kB），较 E 节时 +5.3kB。
- 复审修正：非 soft 材质补上 pv-head/pv-dot 角色填充（C 的箭头曾默认黑色）；单主题模式
  stage-pair 固定单列（多列网格仅 :has 多个变体时启用），stage 最大 880px；单元格/面板网格
  最小宽调整为不缩小 svg（刻度有效字号 ≥12.5px，浏览器断言三套主题验证）。
- 已知限制：仍仅 Chromium；C 的辉光在投影/打印下未验证（投影与打印请用浅色主题）；动效与呼吸
  脉冲未在 Firefox/WebKit 实测；visibilitychange 恢复路径由代码实现但浏览器测试未覆盖真隐藏。

### E.3 维护者反馈与 A v2

2026-09-28（UTC+08）维护者反馈 PR #7：选定 A「轻质感科学插画」为方向，要求去掉“塑料感”、
更轻更透气，不要深色主题。本补丁移除候选 C（深色仪器感/glow 材质/暗色页/呼吸脉冲全部撤出），
A 升为 v2，B 保留为候选对照；动效层保留（与主题无关）。

- A v2 token：paper oklch(98.6% 0.008 85)；角色 input/derived/component 明度序 0.63/0.45/0.54
  （ΔL 0.09/0.18/0.09，≥0.08）；component 由深铜 oklch(38% 0.08 62) 改柔和赭 oklch(54% 0.11 50)；
  线宽 main 3→2 / aux 2→1.4 / axis 1.5→1.2 / grid 1→0.75；箭头 16×12→13×9；点 r5→4、手柄 8→7；
  刻度/读数 14→13；动效 260ms cubic-bezier(0.25,0.8,0.25,1)。全部满足既有对比度/明度差/色域测试。
- 序列化收窄：渐变 defs、点纹理、halo 圆、发光滤镜、半格细网格全部移除——soft 材质现在仅表示
  圆头线帽 + 手柄点后 10% 淡 halo；输出不再含 <defs> 或 url(#) 引用。
- 标签：`SceneLabel.style: 'variable'|'text'`；数学单字母用斜体衬线（pv-label-var），中文用正文。
- 验证：`npm run check` 57 通过；`npm run test:browser` 39 通过（M1 19 + gallery 20）。
  新增断言：每主题所有 pv-head/pv-dot/pv-handle-dot/pv-zero/pv-axis-head 计算填充为角色/坐标轴色
  或渐变，绝不默认黑/无填充；有效字号 ≥12.5px。
- 截图重生成 gallery-{a,b,compare,grayscale,long-labels,mobile}.png；gallery-c* 已删除。
- demo-dist gallery 页 ≈26.8kB（js 24.2 + css 2.55 + html 2.1），与 E.2 基本持平。
- 追加（2026-09-28）：维护者决定先用 A v2——导出改名 THEMES/THEME_ILLUSTRATED/THEME_LINEWORK +
  `DEFAULT_THEME` + `getTheme(id,version)`（仅精确匹配）；status 枚举扩为 'candidate'|'provisional'，
  A v2 为 provisional。npm run check 61 通过、test:browser 39 通过。
  追加：合并前主题 id 去掉 candidate- 前缀——`illustrated@2` / `linework@1`（版本不变），
  尚无存档文档引用旧 id。

## G. A1-1 创作 API 与 CLI 记录

环境：Node 24.15.0 / npm 11.12.1 / TS 6.0.3 / Playwright 1.63.0（Chromium 1243）。提交 069f81d。

- 依赖（decisions/0001-valibot.md）：valibot@1.5.0、@valibot/to-json-schema@1.8.0（runtime，
  均 MIT、零传递依赖）；@types/node@24.13.5（dev，仅 CLI）。npm ci 干净通过。
- 入口隔离：根 `.` 零依赖（import-graph 测试断言无 valibot/node:）；`./agent` 纯数据 API
  （无 node:，可浏览器/Node）；CLI dist/cli/pisvis.js（shebang、bin 注册、tsconfig.cli.json）。
- 交付：能力注册表（arrow@1）→ listCapabilities/describeCapability/createScene/validateScene/
  updateScene/renderScene；场景文档 v1（schemaVersion/instanceId/templateId@version/unit/params/
  presentation=theme+canvas+viewport）；确定性 documentHash；白名单操作全成功或全失败；
  独立样式 SVG（SCENE_BASE_CSS + 主题变量内联）；CLI 六个子命令 + stdin/文件输入 +
  输出目录原子写入（link/rename、不覆盖、拒绝符号链接、路径含空格可测）。
- 校验边界：请求 ≤256KiB、深度 ≤16、label ≤200、坐标 |v|≤1e6、canvas 64..4096、
  viewport pixelsPerUnit ≤4096、prototype-pollution 安全；physics 恒 not_applicable。
- 测试：`npm run check` 87 通过（61 原有 + 26 新增：API 面/错误码/限制/注册表扩展性/
  import 图/CLI 子进程）；`npm run test:browser` 40 通过（+agent-artifact：CLI 产物 SVG
  在 Chromium 中着色/不越界，截图 test-results/screenshots/agent-arrow.png）；
  `npm run build:demo` 通过，gallery 视觉未变。
- 体积：dist/index.js 静态图 37.2kB（零 bare import）；dist/agent.js 图 67.7kB；
  dist/cli/pisvis.js 9.6kB；valibot 包体 ~291kB + to-json-schema ~166kB（node_modules 实测）。
- 复审修正：stdin 改为流式分块读并在超限时中止（不再整读）；产物写入改为 校验目标→写临时文件
  →提交 三段式，（b）段失败只清临时文件，旧产物字节不变；tsconfig.cli 收窄为 src/cli +
  ES2022+node types（src 内代码无需 DOM 类型即可编译）；箭头能力的坐标轴向正方向外推
  下一个整刻度+半单位，斜向中点标签改为垂直偏移≥labelOffset+半字号并选离轴更远一侧；
  JSON 产物文件补换行符。新增 stdin 超限、覆盖失败回滚、标签-箭杆间距断言。
- 未做（Issue #6 后续 PR）：MCP stdio 适配、消费 Skill 升级、冷启动消费评测、npm pack
  仓库外消费测试、Signals（按 Issue 决定推迟）。

## H. A1-2 MCP 与 Skill 记录

环境：Node 24.15.0 / npm 11.12.1 / TS 6.0.3 / SDK server+client 2.0.0 / Playwright 1.63.0。提交 340287b。

- 依赖（decisions/0002-mcp-sdk.md）：`@modelcontextprotocol/server@2.0.0`（runtime，MIT，2026-07-27；
  2.1.0 发布仅 5 天被 7 天规则弃用）+ `@modelcontextprotocol/client@2.0.0`（dev，测试）。
  server 传递依赖 core@2.0.0 + zod@4.6.5（2 个）；client 链共 11 个，仅测试安装。
- 工具注册路径：`McpServer.registerTool` + `toStandardJsonSchema`（valibot Standard Schema，
  `~standard.validate`+`~standard.jsonSchema` 两个接口都满足）——**业务 Schema 不写 zod**；
  SDK 的 zod 是它自己的内部校验依赖。协商协议：客户端请求 2025-11-25 → 2025-11-25。
- 六个工具 1:1 于 API：`pisvis_list/describe/create/validate/update/render`；
  `structuredContent` = API 结果信封（与 CLI stdout 同构）；领域失败 isError:true + 同构错误；
  render 的 SVG ≤64 KiB 内联为 text content，超出返回 too-large；无状态、无资源、无文件系统。
- 测试：tests/mcp.test.mjs 5 项（真实 stdio 握手+全流程+错误码+stdout 纯净+测试注册表经 MCP 通过，
  结果与直接 API 深相等）。import-graph 断言根/./agent 不含 MCP。
- 消费 Skill：skills/pisvis-authoring 重写为消费者文档（工作流八步 + 检查语义 + 错误处理）；
  references/{cli,mcp,errors,document}.md；assets/examples 从注册表生成；
  scripts/agent-docs.mjs --write/--check 防漂移（接入 npm run check），镜像到 .agents/skills/
  （gitignored，仅本地宿主发现便利，不动全局配置）。docs/agent/README.md + llms.txt +
  mcp.example.json。
- 包完整性：files=dist+skills+llms.txt+docs+README+LICENSE+AGENTS.md；bin 加 pisvis-mcp。
  scripts/pack-test.mjs：npm pack→临时目录消费项目（路径含空格）→npx pisvis / npx pisvis-mcp
  官方 client 握手/pisvis/agent import/Skill 文件存在/包内相对链接全解析。
  tarball 83 kB / 71 文件 / unpacked 223 kB。接入 CI（check 后）。
- 验证：npm ci 干净；npm run check 94 通过；npm run test:browser 40 通过；npm run test:pack 通过。
- 未做（PR 3）：冷启动消费评测、playground 经 API 创建/编辑场景、Issue §2 文档同步收尾。
- 注意：SDK 2.0.0 的 DEFAULT_NEGOTIATED_PROTOCOL_VERSION 常量显示 2025-03-26（历史兼容默认），
  实测协商 2025-11-25。npx/.bin 经符号链接运行 → isMain 用 realpathSync(argv[1]) 对比模块路径。

## I. A1-3 playground 接入与文档同步

环境：Node 24.15.0 / npm 11.12.1 / Playwright 1.63.0（Chromium 1243）。提交 13a84c7。

- playground/main.ts 重写：唯一事实源是 arrow@1 场景文档（createScene → updateScene →
  renderScene 自含样式 SVG + 手柄覆盖层）；数值输入 set-start/set-end（合并全精度分量）、
  拖动同 op、缩放走 set-viewport explicit、重置=重建默认文档；读数全部来自 API derived，
  页面不再重算 magnitude/atan2。ok:false 保留旧文档并把 API message+hint 写进 #status
  （输入引起的错误标 aria-invalid）。拖动夹限保留为 UI 注释约束。测试可读
  `window.__pvDocument()`（只读克隆）。
- 修正缺陷：arrow 能力在全退化坐标（如 (0,0)→(0,0)）下 tickFor 得到 1e-9 级刻度导致
  序列化循环挂死；span 现在夹到 ≥1 再选刻度，并补了全零场景渲染回归测试。
- M1 浏览器测试断言仅一处结构性改动：`#canvas svg polygon` → `polygon.pv-head`
  （场景 SVG 现在先渲染坐标轴头多边形，角色箭头头才在 `.pv-head`）。行为断言全部保留。
  新增「playground state IS an authoring document」：拖动/输入后 __pvDocument() 经
  validateScene 通过、derived 与读数一致。
- 文档同步（Issue §2）：PRODUCT 增 Agent-first 决策段（消费/开发 Agent 分工、同一边界）；
  ARCHITECTURE §1 更新真实结构与依赖方向；REUSE_AND_BINDINGS §5/§7 落地为现存契约；
  README/ROADMAP/AGENTS 状态行一致（A1 PR1+2 merged、PR3 实现完成、冷启动评测待收尾）。
- 测试：npm run check 95 通过；npm run test:browser 41 通过；npm run test:pack 通过。

### 冷启动评测（Codex，2026-09-28）

宿主：`codex exec`（codex-cli 0.156.1），模型 `gpt-6-astra`（provider openai，rollout
session_meta 记录），macOS arm64。隔离：临时 `CODEX_HOME`（仅 auth.json + MCP 配置，
无用户规则/AGENTS.md/历史），临时工作区 `npm install pisvis-0.0.0.tgz`（tarball 打包于
本分支工作树，早于下方 unknown-theme 增补），Skill 置于 `.agents/skills/pisvis-authoring`。
每次会话独立 `codex exec --ephemeral`（`--approve-for-me`，workspace-write 沙箱），
无人工提示、无源码阅读（仅读 Skill 与 references）。日志保留于 /tmp/pisvis-eval-codex/logs。

| 会话 | 意图（原文提示） | 实际调用链 | 结果 |
|---|---|---|---|
| A0（approval=never 对照） | 画 (0,0)→(3,2) 向量「速度 v」，存 out/vector.svg | SKILL.md → MCP list（被拒："requires approval"）→ 按 Skill 降级 CLI：capabilities → describe → create+render 经 stdin | 成功，SVG/scene/report 三产物齐全 |
| A（MCP） | 同上 | SKILL.md → `pisvis_list_capabilities` → `describe` → `create` → `validate` → `render` → 写文件 | 成功；产物核对：params/label/illustrated@2 正确，SVG 自含样式 |
| B（修改保持其余） | scene.json（主题 linework@1）终点改 (1,4)，其余不变 | SKILL.md → list → describe → validate → `update_scene` set-end → validate → render → 写回 | 成功；label/主题/canvas/instanceId 全部保留 |
| C（非法参数） | 主题「neon-blue」 | list → describe → create 失败 `unknown-theme` → 读 errors.md+document.md → 如实列出已注册主题并反问选用哪个 | 未产出文件，诚实待确认——不静默替换 |
| D（不支持的能力） | 平抛运动演示（轨迹+速度分解） | SKILL.md → list → 如实报告仅 arrow@1、不生成 throw.svg，引用 Skill 规则并提出替代方案 | 诚实拒绝，无伪造 |

发现与后续修正：C 的恢复靠 references/document.md 里的已注册主题清单——`unknown-theme`
错误本身当时未带 `allowedValues`（与 errors.md 的承诺不符）；本分支随后已为全部三处
unknown-theme 补 `allowedValues: ["illustrated@2","linework@1"]` 并加测试。另修复
`arrow.ts` 误写字面量控制字符导致的二进制文件问题（改为 `\x00-\x1f` 转义，语义不变）。

## J. M2 模板注册

环境：macOS 本机；Node 26.5.0 / npm 11.17.0 / TS 6.0.3 / Playwright 1.63.0（Chromium 1243）。
提交 6b2759c。
收尾复跑由主 agent 在仓库约定环境 Node 24.15.0 / npm 11.12.1 下完成：
npm run build:demo 通过、npm run test:browser 43 通过、npm run test:pack 通过
（tarball 95.6 kB / 86 文件，HANDOFF 增量使包体略增）。

实现 [Issue #3](https://github.com/Buqisir/pisvis/issues/3) 的数学模板部分：向量合成与
正交分解两个 `math-diagram` 能力注册进 A1 文档契约。SceneDocument 仍 schemaVersion 1，
未引入 Signals，无新增依赖。

### 实现要点

- `src/agent/capabilities/vector-add.ts`（vector-add@1）：params `{a, b, labels?{a?,b?,r?}}`；
  派生 `r`/`rLength`/`rDirection`（r=0 时 rDirection 为 null）；scene() 照 gallery.ts
  sum-* 结构：input A/B 箭头 + guide 虚线箭头 B′（a→r）+ guide 虚线段（b→r）+
  readonly 派生箭头 R + 原点 O；axes 与 fitPoints 覆盖 {原点, a, b, r} + axes 角点。
- `src/agent/capabilities/vector-decompose.ts`（vector-decompose@1）：params `{v, label?}`
  （默认 'V'）；派生 `vx`/`vy`/`length`/`direction`；scene() 照 gallery.ts dec-*：
  input V + component 虚线箭头 Vx/Vy + guide 虚线段 V→两分量 + 原点 O。
- 共享抽取：`capabilities/fields.ts`（coordinate/pointSchema/labelSchema/labelStyle）
  与 `capabilities/axes.ts`（tickFor/axesRange 改为接受 `Vec2[]`，内部仍含原点，
  padHi +0.5、span≥1 夹取不变；新增可选 `loPadTicks` 负向整刻度扩展——新能力传 1
  给轴下/轴左标签留位，arrow 用默认 0）。**arrow 渲染输出逐字节不变**：重构前后
  5 组参数（常规 3-4-5、负坐标+大坐标、全零退化、极小 0.05/0.02、同点带标签）的
  SVG 字符串相等。
- api.ts 不带能力名分支的通用化（新能力无需改 dispatch）：
  - `readonly-field` hint 改为「该字段由输入参数派生；可写参数与可用操作见 describe
    返回的 writable/operations」——不再硬编码 start/end；
  - `set-<param>` 对普通对象参数做字段级合并：`set-labels {a:'x'}` 保留 b/r 原值；
    完整对象（point 等）校验后合并等价整体替换，arrow 行为不变；
  - `operationsJsonSchema` 对表内未列名的 `set-<writable>` 操作，由该 param 的
    schema slice 经 `toJsonSchema` 派生（arrow 的 describe 输出不变，新能力自动获得）；
  - 「缺少 params」提示与零向量 warning 文案去箭头化。
- CLI/MCP 零改动：两者本就经注册表/API 驱动；pack 断言与测试更新到新目录。
- 生成物：`scripts/agent-docs.mjs` 的 examples 段改为按注册表逐能力输出
  `<id>-{create-minimal,update-variant,failure}.json`（原 3 个无前缀文件重命名为
  `arrow-*`），`.agents/skills` 镜像经同一脚本同步。

### 验证

- `npm run check`：typecheck 通过；`node --test` 103 通过（A1-3 的 95 + 本轮 8：
  两能力 happy path/派生数值、readonly-field 通用 hint、set-labels 合并、退化渲染、
  describe 全 op schema 覆盖）；`agent-docs:check` 无漂移。
- `npm run test:browser`：43 通过（41 + agent-artifact 扩为 3 个能力的独立 SVG 断言：
  着色非黑、全部 text 在 viewBox 内；arrow 保留标签-箭杆间距 ≥4px 断言）。
- `npm run build:demo` / `npm run test:pack`：通过（pack 断言更新为 capabilities
  total 3 与 examples 前缀命名；tarball 94.8 kB / 86 文件）。

### 已知限制 / 唯一优先下一步

- `labels` 只覆盖 a/b/r；B′、Vx/Vy、O 为固定构造标签，改主输入标签不会联动改名。
- 长自定义标签仍可能越界——与全库一致：固定锚点+人工偏移，无自动避让。
- vector-add 的 r=0 不触发 warning（warning 只看 `derived['length']===0`，命中的是
  decompose 的字段名）；但 derived 自身已含 `rLength:0`/`rDirection:null`。
- 唯一优先下一步：本 PR 合并后按 Issue #3 余量做交互与往返验收。提交 6b2759c。

## K. M3 平抛快照能力

环境：macOS 本机；仓库约定 Node 24.15.0 / npm 11.12.1 / TS 6.0.3 /
Playwright 1.63.0（Chromium）。分支 `m3-projectile`，提交 d8c48d4。

实现 [Issue #4](https://github.com/Buqisir/pisvis/issues/4) 的快照物理模型切片：
`horizontal-projectile@1`（kind `physics-model`）注册进注册表，参数
`{h,u,g,t}` 快照驱动轨迹与速度分解渲染。本切片**不含** Issue #4 的
时间播放、实例化、公式面板与 v-t 图（见下方未验证/限制）。模型卡
`docs/models/horizontal-projectile.md`（PR #11）为唯一公式来源。

### 实现要点

- `src/models/projectile.ts`：纯模型，无 DOM/网络。x=ut、y=h−g·t²/2、
  T=√(2h/g)、R=uT、落地速率 √(u²+2gh)、位移/速度角（`atan2` 经 `nz` 归一
  消除 -0）、轨迹等距采样（端点恰好落在 (R,0)，不低于地面）。`u=0`
  自由落体退化用 t 参数化（不除以 u），速度反向延长线中点不变量
  `midpointX = xP/2` 作为派生字段输出。
- `src/agent/capabilities/horizontal-projectile.ts`：params `{h,u,g,t}`；
  编辑器范围 h∈(0,100]、u∈[0,40]、g∈[1,20]、t≥0 有限；`t≤T` 是跨字段
  约束，由 physics 阶段校验，越界返回 `out-of-range`（path
  `document.params.t`，physics failed / math not_run，无部分提交）。
  派生 position/velocity/speed/alphaDeg/displacement/thetaDeg/T/R/
  landingSpeed/midpointX/landed（零向量角度为 null：t=0 时 thetaDeg=null，
  u=0 且 t=0 时 alphaDeg 也为 null；describe 示例注明判空）。scene()：axes + O（抛出点）+ land
  （落点）+ traj-done 实线 / traj-todo 虚线两段 path + P 小球 + v 实线
  箭头 + vx/vy 虚线分量箭头 + ext 虚线速度反向延长线至 xP/2。速度箭头
  共用显示比例 k=0.34·max(R,h,1)/|v(T)|（k 与 t 无关，等比真实缩放）；
  与 v 重合的分量箭头不重复绘制（t=0 的 vx、u=0 的 vy 等），零分量以
  pv-zero 零向量标记显示。
- `src/render/scene.ts`：SceneItem 新增 `path` 图元（points[]、dashed、
  label），渲染器输出 `pv-path` class、折线 polyline；label anchor
  'mid'/'end' 沿中点/末点切向放置。
- `src/agent/api.ts`：valibot 数值范围 issue（min_value/max_value/
  gt_value/lt_value）映射由 `invalid-type` 改为 `out-of-range`——
  范围错误与类型错误在错误码层面分开（behavior 变化，测试已覆盖）。
- 标签定位无自动避让：对 6 组代表参数（t=1 常态、t=1.8 晚期、u=0、
  t=0、t=T 边界 × illustrated/linework）用 Chromium getBBox 逐对 text
  实测至零重叠后固定偏移；t=T 帧所有元素聚于落点，vx 标签取右上折中
  位（距箭头 ~30px）。
- 注册表 4 能力：arrow < horizontal-projectile < vector-add <
  vector-decompose；CLI/MCP 零改动经注册表自动生效；`agent-docs.mjs`
  自动产出 horizontal-projectile-{create-minimal,update-variant,
  failure}.json（skills 与 .agents 镜像同步）。

### 验证

- `npm run check`：typecheck 通过；`node --test` 109 通过（103 + 本轮 6：
  模型卡验收值 h20/u10/g10 全等式、边界 t=0/t=T、u=0 退化、t>T 拒绝与
  原子更新、h 改后 T 重算、derived 只读）；`agent-docs:check` 无漂移。
- `npm run build:demo` 通过；`npm run test:browser` 45 通过（43 +
  agent-artifact 第 4 能力 SVG 断言 + projectile.html 演示页交互 spec：
  滑块/播放精确停 T/h 改后 T 重算/主题切换/文档经 validateScene 复核）。
- `npm run test:pack` 通过（tarball 104.5 kB / 94 文件；pack 断言更新为
  capabilities total 4 + 3 个 horizontal-projectile examples）。
- 人工目检：Chromium 截图 6 组参数（test-results/play/proj*.png），
  标签零重叠（getBBox 实测）、轨迹 done/todo 分段清晰、落点恰在地面、
  u=0 为竖直轨迹与 v 竖直向下。Firefox/WebKit **未跑**。
- `projectile.html` + `playground/projectile.ts`：演示级时间维度——
  t 滑块、播放/暂停/重置、0.5/1/2×、后台隐藏冻结墙钟基准、落地精确停
  T、改 h/u/g 先钳 t 再原子提交。全部经 `authoring` API 边界（set-t/
  set-h/set-u/set-g/set-theme），页面不自算物理。

### 已知限制 / 唯一优先下一步

- 本切片是快照能力 + 演示级播放页：Issue #4 的 ≥3 道题实例、原题/探索
  分离（演示页改参数直接改题，无变式状态隔离）、KaTeX 公式面板、
  vx/vy–t 图、多实例共存与隔离、切模式/加载/重置的订阅清理（当前单
  实例仅一 rAF）、Motion/KaTeX 依赖引入**均未做**。
- 标签为固定锚点+像素偏移，只对上述 6 组代表参数实测过；参数空间的
  其余组合（如 h/u 极端比例）可能出现未检测的标签重叠——无自动避让。
- `alphaDeg`/`thetaDeg` 在对应向量为零时为 null（t=0 位移零 → thetaDeg；
  u=0 且 t=0 速度零 → alphaDeg）——调用方需判空，describe 已注明。
- 唯一优先下一步：Issue #4 时间维度（播放/暂停/时间滑块 + 控制器
  生命周期），届时按 DEPENDENCIES 决策是否引入 Motion/KaTeX。

## L. M3 题型切片：实例/会话、v-t 视图、公式与动效适配

环境：macOS 本机；仓库约定 Node 24.15.0 / npm 11.12.1 / TS 6.0.3 /
Playwright 1.63.0（Chromium）。分支 `m3-questions`，基于 m3-projectile
基线 3fd68ef；四个隔离 worktree 并行实现后经集成提交合入：
3bb688e/9e5e6c9（questions）、0bd56f6（graph）、ee1f0aa（formula）、
328136f（motion）、0adc733（deps），集成提交 95db6b8、0599ca4、
a51c50a、45154dd。

实现 [Issue #4](https://github.com/Buqisir/pisvis/issues/4) 主体：
题型实例—会话分离 + 第二视图 v-t 图 + 受控 KaTeX 公式 + 受控 Motion
讲解动效 + 双面板演示页。

### 实现要点

- `src/questions/`：3 个深冻结原创实例（q-landing-time h45/u10 → T=3,
  R=30；q-range h20/u15 → T=2, R=30；q-velocity-decompose h20/u10/t1 →
  v=(10,−10)），各带教学目标与中文教学步骤；步骤为结构化
  `TeachingStep{text, cue?}`，cue 可绑时刻 t、注册公式 id 与聚焦区域
  （scene/graph/formula/conditions）。`editableParams=['h','u','g']`
  （t 不是题设条件）。`session.ts` 以 WeakMap 持有内部状态：
  createSession（可覆盖 instanceId 做同题多实例隔离）、sessionSetTime、
  sessionUpdateParams、sessionApply（通用 op 通道，与参数更新走同一
  mutate 边界）、sessionRestoreOriginal、sessionDestroy。改 h/u/g
  触发 original→explore；仅改 t 或 set-theme 不改模式；失败更新保留
  上一份有效文档；销毁后变更返回结构化 destroyed 错误。
- `src/agent/capabilities/projectile-speed-graph.ts`：第 5 能力
  `projectile-speed-graph@1`（physics-model），与 horizontal-projectile
  共享同一 params schema（t≤T 跨字段校验）；派生 T/vx/vy；渲染
  vx 常值线、vy=−gt 线、当前时刻游标（零长时省略）与两点。
  axes 图元新增 `xName`/`yName`/`xTick`/`yTick`（只用 `tick` 的旧调用
  输出字节不变）；`src/core/fit.ts`/`viewport.ts` 新增 `stretch`
  视口模式（x/y 各向异性缩放——函数图屏幕长度不再当物理长度）。
- `src/formula/`：受控 KaTeX 适配层。10 个注册公式（x-t、y-t、vx、
  vy、speed、T、R、landing-speed、traj、tan-alpha），
  renderFormula/renderAll/listFormulas；数值必须全部有限，traj 与
  tan-alpha 在 u=0 时显式 not-applicable；`throwOnError:true,
  trust:false, strict:'warn', output:'html'`；用户/Agent 文本不进入
  TeX（数值替换由代码生成）；错误结构化（unknown-formula/bad-value/
  not-applicable/formula-render）。
- `src/motion/`：`motion/mini` 薄适配层。固定教学序列三步（scene
  淡入位移 → vectors 强调 → panels 揭示），仅容器级 opacity/x/y/scale，
  时长均 <1s，纯 tween；cancel() 施加终态并 resolve；reducedMotion
  同步落终态；Node/SSR 无 DOM 安全导入。物理几何与时间不经动效。
- `projectile.html`/`playground/projectile.ts`：两个完全隔离的题板
  （各自 session + v-t 图文档 + 播放时钟 + 讲解态）；题目下拉、
  原题徽标/修改条件/恢复原题、t 滑块、播放/速率/主题、公式网格、
  页面级减少动效勾选（初始读系统偏好）；后台隐藏暂停按墙钟续播不跳帧；
  `__pvPanels` 调试快照供浏览器测试复核。
- 逐步讲解：「讲解演示」进入 guide 模式——入场仍是容器级三拍铺场，
  之后「上一步/下一步/结束」逐条走 TeachingStep：当前步高亮、计数
  i/N、cue.t 经会话边界驱动全视图跳时刻、cue.formula 点亮公式项、
  cue.focus 圈出相关区域；结束清空全部装饰。减少动效下 cue 语义不变
  （跳时刻/点亮不是动效，照常即时生效）。
- 依赖：katex@0.18.7 + motion@13.4.0 + @types/katex@0.16.8（发布龄
  22/12 天，满足 ≥7 天规则）；决策记录 docs/decisions/0003-katex.md、
  0004-motion.md；katex 传递依赖 commander 仅 CLI 使用，运行时
  katex.mjs 不引用。入口边界测试：root/agent dist 无 katex/motion/node:
  导入，公式隔离在 dist/formula。
- 注册表 5 能力：arrow < horizontal-projectile <
  projectile-speed-graph < vector-add < vector-decompose；tests/cli/
  pack 计数与 llms.txt、docs/agent/README.md（physics checks 描述
  修正：数学图 not_applicable、physics-model 可 passed）同步；
  agent-docs 生成 projectile-speed-graph 三份 examples。

### 验证

- `npm run check`：typecheck 通过；`node --test` 147 通过（含
  questions 10、speed-graph 9、formula 12、motion 7 与既有回归）；
  `agent-docs:check` 无漂移。
- `npm run build:demo` 通过：KaTeX 字体内置打包；projectile chunk
  288.35 kB（gzip 88.17 kB，含 katex+motion/mini）。
- `npm run test:browser` 51 通过（Chromium；projectile spec 7 条：
  双面板隔离/文档独立、滑块联动场景+读数+游标、播放精确停 T、切题
  重建会话、公式随 t 重渲染与 u=0 前提降级、逐步讲解 cue 驱动
  （跳 t/点亮公式/聚焦区域/退出清装饰）、减少动效下 cue 即时生效与
  切题退出、live 文档经 authoring 边界复核）。Firefox/WebKit **未跑**。
- `npm run test:pack` 通过（tarball 125.9 kB / 115 文件；新增
  dist/questions、dist/formula、dist/motion 与 graph examples 入包；
  pisvis/questions 导出可消费）。
- 人工目检：双面板全页截图——公式面板 10 式排版与代入数值正确、
  v-t 图 stretch 后可读、端点标签（vx/vy 与时刻点）经内推偏移不贴边。

### 已知限制 / 唯一优先下一步

- 逐步讲解按实例自带 TeachingStep 逐条走（cue 绑 t/公式/区域），入场
  三拍仅为铺场；减少动效只影响铺场与容器强调，cue 语义照常生效
  （符合设计：物理时间解析推进，高亮是状态不是动画）。
- 多实例经 instanceId 支持，页面实测 2 块题板；>2 未测。SVG id 隔离
  由 instanceId 保证，同名题例并发由会话隔离保证。
- v-t 图仅 vx/vy 两条曲线（无 |v| 合速度曲线）；图标签为固定偏移，
  仅对两套题参数实测，极端 h/u 比例未遍历。
- 播放时公式面板逐帧 replaceChildren 重渲染（10×KaTeX/帧）：当前规模
  无卡顿，未做 diff/缓存优化。
- 唯一优先下一步：Issue #4 收尾——PR 评审合并；之后按 ROADMAP 进
  M4 下一模型（斜抛/圆周待 Issue 指定），或按维护者反馈补键盘可达性
  与多实例压测。
