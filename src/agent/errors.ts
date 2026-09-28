import type { ErrorCode } from './types.js';

/** zh meaning + actionable fix for every stable error code (drives generated docs). */
export const ERROR_DOCS: Readonly<Record<ErrorCode, { meaning: string; fix: string }>> = {
  'missing-field': { meaning: '缺少必填字段', fix: '按 path 指出的字段补入；先用 describe 看 params Schema' },
  'unknown-field': { meaning: '文档含未注册字段', fix: '删除 path 字段；本库不接受未声明字段的语义' },
  'invalid-type': { meaning: '类型或取值不合法', fix: '对照 expected 修正字段类型' },
  'non-finite': { meaning: '数值为 NaN 或 ±Infinity', fix: '换成有限数' },
  'out-of-range': { meaning: '数值超出声明范围', fix: '按 expected 边界缩小数值' },
  'label-too-long': { meaning: '标签超过 200 字符', fix: '缩短 label 到 200 字符内' },
  'unknown-capability': { meaning: '请求的能力未注册', fix: '调用 listCapabilities 查看真实目录，不要猜名字' },
  'unknown-version': { meaning: '能力版本不存在', fix: '使用 allowedValues 中列出的精确版本号' },
  'unknown-theme': { meaning: '主题 id+version 未注册', fix: '用 allowedValues/描述里的已注册主题，需精确版本' },
  'unsupported-schema-version': { meaning: '文档 schemaVersion 不受支持', fix: '目前仅支持 schemaVersion 1' },
  'unit-mismatch': { meaning: 'unit 不是 dimensionless 或 params 带 unit 字段', fix: "unit 固定为 'dimensionless'；params 不放 unit" },
  'readonly-field': { meaning: '试图修改派生（只读）量', fix: '改可写字段（如 start/end），派生量自动重算' },
  'invalid-operation': { meaning: '修改操作不在白名单', fix: '只用 allowedValues 中的操作名' },
  'too-large': { meaning: '请求超过 256 KiB', fix: '缩小输入；文件/STDIN 同样受限' },
  'too-deep': { meaning: 'JSON 嵌套超过 16 层', fix: '扁平化输入结构' },
  'invalid-json': { meaning: '输入不是合法 JSON', fix: '检查引号/逗号/截断' },
  'render-failed': { meaning: 'SVG 生成失败', fix: '报告为 bug；先确认文档能过 validate' },
  'usage-error': { meaning: 'CLI 用法错误', fix: '按 --help 与 hint 调整参数' },
  'io-error': { meaning: '文件读写失败', fix: '检查路径/权限/磁盘；out-dir 必须已存在' },
};
