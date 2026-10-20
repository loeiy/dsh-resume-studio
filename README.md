# dsh-resume-studio

DeepSeek Harness 的简历插件：**一份 JSON → HTML / Word / PDF**，三套版式，自动压页，写作体检。

- **Word 与 PDF 同源**：Word 是母版，PDF 由它转出，不会出现「PDF 三页、Word 四页」
- **说几页就几页**：给它目标页数，它收紧行距、重排版、回读页数，直到不超页
- **不只排版，还会写**：内置访谈流程与加粗规则，Agent 调 `resume_guide` 就知道怎么问你

## 安装

要求：DSH ≥ 0.2，Node.js ≥ 20。

### 方式 A：GitHub（推荐）

图形界面：左侧 **插件** → 右上 **添加插件** → 粘贴仓库地址 → 安装

```
https://github.com/loeiy/dsh-resume-studio
```

命令行：

```powershell
dsh plugin add github:loeiy/dsh-resume-studio
```

固定到某个版本：

```powershell
dsh plugin add github:loeiy/dsh-resume-studio#v0.2.0
```

### 方式 B：本地目录（改代码即生效）

```powershell
dsh plugin add file:E:\dsh-resume
```

### 装完要重启

插件在启动时组合，装完请**完全退出 DSH 再打开**。之后在插件页能看到 `dsh-resume-studio`，对话里多出五个工具。

## 怎么用

装完之后不用记工具名，**直接说话**：

| 你说 | Agent 会做 |
|---|---|
| 帮我写份简历，投技术项目经理 | 调 `resume_guide` 读流程 → 分三轮问你 → 建 JSON → 出三件套 |
| 这是我的旧简历，帮我改成投交付负责人 | 读旧内容、重排模块、按新岗位调整措辞 |
| 这是 JD：（全文）。按它改，保持 2 页 | 分析 JD、改侧重点、用 `maxPages` 压到 2 页 |
| 用 sidebar 版式重出一版，只要 PDF | 换版式、换输出格式 |

**控制产出的三句话**：

- 页数：`最多 2 页` / `压到 1 页`
- 版式：`classic` / `minimal` / `sidebar`，可一次要三套对比
- 格式：`PDF 和 Word 都要` / `只要 PDF`

产物默认落在你指定的输出目录，命名 `<姓名>-简历.html/.docx/.pdf`。

### 五个工具（给想直接调的人）

| 工具 | 作用 | 必填 |
|---|---|---|
| `resume_guide` | 返回访谈流程、写作与加粗规则；`topic` 可取单节 | — |
| `resume_init` | 生成 JSON 骨架 | `outPath` |
| `resume_render` | 出 HTML / DOCX / PDF，自动压页 | `dataPath` |
| `resume_check` | 体检：数字覆盖、加粗占比、条目长度、页数 | `dataPath` |
| `resume_templates` | 列出三套版式 | — |

## 三套版式

| id | 观感 | 适合 |
|---|---|---|
| `classic` 经典蓝线 | 深蓝分区线、单栏、信息两列 | 银行 / 国企 / 制造 / 项目经理 |
| `minimal` 极简黑白 | 无彩色、细线、三列信息、字距标题 | 外企 / 咨询 / 学术 / 海外投递 |
| `sidebar` 侧栏信息带 | 灰底信息带 + 左侧竖线 + 页码 | 互联网 / 产品 / 技术 |

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
      "items": [{ "head": "公司名称", "sub": "职位", "date": "2022.04 - 至今",
                  "bullets": ["动词 **关键名词**，带一个可验证的结果数字。"] }]
    },
    { "kind": "list", "title": "专业技能", "bullets": ["**分类：**掌握的技术与工具"] }
  ]
}
```

- `**双星号**` = 加粗，HTML 与 Word 共用同一套标记
- `kind` 三种：`timeline`（带时间）、`project`（带项目介绍）、`list`（纯列表）
- 用 `resume_init` 可以直接生成一份可填的骨架

## 自动压页

`maxPages` 是约束，不是建议：

```
渲染 DOCX → 转 PDF → 回读页数 → 超页则行距 −1.5% → 重来（最多 7 轮）
```

## 体检规则

| 规则 | 级别 | 说明 |
|---|---|---|
| `contact` | error | 缺电话 / 邮箱 |
| `pages` | error | 超过 maxPages |
| `numbers` | warn | 单条无数字；全篇数字覆盖率 < 60% |
| `density` | warn | 单条超过 110 字 |
| `bold` | warn | 加粗字符占比 > 30% |
| `structure` | warn | 模块数 < 3 或 > 6 |
| `verbs` | info | 以「负责 / 参与 / 协助」开头 |
| `date` | info | 时间格式不统一 |

## 环境与限制

- 生成 PDF 需要 DSH 自带的 LibreOffice Kit，插件会自动查找；找不到时只出 HTML + Word（`formats="html,docx"`），或设置 `DSH_LO_CLI` / `DSH_LO_NODE`
- Word 与 LibreOffice 分页有 ±1–3% 差异：以「不超过 N 页」为目标，不承诺精确到行
- 字体不嵌入：对方机器缺微软雅黑时，建议直接发 PDF
- HTML 是连续长页预览，正式 PDF 以 DOCX 转出的那份为准

## 开发

```powershell
npm install
npm test        # 15 个用例
npm run release -- --bump patch   # 测试 → 升版本 → 打包到 dist/
```

推 `v*` tag 会自动跑测试、打包并创建 Release（见 `.github/workflows/release.yml`）。

## License

MIT

---

## English

A resume plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): one JSON → **HTML / DOCX / PDF**, three layouts, automatic page fitting and content lint. DOCX is the master; PDF is converted from it, so both paginate identically.

```bash
dsh plugin add github:loeiy/dsh-resume-studio
```

Tools: `resume_guide`, `resume_init`, `resume_render`, `resume_check`, `resume_templates`.
