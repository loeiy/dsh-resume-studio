import { parseRich } from './model.js'
import { PT_PER_MM, textWidthPt } from './templates.js'

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function rich(text, cls = '') {
  const inner = parseRich(text)
    .map((r) => (r.bold ? `<strong>${esc(r.text)}</strong>` : esc(r.text)))
    .join('')
  return `<span class="${cls}">${inner}</span>`
}

function cssVars(t) {
  const pt = (v) => `${v}pt`
  return `
  --body: ${pt(t.size.body)};
  --name: ${pt(t.size.name)};
  --intent: ${pt(t.size.intent)};
  --section: ${pt(t.size.section)};
  --small: ${pt(t.size.small)};
  --line: ${pt(t.line)};
  --text: #${t.color.text};
  --muted: #${t.color.muted};
  --accent: #${t.color.accent};
  --rule: #${t.color.rule};
  --name-color: #${t.color.name};
  --band: #${t.color.band};
  --pad-t: ${t.page.top}mm; --pad-b: ${t.page.bottom}mm;
  --pad-l: ${t.page.left}mm; --pad-r: ${t.page.right}mm;
  --font: "${t.font.body}", "${t.font.latin}", -apple-system, "Segoe UI", sans-serif;`
}

function header(t, basics) {
  const infoCols = t.header.infoColumns
  const cols = Math.max(1, infoCols)
  const rows = []
  for (let i = 0; i < basics.fields.length; i += cols) rows.push(basics.fields.slice(i, i + cols))
  const info = `<div class="info" style="grid-template-columns:repeat(${cols}, minmax(0,1fr))">
    ${rows.flat().map(([k, v]) => `<div class="field"><span class="k">${esc(k)}：</span>${esc(v)}</div>`).join('')}
  </div>`

  if (t.header.layout === 'band') {
    return `<header class="band">
      <div class="name">${esc(basics.name)}</div>
      ${basics.intent ? `<div class="intent">${esc(basics.intent)}</div>` : ''}
      ${info}
    </header>`
  }

  return `<header class="stack">
    <div class="name">${esc(basics.name)}</div>
    ${basics.intent ? `<div class="intent">${esc(basics.intent)}</div>` : ''}
    ${info}
  </header>`
}

function section(t, s) {
  const title = `<div class="sec-title ${t.section.style}"><span>${esc(s.title)}</span></div>`
  if (s.kind === 'list') {
    return `${title}<ul class="list">${s.bullets.map((b) => `<li>${rich(b)}</li>`).join('')}</ul>`
  }
  const items = s.items
    .map((it) => {
      const head = `<div class="entry-head">
        <div class="entry-left"><span class="org">${esc(it.head)}</span>${
          it.sub ? `<span class="role">${t.entry.roleGap === ' · ' ? ' · ' : '　'}${esc(it.sub)}</span>` : ''
        }</div>
        ${it.date ? `<div class="date">${esc(it.date)}</div>` : ''}
      </div>`
      const intro = it.intro ? `<div class="intro">${rich(it.intro)}</div>` : ''
      const label = it.label ? `<div class="label">${esc(it.label)}</div>` : ''
      const bullets = it.bullets.length
        ? `<ul class="list">${it.bullets.map((b) => `<li>${rich(b)}</li>`).join('')}</ul>`
        : ''
      return `<div class="item">${head}${intro}${label}${bullets}</div>`
    })
    .join('')
  return `${title}${items}`
}

export function renderHTML(data, t) {
  const pageW = 210
  const body = data.sections.map((s) => section(t, s)).join('\n')

  return `<!DOCTYPE html>
<html lang="${esc(data.meta.lang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(data.basics.name)} - 简历</title>
<style>
  :root {${cssVars(t)}
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { background: #e9ebee; }
  body { font-family: var(--font); color: var(--text); font-size: var(--body); line-height: calc(var(--line) / var(--body)); }
  .sheet {
    width: ${pageW}mm; min-height: 297mm; margin: 24px auto; background: #fff;
    padding: var(--pad-t) var(--pad-r) var(--pad-b) var(--pad-l);
    box-shadow: 0 2px 18px rgba(0,0,0,.12);
  }
  strong { font-weight: 700; }

  .name { font-size: var(--name); font-weight: 700; color: var(--name-color); letter-spacing: ${t.header.nameTracking}pt; line-height: 1.2; }
  .intent { font-size: var(--intent); font-weight: 700; color: var(--accent); margin-top: 2.5pt; }
  .info { display: grid; column-gap: ${t.header.gap}pt; row-gap: 1.5pt; margin-top: 5pt; }
  .field { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .field .k { color: var(--muted); }

  header.band {
    background: var(--band); padding: 9pt 11pt; margin: 0 0 4pt;
    border-left: 3pt solid var(--accent);
  }
  header.band .info { margin-top: 4pt; }

  .sec-title { font-size: var(--section); font-weight: 700; color: var(--accent); margin: ${t.section.spaceBefore}pt 0 ${t.section.spaceAfter}pt; page-break-after: avoid; }
  .sec-title.rule { border-bottom: ${(t.section.ruleSize / 8).toFixed(2)}pt solid var(--rule); padding-bottom: 2pt; }
  .sec-title.tracked { letter-spacing: 1.2pt; border-bottom: ${(t.section.ruleSize / 8).toFixed(2)}pt solid var(--rule); padding-bottom: 2.5pt; }
  .sec-title.bar { border-left: 3pt solid var(--accent); padding-left: 6pt; }

  .item { page-break-inside: auto; }
  .entry-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8pt; margin-top: ${t.entry.spaceBefore}pt; page-break-after: avoid; }
  .entry-left { min-width: 0; }
  .org { font-weight: 700; }
  .role { font-weight: 400; margin-left: ${t.entry.roleGap === ' · ' ? 2 : 6}pt; color: var(--text); }
  .date { white-space: nowrap; color: var(--text); }
  .intro { margin-top: 1.5pt; }
  .label { font-weight: 700; margin-top: 2.5pt; }

  ul.list { list-style: none; margin-top: 1pt; }
  ul.list li { position: relative; padding-left: ${t.bullet.left}pt; margin-bottom: ${t.bullet.spaceBefore}pt; }
  ul.list li::before { content: "•"; position: absolute; left: ${t.bullet.left - t.bullet.hanging}pt; font-weight: 700; color: var(--accent); }

  @media print {
    html, body { background: #fff; }
    .sheet { width: auto; min-height: 0; margin: 0; box-shadow: none; padding: 0; }
    @page { size: A4; margin: ${t.page.top}mm ${t.page.right}mm ${t.page.bottom}mm ${t.page.left}mm; }
  }
  @media (max-width: ${pageW + 40}mm) {
    .sheet { width: auto; margin: 0; box-shadow: none; min-height: 0; }
  }
</style>
</head>
<body>
<div class="sheet">
${header(t, data.basics)}
${body}
</div>
</body>
</html>`
}

export function htmlInfo(t) {
  return { textWidthPt: textWidthPt(t), ptPerMm: PT_PER_MM }
}
