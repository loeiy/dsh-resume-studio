# Changelog

## [0.3.0] - 2026-10-20

### Added

- `resume_import` 工具：把已有的 `.doc` / `.docx` / `.odt` 简历读成纯文本，复用 LibreOffice Kit（`doc → txt`），不需要 Word COM。CLI 同步新增 `import` 命令
- `checkCompoundFileIntegrity()`：调用引擎之前先判老版 Office 复合文档是否被截断，直接报「尾部少了 N 字节，请另存为 .docx」，而不是让引擎抛 `invalid-document`

### Changed

- **数字规则改为「只在声称变化时要求证据」**：bullet 里出现提升/降低/优化/缩短等动词却没有数字才告警；纯功能描述与技能清单不再逐条告警；新增汇总规则（≥2 条声称变化且覆盖率 <50%）
- `meta.allowQualitative`：把这个开关设为 `true`，数字告警降级为 info，对应「没有数据可写、只做定性描述」的场景
- `resume_render` 直接返回 `issues` 明细，不再需要补一次 `resume_check`
- 加粗阈值统一为 **25%**（原代码按 30% 判，与 SKILL.md 自相矛盾）
- `stats` 新增 `claims` 与 `claimRatio`
- `SKILL.md` 增加「先判断输入形态」，明确旧简历走 `resume_import`，禁止手写解析器与 COM 转换

### Fixed

- 实际生效后 `tests/core.test.mjs` 的 numbers 用例改为断言「声称变化但无数字」
- 工具数从 5 个增加到 6 个

## [0.2.0] - 2026-10-20

### Added

- `resume_guide` 工具：插件自带写作指南（访谈流程、写作与加粗规则、压页与产物说明），可用 `topic` 只取一节；装插件即可，无需另外安装 `SKILL.md`

### Changed

- README 重写：以「怎么装、装完怎么用」为主线，删去示例数据与冗余说明
- 工具数从 4 个增加到 5 个

## [0.1.1] - 2026-10-20

### Fixed

- 声明 `inject = ['tools']`。修复安装后无法激活、报 `cannot get property "tools" without inject` 的问题（cordis 要求先声明依赖的服务）
- `apply` 改为同步注册：`defineTool` 在模块加载阶段解析，避免异步注册造成的时序问题

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
