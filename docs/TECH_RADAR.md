# 技术参考与采用顺序

核对日期：2026-09-28（UTC+08）。依据为下列官方文档；这是能力与取舍记录，
不是在 pisvis 完成安装、基准测试或兼容性验收的报告。具体版本在引入当时复核并记录，不抄一个会漂移的 latest。

## 决策一览

| 技术 | pisvis 的决定 | 接入位置/触发条件 |
| --- | --- | --- |
| TypeScript、Vite、Node 内建测试 | 维持工程起点，M1 更新与复现版本 | 编译、实验页、核心测试 |
| SVG/HTML/CSS、Pointer Events | 继续作为普通教学图主线 | 浏览器显示/输入，数学不依赖 DOM |
| `@preact/signals-core` | M2 优先采用，不自造通用响应引擎 | 实例控制与多视图联动 |
| `valibot` | M2 优先采用，不只靠 TS 类型校验 JSON | 参数、存档和命令边界 |
| `motion` JavaScript API | M3 的有限教学序列采用 | 表现适配；简单 CSS 反馈无需它 |
| `katex` | M3 公式面板采用 | 公式显示，不参与求值 |
| `@thi.ng/geom`、`@thi.ng/vectors` | 按真实复杂几何需要评估 | 几何适配，不替换全部现有小算法 |
| `pixi.js` | 密集动态 2D 的候选后端 | 独立性能/效果实验通过后采用 |
| Penrose / `@penrose/bloom` | 前者借鉴结构，后者可做布局实验 | 语义/实例/样式分离；不作物理求解器 |
| SceneryStack | 先读架构，必要时试一个模块 | 教学模型、可访问性与生命周期参考 |
| `typegpu` | 独立前沿实验，不进入首个题型前置 | WebGPU 场/粒子绘制或计算 |

所有候选都已留档，但不是 npm install 清单。M1 不因本表扩范围；M2/M3 不被后续实验阻塞。
“优先采用”允许执行 Agent 在该阶段完成版本/许可/小测试后接入；若有实际阻塞，提交短 ADR 说明替代，
而不是悄悄更换为另一整套框架。大型后端、求解器或状态体系替换仍须维护者确认。

## 1. thi.ng：通用几何的按需工具箱

官方将 umbrella 定义为可组合、可单独使用的 TypeScript 库生态，含向量、几何与 SVG 等工具。
各包独立版本；“只引一个包”不等于没有传递依赖。[S1]

项目决定：保留现有简单 vec2/箭头实现，遇到明确的曲线、求交、采样等难点时，对比最小自研与选定函数。
用 pisvis 普通数据包住第三方类型，统一可变/不可变、容差与退化输入语义；不复制源码后冒称原创。
不引入它的另一套响应系统来与 Signals 并存。

本次官方 README 提示已迁往 Codeberg、GitHub 为只读镜像；开发分支可能描述尚未发布能力。
执行者从官方入口再次确认仓库、发布包和对应版本文档，不绑定旧镜像路径作为唯一长期依据。[S1]

## 2. Signals：联动，不是方程求解

核心包提供 signal、computed、effect、batch，以及订阅清理方式。[S2]
项目用它连接同一实例的输入、派生快照和视图，不要求 React/Preact 组件树进入核心。
纯模型可以离开 Signals 直接调用；第三方 Signal 不进入存档或公共题型数据。

只维护一份权威输入，计算由纯函数负责；禁止多套 effects 互相写回制造循环。
batch 后集中更新不意味着失败可回滚，必须先校验候选再提交；卸载必须 dispose。
使用已发布版本支持的 API，不因为主分支 README 出现新方法就假定锁定版本也有。

## 3. Valibot：运行时边界

Valibot 提供模块化 schema、运行时解析/校验与静态类型推导。[S3]
项目将其用于不可信数据入口，并补充自己的引用、版本、量纲/范围及语义校验。
不把“schema 通过”当物理正确性证明；未知语义字段不静默删除，错误不部分提交状态。

## 4. Motion：教学表现

JavaScript animate API 可控制动画、SVG 表达和序列；本项目只评估所需的开放 API，不默认购买 Motion+。[S4]
项目用它呈现标注、辅助线和讲解焦点，真实位置仍来自物理模型。
动画目标、清理和减少动效策略由适配器管理；避免与模型渲染竞争同一属性。
已有 CSS/原生能力足够的简单反馈不必包装成动画框架。

## 5. KaTeX：公式排版

KaTeX 提供 DOM 渲染和字符串输出接口；安全文档列出 trust、maxExpand、maxSize 等配置和错误信息风险。[S5][S6]
项目不自研 TeX 排版器；公式采用已注册模板，计算来自模型，不从 LaTeX 字符串求值。
限制长度与扩展、保持 trust:false、隔离实例宏、错误作为文字显示。CSS/字体资产需记录来源和构建加载方式。

HTML 公式不自动成为纯 SVG 内的矢量公式；首轮使用 HTML 面板。完整打印、字体嵌入或公式转矢量另开任务。
不得把字体二进制、系统字体或教辅素材提交到源码；合法 npm 包资产可由锁定依赖和构建管理。

## 6. PixiJS：可选动态渲染后端

官方 v8 渲染文档提供 WebGL/WebGPU 后端。本次文档仍将 WebGPU 标为实验性，并建议生产优先 WebGL；
也未将 Canvas 2D 回退标为已完成，不能假定选择 PixiJS 就自动获得无 GPU 回退。[S7]

项目决定：普通线图仍用 SVG。先用密集粒子/场显示的代表场景测可见收益、包体与硬件表现，
再考虑 PixiJS 适配；不要将全部场景文档改成 Pixi Container。
Canvas 图像需独立处理可访问性、命中、清晰度、资源释放和导出。后端切换不改变模型。

## 7. Penrose / Bloom：关系和样式分离的参考

Penrose 区分 Domain（对象/关系词汇）、Substance（具体内容）与 Style（视觉表达）；
Bloom 提供 JavaScript/TypeScript 中的交互图形创作入口。[S8][S9]

项目借鉴“关系不依赖样式、实例不复制定义”，不直接重写整个 Penrose，也不立即采用其语言作为存档格式。
Bloom 仅在标签/布局问题上做有边界实验。优化的候选变量限于标签等表现信息；
硬性物理关系由模型算定，不能作为可松动的视觉目标。必须检验固定输入的稳定性、失败提示和人工回退。

## 8. SceneryStack：教学系统参考

官方概览组织了模型/显示分离、Axon 可观察数据、Dot 数学、Kite 几何与 Scenery 显示等能力。[S10]
项目重点研究参数控件、重置、可访问性、资源生命周期等设计。
不同时安装 Axon 与 Signals 管同一状态；不同时维护两套场景真相。
若试某个模块，先核对它实际带入的依赖和接口，不假定所有子库都可零成本单独搬用。
框架代码、示例、品牌、仿真内容和资产的许可分别检查，不能因公开可看就直接复制整套 PhET 作品。

## 9. TypeGPU：保留前沿创造空间

TypeGPU 官方提供模块化 WebGPU 工具以及用 TypeScript 表达着色器的能力，并有 Skill 入口。[S11]
这不等于任意 TS 都可在 GPU 上运行；具体 API、语法与构建插件按选定正式版本验证。

只在独立实验中探索二维场/粒子效果，先做 CPU 参考值与 GPU 数值/颜色对照，记录浮点误差和设备限制。
处理 API 不可用、设备丢失、资源清理和降级；不支持 GPU 时普通教学功能仍能工作。
不要求同时用 PixiJS 和 TypeGPU 画同一层，也不把 GPU 硬件结果当作自动正确的物理答案。
外部 Skill 先阅读审查，不执行来源不明的安装脚本；它不越过本仓库约束。

## 官方来源（技术事实；不是教材依据）

- [S1 thi.ng 官方仓库与迁移入口](https://github.com/thi-ng/umbrella)
- [S2 Signals core README](https://github.com/preactjs/signals/blob/main/packages/core/README.md)
- [S3 Valibot introduction](https://valibot.dev/guides/introduction/)
- [S4 Motion JavaScript animate](https://motion.dev/docs/animate)
- [S5 KaTeX API](https://katex.org/docs/api)
- [S6 KaTeX security](https://katex.org/docs/security)
- [S7 PixiJS v8 renderers](https://pixijs.com/8.x/guides/components/renderers)
- [S8 Penrose reference](https://penrose.cs.cmu.edu/docs/ref)
- [S9 Bloom getting started](https://penrose.cs.cmu.edu/docs/bloom/tutorial/getting_started)
- [S10 SceneryStack overview](https://scenerystack.org/learn/overview/)
- [S11 TypeGPU official docs](https://docs.swmansion.com/TypeGPU/)

上面的接入层、试验安排、安全与复用要求是 pisvis 的工程决定，不是上游对本项目的性能/安全承诺。
维护者应在实际采用时记录包元数据、对应 tag、许可与必要安全检查，避免把滚动文档当永久支持保证。
