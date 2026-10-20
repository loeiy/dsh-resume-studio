# Changelog

## [0.1.0] - 2026-10-20

首个公开版本。

### Added

- 三套版式：`classic`（经典蓝线）、`minimal`（极简黑白）、`sidebar`（侧栏信息带）
- 一份 JSON 同时输出 HTML / DOCX / PDF，DOCX 为印刷母版，PDF 由它转换
- 自动压页：按 `maxPages` 逐轮收紧行距并回读页数（最多 7 轮）
- 写作体检：数字覆盖率、加粗占比、条目长度、时间格式、模块数量、页数
- 四个 DSH 工具：`resume_init` / `resume_render` / `resume_check` / `resume_templates`
- CLI：`render` / `check` / `templates` / `init`
- LibreOffice Kit 自动探测（环境变量 → DSH 安装目录 → 平台常见路径）
- `SKILL.md`：访谈套路、加粗规则、交付流程
- 14 个单元/集成测试

### Known limitations

- Word 与 LibreOffice 分页存在 ±1–3% 差异，以「不超过 N 页」为目标
- 字体不嵌入，目标机器缺字体时建议交付 PDF
