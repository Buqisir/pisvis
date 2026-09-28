# 场景文档 v1

规范化 JSON，可保存/往返/再校验。字段：

```json
{
  "schemaVersion": 1,
  "instanceId": "arrow-528bd0ec",
  "templateId": "arrow",
  "templateVersion": 1,
  "unit": "dimensionless",
  "params": {"start": {"x": 0, "y": 0}, "end": {"x": 3, "y": 4}, "label": "向量"},
  "presentation": {
    "theme": {"id": "illustrated", "version": 2},
    "canvas": {"width": 640, "height": 360},
    "viewport": {"mode": "fit"}
  }
}
```

- `schemaVersion`：固定 1；其他值 → `unsupported-schema-version`。
- `instanceId`：`^[a-z][a-z0-9-]{0,63}$`；create 缺省时按参数 hash 自动生成。
- `templateId`/`templateVersion`：精确匹配注册能力，不解析 latest。
- `unit`：固定 `"dimensionless"`；其他值或 params 内 unit 字段 → `unit-mismatch`。
- `params`：能力专属字段；arrow 为 `start`/`end`（|x|,|y|≤1e6 有限数）+ `label`≤200 字符。
- `presentation.theme`：注册主题精确 id+version。
- `canvas`：宽高整数 64..4096。
- `viewport`：`{"mode":"fit"}` 自动适配；或
  `{"mode":"explicit","originPx":{"x":n,"y":n},"pixelsPerUnit":n}`（>0，≤4096）。

未声明字段 → `unknown-field`（严格对象，不会静默丢弃）；派生量（delta/length/direction）
不在文档里，由可写字段重算。

<!-- BEGIN GENERATED themes -->
当前注册主题（精确 id+版本，不解析 latest）：

- `illustrated@2`（默认，provisional）
- `linework@1`（候选）
<!-- END GENERATED themes -->
