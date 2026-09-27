# pisvis

**有自己审美、可以反复组合使用、由数学与物理关系驱动的二维教学可视化。**

pisvis 是独立的物理可视化库，不是每来一道题就临时生成一页代码。
自己掌握物理对象、题型模板、关系绑定、教学交互和视觉规则；通用几何、响应、校验、排版和渲染能力按需借用。
从向量、坐标和自己的箭头开始，但不把“所有东西都自己重写”当作目标。

## 给本地 Agent：从这里开始

[Spec 总纲 #2](https://github.com/Buqisir/pisvis/issues/2) 说明自研/依赖边界与产品目标。
按顺序执行：[M1 #1 工程复现与箭头拖动](https://github.com/Buqisir/pisvis/issues/1)
→ [M2 #3 视觉样板与可复用数学模板](https://github.com/Buqisir/pisvis/issues/3)
→ [M3 #4 平抛题型与多视图联动](https://github.com/Buqisir/pisvis/issues/4)。

先读 [AGENTS.md](AGENTS.md) 和 [交接记录](docs/HANDOFF.md)。每阶段提交小 PR，不一次实现整个路线图。

## 当前真的有什么

初始化基线为 d2168de；M1（[Issue #1](https://github.com/Buqisir/pisvis/issues/1)）已完成工程复现与端点拖动，详见 docs/HANDOFF.md 的 D 节。

| 已有能力 | 边界 |
| --- | --- |
| 二维向量运算、长度与单位方向 | 零向量方向返回 null，非有限值明确报错 |
| 世界坐标与 SVG 逻辑像素双向换算 | 世界 y 向上；仅统一缩放和平移 |
| 二维仿射变换与求逆（DOMMatrix 同构） | 奇异/近奇异矩阵返回 null，不静默近似 |
| 主题 token 与 CSS 变量适配 | 两套均为候选（A 轻质感科学插画 / B 精密清爽线描），未经批准 |
| 纯函数场景序列化 renderSceneSvg | 颜色只走 CSS 变量类名；实例 ID 命名空间隔离 |
| 视口自适应 fitViewport | 统一比例居中，退化范围不崩溃，结果不被裁剪 |
| 自己计算箭杆与箭头几何 | 支持短箭头/重合端点，不自动判断真实物理力 |
| 纯函数输出 SVG 字符串 | 无 DOM 依赖，文字转义，不接受任意 SVG/HTML |
| 实验页：坐标输入、缩放滑块、两端点原生拖动 | 演示层能力，非库 API；无模板保存或自动标签排版 |
| 类型检查、库编译、30 个 Node 测试、Chromium 浏览器测试 | Firefox/WebKit 与真实触摸设备尚未验收 |

依赖完整安装、真实锁文件（npm ci）、Vite 构建与 Chromium 交互验收已在 M1 完成。
仍未安装 Signals/Valibot/Motion/KaTeX，也未引入任何 GPU/布局框架，不把候选写成已完成。

## 建设方向

组件复用：箭头、坐标轴、物块和标注一处改进，多场景继承。
关系复用：不仅复用外观，还保存锚点、连接和量之间的联系。
题型复用：适用条件、参数、单位、模型、图形绑定、操作和讲解可重复实例化。

题目条件 → 明确模型 → 同一份有效状态 → 情境图、公式、函数图和读数。
主题、视口和标签位置不改变物理结果；同模板多个实例互不污染。
具体风格需用可运行样板确认，目前的候选不是维护者已经批准的品牌。

## 依赖分工

普通教学图以 SVG/HTML/CSS 和 Pointer Events 为主，小数学内核保持独立、无 DOM/网络。
M2 优先采用 Signals core 与 Valibot；M3 采用 Motion JavaScript 和 KaTeX 的局部适配。
thi.ng 按复杂几何需求评估；PixiJS、Penrose/Bloom、SceneryStack、TypeGPU 留作架构参考或隔离实验。

**零依赖是当前小内核的状态，不是全项目永久限制；候选列表也不是一次全部安装的清单。**
详见 [依赖决策](docs/DEPENDENCIES.md)、[技术参考与官方来源](docs/TECH_RADAR.md)。
不绑定 React、英语题库或某个 Agent SDK，不预建多包工程。

## 启动现有种子

使用 .nvmrc 的 Node 24（已在 24.15.0 / npm 11.12.1 验证）。

```sh
npm ci
npm run check
npm run dev          # /index.html 实验台；/gallery.html 视觉候选样板
                     # npm run test:browser 跑 Chromium 交互测试
```

仓库含真实 package-lock.json；锁文件存在后始终用 npm ci 复现。

npm run build 只编译库，ESM 与类型声明输出到 dist/。
npm run build:demo 用 Vite 输出实验页到 demo-dist/。
npm run verify:all 包含核心检查与实验页构建，但仍不能替代浏览器测试。
项目保留 private:true，防止误发 npm；不改变 GitHub 仓库的公开性。

## 现有真实 API 示例

在仓库内构建后：

```js
import { vec2, renderArrowSvg } from './dist/index.js';

const svg = renderArrowSvg({
  start: vec2(-2, -1),
  end: vec2(2, 1),
  viewport: { originPx: vec2(320, 180), pixelsPerUnit: 50 },
  widthPx: 640,
  heightPx: 360,
  label: '位移示意（未指定物理单位）',
});
```

模板实例、平抛模型、自动受力分析和 Agent Tools 尚未实现；以上仅展示真实可用入口。

## 设计文档

- [产品方向](docs/PRODUCT.md) / [视觉设计](docs/VISUAL_DESIGN.md)：审美样板、教学表达和复用目标。
- [架构](docs/ARCHITECTURE.md) / [复用与数学绑定](docs/REUSE_AND_BINDINGS.md)：模型、实例、表示、版本和约束。
- [依赖](docs/DEPENDENCIES.md) / [技术参考](docs/TECH_RADAR.md) / [实验](docs/EXPERIMENTS.md)：先采用什么、研究什么，以及退出条件。
- [路线](docs/ROADMAP.md) / [教辅地图](docs/CURRICULUM.md) / [交接](docs/HANDOFF.md)：实施顺序、来源边界和实际验证。
- [Agent 创作 Skill](skills/pisvis-authoring/SKILL.md)：只使用已经实现并核验的能力。

## 资料与许可

保留仓库创建时的 [Apache-2.0 LICENSE](LICENSE)。
用户提供的教材/教辅只作为有权访问的研究输入，不上传整书、扫描页、原题库、字体文件或未经授权配图。
记录必要的来源定位与抽象需求，示例独立编写；代码许可证不为参考资料或第三方品牌提供再分发授权。
