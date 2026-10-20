import { parseRich, plainText } from './model.js'

/** 我定的简历写作规则，逐条可执行。 */
export const RULES = {
  structure: '4–6 个模块；亮点前置；一页优先，超出需给出压页理由',
  star: '每条 bullet 写清 场景→动作→结果，结果必须可验证',
  numbers: '每条经历至少一个数字（人数/金额/百分比/时长/次数）',
  verbs: '用“主导/搭建/重构/推动/落地”开头，避免“负责/参与/协助”',
  bold: '只加粗名词短语：技术栈、机制、关键产出；不整句加粗，单条不超过 3 处',
  density: '一条 bullet 不超过 2 行（≈110 字），超过就拆或删',
  tense: '在职用现在时描述职责，离职用完成时描述结果',
}

const WEAK_VERBS = ['负责', '参与', '协助', '帮助', '配合', '从事']
const DATE_RE = /^\d{4}([.\-/]\d{1,2})?\s*[-–—~至]\s*(\d{4}([.\-/]\d{1,2})?|至今|今)$/

function eachBullet(data, fn) {
  for (const s of data.sections) {
    if (s.kind === 'list') s.bullets.forEach((b, i) => fn(b, `${s.title}[${i + 1}]`))
    else
      for (const it of s.items)
        it.bullets.forEach((b, i) => fn(b, `${s.title} · ${it.head}[${i + 1}]`))
  }
}

export function lint(data, { pages = null, maxPages = 0 } = {}) {
  const issues = []
  const add = (level, rule, message, where = '') => issues.push({ level, rule, message, where })

  if (!data.basics.intent) add('warn', 'intent', '缺少求职意向，HR 无法一眼判断匹配度')
  if (data.basics.fields.length < 4) add('warn', 'contact', '联系方式字段少于 4 个（建议：电话/邮箱/年限/学历）')
  const hasPhone = data.basics.fields.some(([k]) => /电话|手机/.test(k))
  const hasMail = data.basics.fields.some(([k]) => /邮箱|邮件/.test(k))
  if (!hasPhone) add('error', 'contact', '缺少电话')
  if (!hasMail) add('error', 'contact', '缺少邮箱')

  if (data.sections.length < 3) add('warn', 'structure', `只有 ${data.sections.length} 个模块，建议 4–6 个`)
  if (data.sections.length > 6) add('warn', 'structure', `有 ${data.sections.length} 个模块，超过 6 个会稀释重点`)

  let totalChars = 0
  let boldChars = 0
  let bullets = 0
  let withNumber = 0

  eachBullet(data, (text, where) => {
    bullets += 1
    const plain = text.replace(/\*\*/g, '')
    totalChars += plain.length
    boldChars += parseRich(text)
      .filter((r) => r.bold)
      .reduce((n, r) => n + r.text.length, 0)

    if (/\d/.test(plain)) withNumber += 1
    else add('warn', 'numbers', '没有任何数字，含金量不可验证', where)

    const head = plain.trim().slice(0, 2)
    if (WEAK_VERBS.some((v) => plain.trim().startsWith(v)))
      add('info', 'verbs', `以“${head}”开头，可换成动作更强的动词（主导/搭建/推动）`, where)

    if (plain.length > 110) add('warn', 'density', `长 ${plain.length} 字，超过两行，建议拆分或压缩`, where)
    if (/[，、；]$/.test(plain.trim())) add('info', 'punct', '结尾多余标点', where)
  })

  if (bullets && withNumber / bullets < 0.6)
    add('warn', 'numbers', `仅 ${Math.round((withNumber / bullets) * 100)}% 的条目含数字，建议补到 80% 以上`)

  if (totalChars && boldChars / totalChars > 0.3)
    add('warn', 'bold', `加粗占比 ${((boldChars / totalChars) * 100).toFixed(0)}%，超过 30%，重点会失效`)

  for (const s of data.sections) {
    if (s.kind !== 'list') {
      for (const it of s.items) {
        if (it.date && !DATE_RE.test(it.date.trim()))
          add('info', 'date', `时间格式不统一：「${it.date}」，建议 2023.05 - 2025.05 或 2023 - 2025`, s.title)
        if (!it.bullets.length && !/教育/.test(s.title)) add('warn', 'empty', `「${it.head}」没有写内容`, s.title)
      }
    }
  }

  if (pages != null && maxPages) {
    if (pages > maxPages) add('error', 'pages', `实际 ${pages} 页，超过目标 ${maxPages} 页`)
    else if (pages < maxPages - 1) add('info', 'pages', `只有 ${pages} 页，目标 ${maxPages} 页，可以补充内容`)
  }

  const stats = {
    bullets,
    chars: totalChars,
    boldRatio: totalChars ? +(boldChars / totalChars).toFixed(3) : 0,
    numberedRatio: bullets ? +(withNumber / bullets).toFixed(2) : 0,
    sections: data.sections.length,
    pages,
  }
  return { issues, stats }
}

export function lintText(data) {
  return plainText(data).length
}
