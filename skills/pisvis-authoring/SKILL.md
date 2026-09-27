---
name: pisvis-authoring
description: Use the currently implemented pisvis vector, viewport, arrow geometry and SVG APIs to author small, checkable teaching diagrams; do not invent physics models or tools.
---

# pisvis 创作 Skill（初始化版）

适用于能访问本仓库并执行 JavaScript/TypeScript 的开发 Agent。
这是一份使用约定，不会自动注册 MCP/Agent Tools，不包含模型服务，也不保证生成结果正确。

## 先确认能力

读取 `README.md`、`src/index.ts` 和 `docs/ARCHITECTURE.md`。
当前只存在：向量运算、世界/SVG 坐标映射、箭头几何与 `renderArrowSvg`。
没有自动受力分析、斜面组件、电路求解、场景 JSON 导入或动画接口；需要时先提交小范围 Issue，
不要捏造 `drawInclineForceDiagram()` 或假装某个尚不存在的 Tool 已被调用。

## 创作步骤

明确教学意图、坐标正方向、量纲与已知条件。条件不足时提问或标注假设，不虚构数值依据。
使用真实 API 描述参数；把 SVG 逻辑像素和物理量分开。
零向量不加虚假的方向。数值需要检查；标签内容只能是文字，不能注入 SVG/HTML。

构建后可执行：

```js
import { vec2, renderArrowSvg } from './dist/index.js';
const svg = renderArrowSvg({
  start: vec2(0, 0), end: vec2(3, 2),
  viewport: { originPx: vec2(200, 200), pixelsPerUnit: 40 },
  widthPx: 480, heightPx: 320,
  label: '向量示意：坐标值不自动代表牛顿或米',
});
```

输出应附教学意图、假设、参数及检查结果，不只交一张漂亮图。
当前标签只是固定题注，没有自动避让；超出画布、标签过长等视觉问题需要人工检查。
参考教辅时记录实际读过的正文页；只读目录不能声称已经验证某道题。

## 完成前

运行 `npm run check`，浏览器内容另做演示构建与可视检查。
报告真实执行的验证；未运行时明确写未验证。新 API 落地后同步更新本 Skill 与可运行例子。
