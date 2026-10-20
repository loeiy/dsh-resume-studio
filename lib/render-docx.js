import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  Tab,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
  convertMillimetersToTwip,
} from 'docx'

import { parseRich } from './model.js'
import { textWidthPt } from './templates.js'

const TW = (pt) => Math.round(pt * 20)
const half = (pt) => Math.round(pt * 2)
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }

function run(text, t, { bold = false, size = t.size.body, color = t.color.text } = {}) {
  return new TextRun({
    text,
    bold,
    size: half(size),
    color,
    font: { ascii: t.font.latin, hAnsi: t.font.latin, eastAsia: t.font.body, cs: t.font.latin },
  })
}

function richRuns(text, t, opts = {}) {
  return parseRich(text).map((r) => run(r.text, t, { ...opts, bold: r.bold }))
}

function para(t, children, extra = {}) {
  return new Paragraph({
    children,
    spacing: { before: 0, after: 0, line: TW(t.line), lineRule: 'exact' },
    ...extra,
  })
}

function sectionTitle(t, text) {
  const style = t.section.style
  const border =
    style === 'bar'
      ? { left: { style: BorderStyle.SINGLE, size: t.section.ruleSize, color: t.color.accent, space: 6 } }
      : style === 'rule' || style === 'tracked'
        ? { bottom: { style: BorderStyle.SINGLE, size: t.section.ruleSize, color: t.color.rule, space: 2 } }
        : undefined

  return para(t, [run(text, t, { bold: true, size: t.size.section, color: t.color.accent })], {
    spacing: {
      before: TW(t.section.spaceBefore),
      after: TW(t.section.spaceAfter),
      line: TW(t.line),
      lineRule: 'exact',
    },
    keepNext: true,
    border,
    ...(style === 'tracked' ? { indent: { left: 0 }, characterSpacing: 24 } : {}),
    ...(style === 'bar' ? { indent: { left: 6 } } : {}),
  })
}

function bulletPara(t, text) {
  const left = TW(t.bullet.left)
  const hanging = TW(t.bullet.hanging)
  return para(
    t,
    [run('•\t', t, { bold: true, color: t.color.accent }), ...richRuns(text, t)],
    {
      indent: { left, hanging },
      tabStops: [{ type: TabStopType.LEFT, position: left }],
      widowControl: true,
    },
  )
}

function entryHead(t, item) {
  const children = [run(item.head, t, { bold: true })]
  if (item.sub) children.push(run(`${t.entry.roleGap}${item.sub}`, t))
  if (item.date) {
    children.push(new TextRun({ children: [new Tab()] }))
    children.push(run(item.date, t))
  }
  return para(t, children, {
    spacing: {
      before: TW(t.entry.spaceBefore),
      after: 0,
      line: TW(t.line),
      lineRule: 'exact',
    },
    tabStops: item.date ? [{ type: TabStopType.RIGHT, position: TW(textWidthPt(t)) }] : [],
    keepNext: true,
  })
}

function infoParagraphs(fields, t, cols) {
  const rows = []
  for (let i = 0; i < fields.length; i += cols) rows.push(fields.slice(i, i + cols))
  return rows.map((row) => {
    const children = []
    row.forEach(([k, v], idx) => {
      if (idx > 0) children.push(run('\t', t))
      children.push(run(`${k}：`, t, { color: t.color.muted }))
      children.push(run(v, t))
    })
    const colW = textWidthPt(t) / cols
    return para(t, children, {
      tabStops: Array.from({ length: cols - 1 }, (_, i) => ({
        type: TabStopType.LEFT,
        position: TW(colW * (i + 1)),
      })),
    })
  })
}

function headerBlocks(t, basics) {
  const blocks = []
  if (t.header.layout === 'band') {
    const inner = [
      para(t, [run(basics.name, t, { bold: true, size: t.size.name, color: t.color.name })], {
        spacing: { before: 0, after: 0, line: TW(t.size.name * 1.15), lineRule: 'exact' },
        characterSpacing: Math.round(t.header.nameTracking * 20),
      }),
    ]
    if (basics.intent) {
      inner.push(
        para(t, [run(basics.intent, t, { bold: true, size: t.size.intent, color: t.color.accent })], {
          spacing: { before: 45, after: 30, line: TW(t.line), lineRule: 'exact' },
        }),
      )
    }
    inner.push(...infoParagraphs(basics.fields, t, t.header.infoColumns))
    const table = new Table({
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: inner,
              width: { size: 100, type: WidthType.PERCENTAGE },
              margins: { top: 110, bottom: 110, left: 140, right: 140 },
              shading: { fill: t.color.band, type: 'clear' },
              borders: {
                top: NONE,
                bottom: NONE,
                right: NONE,
                left: { style: BorderStyle.SINGLE, size: 18, color: t.color.accent },
              },
            }),
          ],
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: {
        top: NONE,
        bottom: NONE,
        left: NONE,
        right: NONE,
        insideVertical: NONE,
        insideHorizontal: NONE,
      },
    })
    blocks.push(table)
    blocks.push(para(t, [], {}))
    return blocks
  }

  blocks.push(
    para(t, [run(basics.name, t, { bold: true, size: t.size.name, color: t.color.name })], {
      spacing: { before: 0, after: 0, line: TW(t.size.name * 1.15), lineRule: 'exact' },
      characterSpacing: Math.round(t.header.nameTracking * 20),
    }),
  )
  if (basics.intent) {
    blocks.push(
      para(t, [run(basics.intent, t, { bold: true, size: t.size.intent, color: t.color.accent })], {
        spacing: { before: 60, after: 0, line: TW(t.line), lineRule: 'exact' },
      }),
    )
  }
  blocks.push(...infoParagraphs(basics.fields, t, t.header.infoColumns))
  return blocks
}

function sectionBlocks(t, s) {
  const blocks = [sectionTitle(t, s.title)]
  if (s.kind === 'list') {
    blocks.push(...s.bullets.map((b) => bulletPara(t, b)))
    return blocks
  }
  for (const it of s.items) {
    blocks.push(entryHead(t, it))
    if (it.intro) {
      blocks.push(
        para(t, richRuns(it.intro, t), {
          spacing: { before: 30, after: 0, line: TW(t.line), lineRule: 'exact' },
        }),
      )
    }
    if (it.label) {
      blocks.push(
        para(t, [run(it.label, t, { bold: true })], {
          spacing: { before: 30, after: 0, line: TW(t.line), lineRule: 'exact' },
          keepNext: true,
        }),
      )
    }
    blocks.push(...it.bullets.map((b) => bulletPara(t, b)))
  }
  return blocks
}

export async function buildDocx(data, t) {
  const children = [...headerBlocks(t, data.basics)]
  for (const s of data.sections) children.push(...sectionBlocks(t, s))

  const footer = t.rules.pageNumbers
    ? new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ children: ['第 ', PageNumber.CURRENT, ' 页'], size: half(t.size.small), color: t.color.muted }),
            ],
          }),
        ],
      })
    : undefined

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: { ascii: t.font.latin, hAnsi: t.font.latin, eastAsia: t.font.body, cs: t.font.latin },
            size: half(t.size.body),
            color: t.color.text,
          },
          paragraph: { spacing: { line: TW(t.line), lineRule: 'exact' } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) },
            margin: {
              top: convertMillimetersToTwip(t.page.top),
              bottom: convertMillimetersToTwip(t.page.bottom),
              left: convertMillimetersToTwip(t.page.left),
              right: convertMillimetersToTwip(t.page.right),
            },
          },
        },
        footers: footer ? { default: footer } : undefined,
        children,
      },
    ],
  })

  return Packer.toBuffer(doc)
}
