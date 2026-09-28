# 错误码（自动生成，勿手改）

来源：src/agent/errors.ts + types.ts ERROR_CODES。每个错误都带 `code` / `path` / `message`，
可能另带 `expected` / `allowedValues` / `hint`。

| code | 含义 | 修正 |
| --- | --- | --- |
| `missing-field` | 缺少必填字段 | 按 path 指出的字段补入；先用 describe 看 params Schema |
| `unknown-field` | 文档含未注册字段 | 删除 path 字段；本库不接受未声明字段的语义 |
| `invalid-type` | 类型或取值不合法 | 对照 expected 修正字段类型 |
| `non-finite` | 数值为 NaN 或 ±Infinity | 换成有限数 |
| `out-of-range` | 数值超出声明范围 | 按 expected 边界缩小数值 |
| `label-too-long` | 标签超过 200 字符 | 缩短 label 到 200 字符内 |
| `unknown-capability` | 请求的能力未注册 | 调用 listCapabilities 查看真实目录，不要猜名字 |
| `unknown-version` | 能力版本不存在 | 使用 allowedValues 中列出的精确版本号 |
| `unknown-theme` | 主题 id+version 未注册 | 用 allowedValues/描述里的已注册主题，需精确版本 |
| `unsupported-schema-version` | 文档 schemaVersion 不受支持 | 目前仅支持 schemaVersion 1 |
| `unit-mismatch` | unit 不是 dimensionless 或 params 带 unit 字段 | unit 固定为 'dimensionless'；params 不放 unit |
| `readonly-field` | 试图修改派生（只读）量 | 改可写字段（如 start/end），派生量自动重算 |
| `invalid-operation` | 修改操作不在白名单 | 只用 allowedValues 中的操作名 |
| `too-large` | 请求超过 256 KiB | 缩小输入；文件/STDIN 同样受限 |
| `too-deep` | JSON 嵌套超过 16 层 | 扁平化输入结构 |
| `invalid-json` | 输入不是合法 JSON | 检查引号/逗号/截断 |
| `render-failed` | SVG 生成失败 | 报告为 bug；先确认文档能过 validate |
| `usage-error` | CLI 用法错误 | 按 --help 与 hint 调整参数 |
| `io-error` | 文件读写失败 | 检查路径/权限/磁盘；out-dir 必须已存在 |
