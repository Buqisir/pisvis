# 0004 · 采用 motion（M3 有限教学序列）

日期：2026-09-28（UTC+08）。关联：[Issue #4](https://github.com/Buqisir/pisvis/issues/4) / [DEPENDENCIES](../DEPENDENCIES.md)。

## 问题

Issue #4 需要一个有限的教学序列——「显示情境 → 展开速度分解 → 聚焦公式/图像」——叠加在用户手动
控制的物理播放之上。真实物体运动继续由文档参数与解析式 t 驱动；动效只负责容器级元素
（场景容器、速度分组、公式/图像面板）的出现与强调，必须可整体取消并尊重减少动效偏好。

## 为什么借用而不是自研

- 多目标编排、delay 衔接、统一的 cancel/finished 生命周期是通用能力。
  `playground/motion.ts` 已有一层零依赖的手写 WAAPI 入场（`fill:'none'`，画廊页逐格入场），
  但它是演示页私有逻辑，不提供可复用的序列契约；教学序列需要由受审查的适配层承担。
- 选 motion 的 JavaScript API：薄封装 WAAPI/rAF，无框架耦合，不引入 React
  （react/react-dom 为 optional peer，未安装）。与 DEPENDENCIES「M3 使用 motion 的
  JavaScript API 做有限教学序列」一致；简单 CSS 反馈仍不需要它。
- 实际用 `import { animate } from 'motion/mini'`（framer-motion dom-mini 面，`animateMini`
  的别名）。两个理由：① 根入口 `motion` 的类型经 `framer-motion/dom` 引用
  `HTMLWebViewElement`（TS 6 lib.dom 已移除该类型，而 tsconfig.json 无 skipLibCheck，
  typecheck 报错）；mini 面类型只经 motion-dom，无此引用。② 实测打包体积明显更小
  （见下）。mini 面不 re-export 类型，适配层用 `typeof animate` 派生
  `AnimationControls`/`DOMKeyframes`，不直接 import 未声明的 motion-dom。

## 版本与元数据（npm，2026-09-28 核对）

- `motion@13.4.0`：MIT，发布于 2026-09-16（>7 天），运行时 `dependencies`。
- 传递依赖（`npm ls motion` 实测）：`framer-motion@13.4.4` → `motion-dom@13.4.4`
  → `motion-utils@13.3.0`；`tslib@2.8.1`。react/react-dom 是 optional peer，未安装。

环境：Node 24 / npm ci 复现，锁文件随 PR。

## 集成方式与测试

- 唯一适配点 `src/motion/index.ts` → `dist/motion/index.js`；根入口、`./agent`、CLI、MCP
  均不引用它（import-graph 测试断言 dist/index.js 与 dist/agent.js 的 bare imports 不含 motion）。
- `motion/mini` 的 ESM 入口在 Node 下可安全 import（无顶层 DOM 访问），故用静态 import
  而非动态懒加载；DOM 访问全部在函数内。
- 动画只写容器级 `opacity/translate/scale`；`type:'tween'` 显式声明——motion 对 transform
  属性默认 spring（motion-dom `getDefaultTransition`），弹簧曲线不允许进入教学序列，
  更不允许碰球体/轨迹/箭头等物理几何。
- `finished` 合约：motion 13.4 的 `controls.finished` 只 resolve 不 reject，且 cancel 后
  保持 pending；适配层自管 resolver——`cancel()` 取消全部 controls 并同步写入各步 `to`
  终态，`finished` 随之 resolve。
- 减少动效契约：`opts.reduced` 或 `prefers-reduced-motion: reduce` 时同步写终态、
  `finished` 立即 resolve、不创建动画；无 DOM 环境（SSR/Node）走同一即时分支，
  因为 `animate()` 在无 window 时会抛 `NodeList is not defined`。
- `tests/motion.test.mjs` 在 Node 覆盖：import 安全、`prefersReducedMotion()===false`、
  plan 的目标顺序（scene→vectors→panels）、时长 ≤1s、ease-out 白名单、from 键必达 to 键、
  目标白名单（拒绝 ball/trajectory 等物理几何名）、reduced 计划零时长、
  runTeachingSequence 的即时终态、缺目标跳过与 cancel 幂等。

## 实测体积

- node_modules：motion 868 kB（dist 832 kB）、framer-motion 5.7 MB、motion-dom 4.8 MB、
  motion-utils 312 kB（含 sourcemap/dts 及未用的 React/three/vgpu 面）。
- 实测打包增量（vite lib 模式，rolldown，仅 `import { animate }`）：
  `motion/mini` 15.2 kB min / 4.9 kB gzip；根入口 `motion` 80.3 kB min / 23.9 kB gzip。
- 本 PR 只交付适配模块，页面尚未导入，demo 包体不变；接入页面时以 `npm run build:demo`
  产物复测实际增量。

## 已知边界与移除路径

- 动效与物理播放不竞争同一属性：本适配只动容器元素，小球/轨迹由 `set-t` 命令与墙钟推进。
- 页面侧目标元素的选取（哪些 div/svg group 对应 scene/vectors/panels）属 Issue #4 余量，
  接入时再定；缺失目标只跳过对应步骤。
- 移除：删除 package.json 依赖 + `src/motion/` + `tests/motion.test.mjs` + 页面导入；
  内核、`./agent`、CLI 与 `playground/motion.ts`（手写 WAAPI 入场）不受影响。
