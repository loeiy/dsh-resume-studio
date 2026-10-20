/**
 * DSH（cordis）插件入口：把简历能力注册成 5 个工具。
 * 工具全部在宿主进程执行，直接读写你指定的绝对路径。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { checkResume, listTemplates, loadData, renderResume } from './api.js'

export const name = 'dsh-resume'
export const description = '简历渲染：结构化 JSON → HTML / DOCX / PDF，自带版式、页数校验与写作规则检查'

// cordis：不声明 inject 就访问 ctx.tools 会抛
// "cannot get property 'tools' without inject"
export const inject = ['tools']

/**
 * 宿主里的 @deepseek-ai/dsh-tools 不在依赖树时（例如独立 CLI 或测试环境），
 * 用这个等价的本地实现，保证注册进去的 definition 形状与宿主一致：
 * parameters 必须是 JSON Schema（而不是简写表）。
 */
export function localDefineTool(options) {
  const properties = {}
  const required = []
  for (const [key, spec] of Object.entries(options.parameters || {})) {
    const { required: isRequired, ...rest } = spec
    properties[key] = { ...rest }
    if (isRequired) required.push(key)
  }
  const parameters = {
    type: 'object',
    properties,
    ...(required.length ? { required } : {}),
    additionalProperties: false,
  }
  return {
    name: options.name,
    description: options.description,
    parameters,
    output: {
      schema: options.output?.schema || { type: 'string' },
      render: options.output?.render || ((_args, value) => [{ type: 'text', text: String(value) }]),
    },
    execute: options.execute,
  }
}

// 宿主里能解析到 @deepseek-ai/dsh-tools 就用它，否则用本地等价实现
let defineTool = localDefineTool
try {
  const mod = await import('@deepseek-ai/dsh-tools')
  if (typeof mod.defineTool === 'function') defineTool = mod.defineTool
} catch {
  // 独立 CLI / 测试环境：保持本地实现
}

const asText = (v) => [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 2) }]
const output = { schema: { type: 'string' }, render: (_args, value) => asText(value) }

// ---------------- 写作指南（随包附带，无需另装 skill） ----------------

const GUIDE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'SKILL.md')

/** 找不到 SKILL.md 时的兜底，保证工具永远有内容可答 */
const FALLBACK_GUIDE = `# 简历工坊 · 要点

## 访谈
- 分三轮：定位（岗位/行业/年限/海投还是精投）→ 挖料（主导的事/规模/结果数字）→ 校验（断档/保密/硬信息）
- 每题给选项，让用户做选择题；答不上数字时给区间选项，说不清就写定性结果，不编数字

## 写作
- STAR；用「主导/搭建/重构/推动」开头，少用「负责/参与」
- 每条不超过 2 行（约 110 字），至少一个数字
- 模块 4–6 个，最近 3 年占 6 成篇幅

## 加粗
- 只加粗名词短语：技术栈、机制、关键产出、量化结果
- 不加粗整句、动词、背景描述；单条不超过 3 处，全文占比不超过 25%

## 产物
- DOCX 是母版，PDF 由它转换，二者同页数；HTML 是连续长页预览
- 超页处理顺序：收紧行距 → 删修饰 → 压旧经历 → 减模块 → 征得同意后删经历`

function readGuide() {
  try {
    return readFileSync(GUIDE_FILE, 'utf8')
  } catch {
    return FALLBACK_GUIDE
  }
}

/** 按 "## " 标题切小节，frontmatter 去掉 */
function splitSections(md) {
  const body = md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
  const out = []
  let cur = { title: '', lines: [] }
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^##\s+(.+?)\s*$/)
    if (m) {
      if (cur.lines.some((l) => l.trim())) out.push(cur)
      cur = { title: m[1], lines: [] }
    } else {
      cur.lines.push(line)
    }
  }
  if (cur.lines.some((l) => l.trim())) out.push(cur)
  return out
}

const GUIDE_ALIASES = {
  template: '第 0 步',
  templates: '第 0 步',
  interview: '第 1 步',
  rules: '第 3 步',
  writing: '第 3 步',
  bold: '第 4 步',
  render: '第 5 步',
  workflow: '第 5 步',
  output: '产物语义',
  outputs: '产物语义',
  failure: '常见失败模式',
  failures: '常见失败模式',
}

function guideText(topic) {
  const key = String(topic || 'all').trim().toLowerCase()
  if (!key || key === 'all') return readGuide()
  const needle = GUIDE_ALIASES[key] || key
  const sections = splitSections(readGuide())
  const hit = sections.find((s) => s.title.includes(needle))
  if (hit) return `## ${hit.title}\n${hit.lines.join('\n').trim()}`
  return `未找到「${topic}」。可用 topic：all / ${Object.keys(GUIDE_ALIASES).join(' / ')}\n小节：${sections
    .map((s) => s.title)
    .join(' / ')}`
}

export function apply(ctx, config = {}) {
  const register = (def) => ctx.tools.register(defineTool(def))
  const defaults = {
    outDir: config.outDir,
    template: config.template,
    maxPages: config.maxPages,
  }

  register({
    name: 'resume_render',
    description:
      '把简历 JSON 渲染成 HTML / DOCX / PDF。会自动按 maxPages 收敛行距并回报实际页数；返回每个版式的文件路径、页数与体检问题。',
    parameters: {
      dataPath: { type: 'string', required: true, description: '简历 JSON 的绝对路径' },
      outDir: { type: 'string', description: '输出目录的绝对路径；缺省用插件 config.outDir' },
      templates: { type: 'string', description: '版式 id，逗号分隔：classic,minimal,sidebar；默认取 JSON 里的 meta.template' },
      formats: { type: 'string', description: '输出格式，逗号分隔：html,docx,pdf；默认三者全出' },
      maxPages: { type: 'number', description: '目标页数上限，超出会逐步收紧行距重排' },
    },
    output,
    async execute(args) {
      const outDir = args.outDir || defaults.outDir
      if (!outDir) throw new Error('需要 outDir：要么传参，要么在插件 config 里设置 outDir')
      const data = loadData(args.dataPath)
      const result = await renderResume(data, {
        outDir,
        templates: args.templates
          ? String(args.templates).split(',').map((s) => s.trim())
          : defaults.template
            ? [defaults.template]
            : undefined,
        formats: args.formats ? String(args.formats).split(',').map((s) => s.trim()) : undefined,
        maxPages: args.maxPages ?? defaults.maxPages,
      })
      const summary = result.results.map((r) => ({
        template: r.template,
        pages: r.pages,
        lineSpacing: r.lineSpacing,
        files: r.files,
        errors: r.issues.filter((i) => i.level === 'error').length,
        warnings: r.issues.filter((i) => i.level === 'warn').length,
      }))
      return JSON.stringify({ outDir: result.outDir, maxPages: result.maxPages, results: summary }, null, 2)
    },
  })

  register({
    name: 'resume_check',
    description: '体检简历内容：数字覆盖率、加粗占比、条目长度、时间格式、模块数量、页数是否超限。',
    parameters: {
      dataPath: { type: 'string', required: true, description: '简历 JSON 的绝对路径' },
      pdfPath: { type: 'string', description: '可选：已生成 PDF 的绝对路径，用于统计页数' },
      maxPages: { type: 'number', description: '目标页数' },
    },
    output,
    async execute(args) {
      const data = loadData(args.dataPath)
      const { issues, stats } = await checkResume(data, { pdf: args.pdfPath, maxPages: args.maxPages })
      return JSON.stringify({ stats, issues }, null, 2)
    },
  })

  register({
    name: 'resume_guide',
    description:
      '返回简历写作指南（访谈流程、写作规则、加粗规则、压页与产物说明）。开始写简历前先调用它，按其中的流程推进。topic 可选，留空返回全文。',
    parameters: {
      topic: {
        type: 'string',
        description: 'all（默认）| interview | rules | bold | workflow | output | template | failure',
      },
    },
    output,
    async execute(args) {
      return guideText(args.topic)
    },
  })

  register({
    name: 'resume_templates',
    description: '列出内置版式及其适用场景。',
    parameters: {},
    output,
    async execute() {
      return JSON.stringify({ templates: listTemplates() }, null, 2)
    },
  })

  register({
    name: 'resume_init',
    description: '生成一份简历 JSON 骨架，填内容后交给 resume_render。',
    parameters: {
      outPath: { type: 'string', required: true, description: '要写入的 JSON 绝对路径（不能已存在）' },
      name: { type: 'string', description: '姓名' },
      intent: { type: 'string', description: '求职意向' },
    },
    output,
    async execute(args) {
      const { mkdirSync, writeFileSync, existsSync } = await import('node:fs')
      const { dirname } = await import('node:path')
      if (existsSync(args.outPath)) throw new Error(`已存在：${args.outPath}`)
      mkdirSync(dirname(args.outPath), { recursive: true })
      const skeleton = {
        meta: { template: 'classic', maxPages: 2 },
        basics: {
          name: args.name || '你的姓名',
          intent: args.intent || '求职意向：后端开发工程师',
          fields: [
            ['电话', '13800000000'],
            ['邮箱', 'name@example.com'],
            ['工作年限', '3 年'],
            ['学历', '本科'],
          ],
        },
        sections: [
          {
            kind: 'timeline',
            title: '工作经历',
            items: [
              {
                head: '公司名称',
                sub: '后端开发工程师',
                date: '2022.07 - 至今',
                bullets: ['主导 **订单中心** 重构，把接口 P99 从 800ms 降到 220ms，线上超时告警下降 **85%**'],
              },
            ],
          },
          { kind: 'list', title: '专业技能', bullets: ['**后端**：熟悉 Java、Spring Boot，掌握 MySQL 索引优化与 Redis 缓存设计'] },
        ],
      }
      writeFileSync(args.outPath, JSON.stringify(skeleton, null, 2), 'utf8')
      return JSON.stringify({ created: args.outPath }, null, 2)
    },
  })
}
