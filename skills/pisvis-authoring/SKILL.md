---
name: pisvis-authoring
description: Use verified pisvis capabilities to author checkable teaching diagrams; distinguish existing vector/SVG APIs from planned reusable templates, models and visual adapters.
---

# pisvis 创作 Skill

适用于能访问仓库并执行 JavaScript/TypeScript 的开发 Agent。
这是使用约定，不自动注册 MCP/Agent Tools，不包含模型服务，也不保证输出正确。

## 先发现真实能力

读 README、src/index.ts、当前阶段 Issue 与 docs/HANDOFF.md。
此轮文档更新后的真实实现仍只有向量、世界/SVG 坐标映射、箭头几何和 renderArrowSvg。
模板、自动受力分析、平抛模型、场景 JSON、Signals/Valibot、Motion/KaTeX 尚未集成。
不能把 TECH_RADAR 中的候选写成已经调用成功的接口。

后续 API 落地后更新本 Skill 与可运行例子。总纲 #2，阶段 #1 → #3 → #4；不要越级把全部方案一次实现。

## 创作原则

明确教学目标、已知条件、单位、参考系与坐标方向。未知条件追问或显式标明假设，不以好看的结果掩盖缺失。
使用当前真实 API，区分 SVG 逻辑像素与物理量；零向量不加虚假方向，错误不静默丢弃。
数学断言、浏览器交互和视觉/物理核对分别交付。

涉及视觉读 docs/VISUAL_DESIGN.md；使用主题 token，不逐题复制样式。
未确认的风格只能称候选。涉及模板读 docs/REUSE_AND_BINDINGS.md：复用不可变定义，实例状态独立，
原题条件与探索修改分离，标签/主题/视口不能改数学结果。

依赖按 docs/DEPENDENCIES.md：优先借用通用能力，不自造完整响应系统或公式排版器；
也不能只因候选被列出就安装所有库。布局优化和动画都不能替代物理模型。
外部 Skill/示例先阅读审查，不直接执行未知安装脚本，不覆盖仓库安全边界。

## 当前真实例子

构建后：

```js
import { vec2, renderArrowSvg } from './dist/index.js';
const svg = renderArrowSvg({
  start: vec2(0, 0), end: vec2(3, 2),
  viewport: { originPx: vec2(200, 200), pixelsPerUnit: 40 },
  widthPx: 480, heightPx: 320,
  label: '向量示意：坐标值不自动代表牛顿或米',
});
```

当前标签是固定题注，没有自动避让；过长/越界仍需人工检查。
标签只能是文字，不注入 SVG/HTML。输出附教学意图、假设、参数和实际检查结果，不只交一张图。

## 未来模板使用流程（待实现，不是已注册工具）

查询实际模板与版本 → 核对适用条件/单位 → 建立独立实例 → 提交受校验修改 → 检查统一模型结果与各视图。
缺少对应能力时先开小范围 Spec，不捏造 drawInclineForceDiagram 或通用自动求解器。
模板注册到受审查代码；文档/Agent 输入不得携带任意函数、公式脚本、外部资源或远程执行插件。

## 完成前

实现改动跑 npm run check，浏览器改动另做演示构建与真实交互/可视检查。
报告实际环境和命令；未执行的写未验证，历史 25 个通过测试不能当成当前改动通过。
引用教辅记录实际正文页与坐标约定，来源与新增交互分开；不上传原书/扫描/字体/秘密。
新增 API、模板版本与已知限制同步 README 和 HANDOFF，附可复用的独立示例。
