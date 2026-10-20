# dsh-resume-studio

**简历工坊** —— 一份简历 JSON，出 HTML / Word / PDF，带三套版式、自动压页与写作体检。

> 本仓库只包含工具本身：不含任何示例简历、个人数据或截图。

## 为什么值得装

- **Word 和 PDF 同源**：Word 是印刷母版，PDF 由它转出，不会出现「PDF 三页、Word 四页」
- **三套版式自己写**：不依赖任何简历模板站，可商用（MIT）
- **自动压页**：给它目标页数，它收敛行距、重排版、回读页数，直到不超页
- **写作体检**：数字覆盖率、加粗占比、条目过长、时间格式、模块数量，逐条给位置
- **无前端**：四个工具，纯对话驱动，不给 DSH 加界面负担

## 安装

### DSH 用户

```powershell
dsh plugin --profile desktop add dsh-resume-studio
```

或者手动挂载：编辑 `~/.dsh/profiles/desktop/cordis.patch.yml`，追加

```yaml
- insert:
    - id: resume-studio
      name: dsh-resume-studio
      config:
        outDir: ~/.dsh/resumes/out   # 可选：默认输出目录
        maxPages: 2                  # 可选：默认目标页数
```

重启 DSH 后获得四个工具：`resume_init` / `resume_render` / `resume_check` / `resume_templates`。

### 只用命令行

```powershell
npm i -g dsh-resume-studio
dsh-resume templates
dsh-resume render --in resume.json --out out --templates classic --max-pages 2
```

## 30 秒上手

```powershell
dsh-resume init --out resume.json      # 生成骨架
# 填内容（或让 Agent 按 SKILL.md 的访谈套路问你）
dsh-resume check  --in resume.json     # 先体检
dsh-resume render --in resume.json --out out --max-pages 2
```

产物：`out/<姓名>-简历.html`、`.docx`、`.pdf`。

## 三套版式

| id | 气质 | 适合 |
|---|---|---|
| `classic` 经典蓝线 | 深蓝分区线、单栏、信息两列 | 银行 / 国企 / 制造 / 项目经理 |
| `minimal` 极简黑白 | 无彩色、细线、三列信息、字距标题 | 外企 / 咨询 / 学术 / 海外投递 |
| `sidebar` 侧栏信息带 | 灰底信息带 + 左侧竖线 + 页码 | 互联网 / 产品 / 技术 |

一套 JSON 可以同时出三套，先看效果再定。

## 数据格式

```json
{
  "meta": { "template": "classic", "maxPages": 2 },
  "basics": {
    "name": "你的姓名",
    "intent": "求职意向：目标岗位",
    "fields": [["电话", "13800000000"], ["邮箱", "you@example.com"]]
  },
  "sections": [
    {
      "kind": "timeline",
      "title": "工作经历",
      "items": [
        {
          "head": "公司名称",
          "sub": "职位",
          "date": "2022.04 - 至今",
          "bullets": ["动词 **关键名词**，带一个可验证的结果数字。"]
        }
      ]
    },
    {
      "kind": "project",
      "title": "项目经历",
      "items": [
        {
          "head": "项目名称",
          "sub": "角色",
          "date": "2023.03 - 2024.06",
          "intro": "**项目介绍：**一两句说清业务与规模。",
          "label": "职责与成果：",
          "bullets": ["**小标题：**动作 + 机制 + 结果。"]
        }
      ]
    },
    { "kind": "list", "title": "专业技能", "bullets": ["**分类：**掌握的技术与工具"] }
  ]
}
```

- `**双星号**` = 加粗，HTML 与 Word 共用同一套标记
- `kind` 三种：`timeline`（带时间的条目）、`project`（带项目介绍）、`list`（纯列表）
- 用 `resume_init` / `dsh-resume init` 可以直接生成一份可填的骨架

## 自动压页

`resume_render` 的 `maxPages` 不是建议而是约束：

```
渲染 DOCX → 转 PDF → 回读页数 → 超页则行距 −1.5% → 重来（最多 7 轮）
```

代价是行距可能有细微变化；收益是「说几页就几页」，且 Word 与 PDF 始终一致。

## 体检规则

| 规则 | 级别 | 说明 |
|---|---|---|
| `contact` | error | 缺电话 / 邮箱 |
| `pages` | error | 超过 maxPages |
| `numbers` | warn | 单条无数字；全篇数字覆盖率 < 60% |
| `density` | warn | 单条 > 110 字（超过两行） |
| `bold` | warn | 加粗字符占比 > 30% |
| `structure` | warn | 模块数 < 3 或 > 6 |
| `verbs` | info | 以「负责 / 参与 / 协助」开头 |
| `date` | info | 时间格式不统一 |

## 设计说明（几个踩过的坑）

1. **只用固定行距，不用倍数值**。Word 的「1.41 倍」按字体自然行高放大，微软雅黑下实际约 1.86em，同一份内容会从 3 页涨到 5 页。
2. **Word 当母版，PDF 由 Word 转**。两条独立渲染管线必然分叉，所以只保留一条。
3. **标题 `keepNext`**，避免「工作经历」孤零零落在页底。
4. **中文字体显式声明 `w:eastAsia`**，否则 Word 里会回落宋体，版式全散。
5. **页数用 `pdf-lib` 回读**，不靠字数估算。

## 环境要求

- Node.js ≥ 20；DSH ≥ 0.2
- 生成 PDF 需要 DSH 自带的 LibreOffice Kit，插件会自动查找；找不到时：
  - 设置 `DSH_LO_CLI`（`libreoffice-kit/lib/cli.js`）与 `DSH_LO_NODE`
  - 或只出 HTML + Word：`formats="html,docx"`

## 已知限制

- Word 与 LibreOffice 分页算法有 ±1–3% 差异：以「不超过 N 页」为目标，不承诺精确到行
- 字体不嵌入：目标机器缺微软雅黑时，建议直接发 PDF
- HTML 是连续长页预览（不是分页视图），打印由浏览器 `@page` 处理；正式 PDF 以 DOCX 转出的那份为准

## 开发

```powershell
npm install
npm test        # 14 个用例：解析、校验、三套版式渲染、插件注册
npm run render  # 生成骨架并渲染一套（输出到 out/，已被 gitignore）
```

写作与访谈规则见 [`SKILL.md`](SKILL.md)，可整份交给 Agent 使用。

## License

MIT

---

## English

A resume workshop plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

One JSON → **HTML + DOCX + PDF**, three hand-built layouts, automatic page fitting, and content lint (quantified bullets, bold density, entry length). DOCX is the master; PDF is produced from it, so both always paginate identically.

```bash
dsh plugin --profile desktop add dsh-resume-studio
```

Tools: `resume_init`, `resume_render`, `resume_check`, `resume_templates`.
