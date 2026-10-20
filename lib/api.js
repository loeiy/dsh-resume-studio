import fs from 'node:fs'
import path from 'node:path'

import { PDFDocument } from 'pdf-lib'

import { normalize } from './model.js'
import { getTemplate, PT_PER_MM, TEMPLATE_IDS, textWidthPt } from './templates.js'
import { renderHTML } from './render-html.js'
import { buildDocx } from './render-docx.js'
import { convertToPdf } from './pdf.js'
import { lint } from './lint.js'

export function loadData(input) {
  const raw = typeof input === 'string' ? JSON.parse(fs.readFileSync(input, 'utf8')) : input
  return normalize(raw)
}

export async function pageCount(pdfPath) {
  const doc = await PDFDocument.load(fs.readFileSync(pdfPath))
  return doc.getPageCount()
}

const safe = (s) => String(s).replace(/[\\/:*?"<>|]/g, '_')

/**
 * 把版式参数折成「一页大概多少行 / 一行大概多少字」，
 * 供 lint 在超页时估算「该压哪一块、要减多少行」。
 */
function compressionOf(t, line) {
  const usableHeightPt = (297 - t.page.top - t.page.bottom) * PT_PER_MM
  const headerAllowance = t.header.layout === 'band' ? 100 : 88
  return {
    lineSpacing: line,
    linesPerPage: Math.max(1, Math.floor((usableHeightPt - headerAllowance) / line)),
    charsPerLine: Math.max(24, Math.floor(textWidthPt(t) / t.size.body)),
  }
}

async function renderOne(data, t, formats, outDir, base, maxPages) {
  fs.mkdirSync(outDir, { recursive: true })
  const files = {}
  let pages = null
  let used = t
  let attempts = 0

  for (let attempt = 0; attempt < 7; attempt++) {
    attempts = attempt + 1
    const line = +(t.line * (1 - 0.015 * attempt)).toFixed(2)
    used = { ...t, line }

    if (formats.includes('html')) {
      const f = path.join(outDir, `${base}.html`)
      fs.writeFileSync(f, renderHTML(data, used), 'utf8')
      files.html = f
    }
    if (formats.includes('docx') || formats.includes('pdf')) {
      const f = path.join(outDir, `${base}.docx`)
      fs.writeFileSync(f, await buildDocx(data, used))
      files.docx = f
    }
    if (formats.includes('pdf')) {
      const f = path.join(outDir, `${base}.pdf`)
      const { missingFonts } = await convertToPdf(files.docx, f)
      files.pdf = f
      pages = await pageCount(f)
      if (missingFonts.length) files.missingFonts = missingFonts
      if (!maxPages || pages <= maxPages) break
    } else break
  }

  const compression = { attempts, ...compressionOf(used, used.line) }
  const { issues, stats } = lint(data, { pages, maxPages, compression })
  return { template: t.id, files, pages, lineSpacing: used.line, attempts, stats, issues }
}

/**
 * @param {object} data 已归一化或原始 JSON
 * @param {object} opts { outDir, templates?: string[], formats?: string[], maxPages?: number, baseName?: string }
 */
export async function renderResume(data, opts = {}) {
  const d = data && data.basics ? validateShape(data) : loadData(data)
  const outDir = path.resolve(opts.outDir || 'out')
  const ids = opts.templates?.length ? opts.templates : [d.meta.template || 'classic']
  for (const id of ids) getTemplate(id)
  const formats = opts.formats?.length ? opts.formats : ['html', 'docx', 'pdf']
  const maxPages = Number(opts.maxPages || d.meta.maxPages || 0)
  const baseName = safe(opts.baseName || `${d.basics.name}-简历`)

  const results = []
  for (const id of ids) {
    const t = getTemplate(id)
    const base = ids.length > 1 ? `${baseName}-${id}` : baseName
    results.push(await renderOne(d, t, formats, outDir, base, maxPages))
  }
  return {
    outDir,
    maxPages,
    templateIds: TEMPLATE_IDS,
    results,
  }
}

function validateShape(data) {
  // 已归一化/未归一化都交给 normalize 统一处理
  return normalize(data)
}

export async function checkResume(data, opts = {}) {
  const d = loadData(data)
  const pages = opts.pdf ? await pageCount(path.resolve(opts.pdf)) : null
  const maxPages = Number(opts.maxPages || d.meta.maxPages || 0)
  const template = getTemplate(d.meta.template || 'classic')
  const compression = { attempts: 1, ...compressionOf(template, template.line) }
  return lint(d, { pages, maxPages, compression })
}

export function listTemplates() {
  return TEMPLATE_IDS.map((id) => {
    const t = getTemplate(id)
    return { id, name: t.name, desc: t.desc, header: t.header.layout, margins: t.page }
  })
}
