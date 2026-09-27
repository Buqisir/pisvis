# pisvis

**从向量、坐标和几何开始，做自己的物理可视化库。**

pisvis 是一个独立的、面向高中物理教学与 Agent 的二维可视化项目。
我们的代码决定图形怎样生成、对象如何关联、交互如何发生；浏览器原生 SVG 负责显示。
它不是现成可视化框架的换皮，也不以重写浏览器或“一次做完全部高中物理”为目标。

## 当前真的有什么

| 已实现的种子能力 | 边界 |
| --- | --- |
| 二维向量运算、长度与单位方向 | 零向量方向返回 `null`，非有限值明确报错 |
| 世界坐标与 SVG 逻辑像素的双向换算 | 世界 y 向上；仅支持统一缩放和平移 |
| 自己计算箭杆与箭头几何 | 支持短箭头、重合端点；不是物理力的自动判定 |
| 纯函数输出 SVG 字符串 | 无 DOM 依赖，文字转义；不接受任意 SVG/HTML |
| 参数输入与缩放滑块实验页源码 | 暂无拖动、鼠标缩放、场景保存和自动标签排版 |
| TypeScript 检查、库构建、25 个 Node 测试 | 不代表浏览器交互或 Vite 构建已经验收 |

**初始化状态：核心检查已在沙盒通过；依赖完整安装、锁文件、Vite 演示构建与浏览器验收留给首轮 Issue。**
详细证据与环境限制见 [交接记录](docs/HANDOFF.md)。不把计划写成已完成的功能。

## 启动

建议使用 `.nvmrc` 指定的 Node 24。也声明兼容 Node 22.12+ 的 22 系列；首次接手需实际复核。

```sh
npm install
npm run check
npm run dev
```

初始化尚未提交 `package-lock.json`：联网本地 Agent 应先完成依赖复核、生成并提交锁文件；
之后使用 `npm ci` 复现，不手写或伪造依赖完整性数据。

`npm run build` 只编译库并输出 ESM 与类型声明到 `dist/`。
`npm run build:demo` 用 Vite 构建实验页到 `demo-dist/`。
`npm run verify:all` 包含核心检查与演示页构建，但仍不能替代浏览器交互测试。
项目暂设 `private: true`，防止误发 npm；这不改变 GitHub 仓库的公开状态。

## 一个真实可用的入口

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

这里只展示真实 API。`incline()`、自动受力分析、物理求解器和 Agent Tools 尚未实现。

## 自己做什么，借用什么

自己做：向量、坐标变换、几何生成、逐步增长的场景结构、交互约束、教学图形规则，以及有明确假设的物理模型。
借用：浏览器 SVG/HTML/CSS；以后接收 Pointer Events；开发期的 TypeScript、Vite，以及 Node 自带测试工具。
**核心没有第三方运行时依赖，也不绑定 React 或当前英语题库。**

## 给下一位开发者

先读 [AGENTS.md](AGENTS.md)，再看当前 GitHub Issue 中的 Spec。

- [架构与边界](docs/ARCHITECTURE.md)：各层职责、坐标、单位、安全与正确性。
- [依赖决策](docs/DEPENDENCIES.md)：为什么暂时只引入两个开发依赖。
- [教材题材地图](docs/CURRICULUM.md)：六本教辅的目录依据与我们的工程建议分开记录。
- [阶段路线](docs/ROADMAP.md)：每一步的交付与验收，不是全量开工清单。
- [Agent 创作 Skill](skills/pisvis-authoring/SKILL.md)：只使用已实现能力，不虚构工具。

## 教材与许可

保留仓库创建时的 [Apache-2.0 许可证](LICENSE)。
用户提供的教材/教辅 PDF 仅作为本地研究输入；不上传整书、扫描图、原题库、字体文件或未经授权的配图。
仓库记录必要的书名、页码与抽象需求，示例由项目独立编写；代码许可证不为参考资料提供再分发授权。
