import { parseRich, plainText } from './model.js'

/** 我定的简历写作规则，逐条可执行。 */
export const RULES = {
  structure: '4–6 个模块；亮点前置；一页优先，超出需给出压页理由',
  star: '每条 bullet 写清 场景→动作→结果，结果必须可验证',
  numbers: '声称了变化（提升/降低/优化/缩短）就必须有数字；纯功能描述与技能清单不强制',
  verbs: '用“主导/搭建/重构/推动/落地”开头，避免“负责/参与/协助”',
  bold: '只加粗名词短语：技术栈、机制、关键产出；不整句加粗，单条不超过 3 处',
  density: '一条 bullet 不超过 2 行（≈110 字），超过就拆或删',
  tense: '在职用现在时描述职责，离职用完成时描述结果',
}

const WEAK_VERBS = ['负责', '参与', '协助', '帮助', '配合', '从事']

/** 声称了「变化」的动词：这类句子必须有数字支撑，否则结果不可验证 */
const CLAIM_VERBS = /(提升|提高|降低|下降|缩短|减少|增长|节省|加快|优化|压缩|翻倍|降到|降至)/
/** 清单式模块（技能/证书等）不该强制出现数字 */
const NON_NUMERIC_TITLES = /(技能|专长|技术栈|工具|证书|荣誉|奖项)/
const DATE_RE = /^\d{4}([.\-/]\d{1,2})?\s*[-–—~至]\s*(\d{4}([.\-/]\d{1,2})?|至今|今)$/

function eachBullet(data, fn) {
  for (const s of data.sections) {
    if (s.kind === 'list') s.bullets.forEach((b, i) => fn(b, `${s.title}[${i + 1}]`, s))
    else
      for (const it of s.items)
        it.bullets.forEach((b, i) => fn(b, `${s.title} · ${it.head}[${i + 1}]`, s))
  }
}

const CJK_RE = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef\u3000-\u303f]/

/** 估算排版宽度：全角字记 1，半角记 0.55 */
export function visualWidth(text) {
  let w = 0
  for (const ch of String(text ?? '')) w += CJK_RE.test(ch) ? 1 : 0.55
  return w
}

/** 按「一行约放多少个全角字」估算占用行数 */
export function estimateLines(text, charsPerLine = 49) {
  const per = Number(charsPerLine) > 0 ? Number(charsPerLine) : 49
  return Math.max(1, Math.ceil(visualWidth(text) / per))
}

/**
 * 给每个模块、每个条目估算占用行数，用来回答「该压哪一块」。
 * 只是按字符宽度折算的估算，不替代真实排版，但足够排出优先级。
 */
export function estimateWeights(data, charsPerLine = 49) {
  const sections = []
  for (const s of data.sections) {
    let lines = 1 // 分区标题
    let introLines = 0
    let introCount = 0
    const items = []
    if (s.kind === 'list') {
      for (const b of s.bullets) {
        const n = estimateLines(b, charsPerLine)
        lines += n
        items.push({ label: s.title, lines: n })
      }
    } else {
      for (const it of s.items) {
        let n = 1 // 条目标题行
        if (it.intro) {
          const k = estimateLines(it.intro, charsPerLine)
          n += k
          introLines += k
          introCount += 1
        }
        if (it.label) n += 1
        for (const b of it.bullets) n += estimateLines(b, charsPerLine)
        lines += n
        items.push({ label: it.head ? `${s.title} · ${it.head}` : s.title, lines: n })
      }
    }
    sections.push({ title: s.title, lines, introLines, introCount, items })
  }
  return sections
}

/**
 * 超页时给出「该压哪一块」的具体建议。
 * compression 由渲染端传入 { attempts, lineSpacing, linesPerPage, charsPerLine }；
 * 缺省时只按字符宽度估算，仍能排出优先级。
 */
export function pageHints(data, { pages = 0, maxPages = 0, compression = {} } = {}) {
  const c = compression || {}
  const charsPerLine = Number(c.charsPerLine) || 49
  const sections = estimateWeights(data, charsPerLine)
  const totalLines = sections.reduce((n, s) => n + s.lines, 0) || 1
  const over = Math.max(0, pages - maxPages)
  const hints = []

  if (c.attempts > 1 && c.lineSpacing) {
    hints.push(`行距已自动收紧到 ${c.lineSpacing}pt（试了 ${c.attempts} 轮），靠行距压不回去了，得动内容`)
  }
  if (c.linesPerPage && over) {
    hints.push(`当前行距下一页约 ${c.linesPerPage} 行；要降 ${over} 页，至少得减掉约 ${c.linesPerPage * over} 行`)
  }

  const top = [...sections].sort((a, b) => b.lines - a.lines)[0]
  if (top) {
    hints.push(
      `篇幅最大的是「${top.title}」，约 ${top.lines} 行、占 ${Math.round((top.lines / totalLines) * 100)}%，优先压它`,
    )
  }

  const blocks = sections
    .flatMap((s) => s.items)
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 3)
  if (blocks.length) {
    hints.push('最占篇幅的三块：' + blocks.map((b) => `${b.label}（约 ${b.lines} 行）`).join('、'))
  }

  const introLines = sections.reduce((n, s) => n + s.introLines, 0)
  const introCount = sections.reduce((n, s) => n + s.introCount, 0)
  if (introLines > introCount) {
    hints.push(`项目介绍合计约 ${introLines} 行，每段压到 1 行可省约 ${introLines - introCount} 行`)
  }

  hints.push('处理顺序：删形容词 → 把最旧的经历压成一行 → 合并模块 → 删经历前必须征得本人同意')
  return hints
}

export function lint(data, { pages = null, maxPages = 0, compression = null } = {}) {
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

  const allowQualitative = Boolean(data.meta?.allowQualitative)
  let totalChars = 0
  let boldChars = 0
  let bullets = 0
  let withNumber = 0
  let claims = 0
  let claimsWithNumber = 0

  eachBullet(data, (text, where, section) => {
    bullets += 1
    const plain = text.replace(/\*\*/g, '')
    totalChars += plain.length
    boldChars += parseRich(text)
      .filter((r) => r.bold)
      .reduce((n, r) => n + r.text.length, 0)

    const hasNumber = /\d/.test(plain)
    const isClaim = CLAIM_VERBS.test(plain)
    const listLike = section.kind === 'list' && NON_NUMERIC_TITLES.test(section.title)

    if (hasNumber) withNumber += 1
    if (isClaim && !listLike) {
      claims += 1
      if (hasNumber) claimsWithNumber += 1
      else if (allowQualitative)
        add('info', 'numbers', '声称了变化但没给数字；写定性描述可以接受，能补百分比或时长最优', where)
      else add('warn', 'numbers', '声称了变化但没给数字，结果无法验证', where)
    }
    // 纯功能描述与技能清单不逐条告警，避免把真问题淹掉

    const head = plain.trim().slice(0, 2)
    if (WEAK_VERBS.some((v) => plain.trim().startsWith(v)))
      add('info', 'verbs', `以“${head}”开头，可换成动作更强的动词（主导/搭建/推动）`, where)

    if (plain.length > 110) add('warn', 'density', `长 ${plain.length} 字，超过两行，建议拆分或压缩`, where)
    if (/[，、；]$/.test(plain.trim())) add('info', 'punct', '结尾多余标点', where)
  })

  if (claims >= 2 && claimsWithNumber / claims < 0.5)
    add(
      'warn',
      'numbers',
      `${claims} 条声称了变化（提升/降低/优化等），只有 ${claimsWithNumber} 条给了数字，整体结果不可验证`,
    )

  if (totalChars && boldChars / totalChars > 0.25)
    add('warn', 'bold', `加粗占比 ${((boldChars / totalChars) * 100).toFixed(0)}%，超过 25%，重点会失效`)

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
    if (pages > maxPages) {
      issues.push({
        level: 'error',
        rule: 'pages',
        message: `实际 ${pages} 页，目标 ${maxPages} 页，超出 ${pages - maxPages} 页`,
        where: '',
        hints: pageHints(data, { pages, maxPages, compression }),
      })
    } else if (pages < maxPages - 1) {
      add('info', 'pages', `只有 ${pages} 页，目标 ${maxPages} 页，可以补充内容`)
    }
  }

  const stats = {
    bullets,
    chars: totalChars,
    boldRatio: totalChars ? +(boldChars / totalChars).toFixed(3) : 0,
    numberedRatio: bullets ? +(withNumber / bullets).toFixed(2) : 0,
    claims,
    claimRatio: claims ? +(claimsWithNumber / claims).toFixed(2) : 0,
    sections: data.sections.length,
    pages,
  }
  return { issues, stats }
}

export function lintText(data) {
  return plainText(data).length
}
