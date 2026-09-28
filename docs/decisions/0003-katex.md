# 0003 · 采用 katex（M3 公式排版适配）

日期：2026-09-28（UTC+08）。关联：[Issue #4](https://github.com/Buqisir/pisvis/issues/4) / [DEPENDENCIES](../DEPENDENCIES.md) / [ARCHITECTURE §7](../ARCHITECTURE.md) / [REUSE_AND_BINDINGS §3](../REUSE_AND_BINDINGS.md)。

## 问题

M3 要把模型关系（x=ut、y=h−gt²/2、T=√(2h/g)、|v_T|=√(u²+2gh) 等）排版成可读
公式，与同一模型快照联动。排版只允许走受控适配：注册的公式 ID + 校验过的有限
数值代入，任何用户/Agent 文字不得进入 TeX；渲染结果可读降级为结构化错误。

## 为什么借用而不是自研

TeX 排版是通用基础设施，不承载项目语义；DEPENDENCIES.md 明确“不为零依赖自造
完整 TeX”，并指定 M3 用 katex。katex `renderToString` 无 DOM、无网络、确定性输出，
满足 Node 侧测试与浏览器同构。公式文字不作为计算来源：结果数值由注册 builder
计算（数值与 src/models/projectile.ts 显式对应，测试用模型函数交叉断言），
KaTeX 只负责把模板排成 HTML。

## 版本与元数据（npm，2026-09-28 核对）

- `katex@0.18.7`：MIT，发布于 2026-09-06T17:47Z（>7 天）。不选 0.18.8/0.18.9
  （发布于 2026-09-23，仅 5 天，按 7 天规则弃用）。
- `@types/katex@0.16.8`：MIT，devDependency。注：katex 自带 `types/katex.d.ts`
  且 exports 的 types 条件优先，@types 实为冗余影子包，本仓保留不动。
- 传递依赖：`commander@15.0.0`（MIT）——仅 katex 自带的 `bin cli.js` 使用；
  `import 'katex'` 走 `dist/katex.mjs`，全文 grep 无 commander 引用，
  运行库路径实际不加载传递代码。npm ls katex → commander@15.0.0。
- 环境：Node 24.15.0 / npm 11.12.1；依赖与锁文件已由前 PR 提交，本 PR 未改。

## 集成方式与测试

`src/formula/`（index.ts 公共面 + projectile.ts 注册表）→ `dist/formula/`。
API：`listFormulas()`、`renderFormula(id, values, {display?})`、`renderAll(ids,…)`。
渲染固定 `{throwOnError:true, trust:false, strict:'warn', output:'html'}`，
display 选项切 displayMode；数值一律 ≤6 位有效数字（指数形式转 `\times 10^{e}`）。
错误结构化：`unknown-formula` / `bad-value`（缺失/非数/非有限/组合溢出）/
`not-applicable`（u=0 时 traj、tan-alpha 的 ÷u 式；√(2h/g)、√(u²+2gh) 定义域）/
`formula-render`（KaTeX 自身抛错）。
`tests/formula.test.mjs` 覆盖全 ID 渲染、数值代入与模型交叉断言、退化与错误码、
两次调用 html 完全一致（确定性+调用隔离）、输出无 href=/javascript:、
以及 dist/index.js·dist/agent.js 导入图不含 katex 的隔离断言。

package.json 未新增 `./formula` 导出（private 包不发布；demo 页与现有
playground 一样由 vite 直接 import `../src/formula/index.js`）。
根 `.` 与 `./agent` 入口永不 import 'katex'。

## 实测体积

- 新增源码 src/formula ~12 kB → dist/formula ~9 kB（index 2.6 kB + projectile 5.7 kB
  + d.ts）。
- node_modules/katex/dist 共 3.0 MB：`katex.mjs` 592 kB（浏览器打包取此）、
  `katex.min.css` 28 kB、`dist/fonts` 1.1 MB / 60 个 woff2+woff+ttf。
- 字体为 SIL Open Font License 1.1（字体元数据声明，见 KaTeX/KaTeX#339；npm 包
  未随附单独 OFL 文本）；代码本体 MIT。
- demo 页尚未接入，故无打包增量可报；接入时按需引 css + 字体子集，不走 CDN。

## 安全边界与移除路径

- `trust:false` 阻断 \href/\includegraphics/\htmlClass 等（实测
  `\href{javascript:…}` 输出不含 href/javascript）；`throwOnError:true` 让坏 TeX
  走 `formula-render` 结构化错误而非半截 HTML；适配层永不拼接外部字符串进 TeX。
- 移除：删 dependencies 中 katex + src/formula + tests/formula.test.mjs +
  本文件；根入口、./agent、CLI、MCP、存档格式均不受影响。
