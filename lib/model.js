/**
 * 简历数据模型：归一化、校验、富文本解析。
 *
 * 数据结构：
 * {
 *   "meta":    { "template": "classic", "maxPages": 3 },
 *   "basics":  { "name", "intent", "fields": [[label, value], ...] },
 *   "sections":[ {kind:"timeline"|"list"|"project", title, items|bullets} ]
 * }
 *
 * 正文用 **双星号** 标记加粗；HTML 与 DOCX 都解析同一套标记。
 */

export const SECTION_KINDS = ['timeline', 'list', 'project']

export function parseRich(text) {
  const out = []
  const src = String(text ?? '')
  let i = 0
  while (i < src.length) {
    const open = src.indexOf('**', i)
    if (open === -1) {
      if (i < src.length) out.push({ text: src.slice(i), bold: false })
      break
    }
    if (open > i) out.push({ text: src.slice(i, open), bold: false })
    const close = src.indexOf('**', open + 2)
    if (close === -1) {
      out.push({ text: src.slice(open), bold: false })
      break
    }
    out.push({ text: src.slice(open + 2, close), bold: true })
    i = close + 2
  }
  return out.filter((r) => r.text.length > 0)
}

export function normalize(data) {
  if (!data || typeof data !== 'object') throw new Error('简历数据必须是一个 JSON 对象')
  const basics = data.basics || {}
  if (!basics.name) throw new Error('缺少 basics.name（姓名）')

  const fields = Array.isArray(basics.fields)
    ? basics.fields
        .filter((f) => Array.isArray(f) && f.length >= 2 && f[0] && f[1] != null && String(f[1]).trim())
        .map((f) => [String(f[0]), String(f[1])])
    : []

  const sections = (data.sections || []).map((s, idx) => {
    const kind = s.kind || 'list'
    if (!SECTION_KINDS.includes(kind)) throw new Error(`sections[${idx}].kind 不支持：${kind}`)
    if (!s.title) throw new Error(`sections[${idx}] 缺少 title`)
    const sec = { kind, title: String(s.title) }
    if (kind === 'list') {
      sec.bullets = (s.bullets || []).map(String)
    } else {
      sec.items = (s.items || []).map((it) => ({
        head: String(it.head || ''),
        sub: it.sub ? String(it.sub) : '',
        date: it.date ? String(it.date) : '',
        intro: it.intro ? String(it.intro) : '',
        label: it.label ? String(it.label) : '',
        bullets: (it.bullets || []).map(String),
      }))
    }
    return sec
  })

  if (!sections.length) throw new Error('sections 不能为空')

  return {
    meta: {
      template: data.meta?.template || 'classic',
      maxPages: Number(data.meta?.maxPages) || 0,
      lang: data.meta?.lang || 'zh',
    },
    basics: {
      name: String(basics.name),
      intent: basics.intent ? String(basics.intent) : '',
      fields,
    },
    sections,
  }
}

/** 统计用：所有可见文字 */
export function plainText(data) {
  const parts = [data.basics.name, data.basics.intent, ...data.basics.fields.flat()]
  for (const s of data.sections) {
    parts.push(s.title)
    if (s.kind === 'list') parts.push(...s.bullets)
    else for (const it of s.items) parts.push(it.head, it.sub, it.date, it.intro, it.label, ...it.bullets)
  }
  return parts.filter(Boolean).join('\n')
}
