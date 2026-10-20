/**
 * 输入侧：把已有的 .doc / .docx / .odt 简历转成纯文本，交给访谈流程做结构化。
 *
 * 复用 pdf.js 的 resolveConverter()：DSH 自带的 LibreOffice Kit 支持
 * doc/docx/odt → txt，不需要 Word COM，也不用手写 OLE2 解析器。
 */
import { spawn } from 'node:child_process'
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, readSync, rmSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { resolveConverter } from './pdf.js'

export const IMPORTABLE = ['.doc', '.docx', '.odt']

const CFB_SIG = Buffer.from('d0cf11e0a1b11ae1', 'hex')

export function converterAvailable() {
  return resolveConverter() !== null
}

/**
 * 老版 Office（.doc/.xls/.ppt）是复合文档（CFB），文件长度必须按扇区对齐。
 * 尾部不对齐说明文件被截断——严格解析器会直接拒绝，宽松解析器却可能"读出"一半内容。
 * 提前判出来，才能给出「重新另存为」这种能落地的建议。
 */
export function checkCompoundFileIntegrity(header, size) {
  const total = Number(size) || 0
  if (total < 512 || !header || header.length < 34) return { ok: true }
  if (!header.subarray(0, 8).equals(CFB_SIG)) return { ok: true }
  const shift = header.readUInt16LE(30)
  if (shift < 7 || shift > 12) return { ok: true }
  const sector = 1 << shift
  const slack = (total - 512) % sector
  if (slack === 0) return { ok: true }
  return { ok: false, sector, slack, missing: sector - slack }
}

function readHeader(file, bytes = 512) {
  const buf = Buffer.alloc(bytes)
  const fd = openSync(file, 'r')
  try {
    readSync(fd, buf, 0, bytes, 0)
  } finally {
    closeSync(fd)
  }
  return buf
}

/** 把 Kit 输出的 txt 规整成便于人读的段落 */
export function normalizeImportedText(raw) {
  return String(raw ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function runConvert(conv, src, txtPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(conv.node, [conv.cli, 'convert', '--input', src, '--output', txtPath], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d.toString()))
    child.stderr.on('data', (d) => (err += d.toString()))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0 || !existsSync(txtPath)) {
        reject(new Error(`转换失败（exit ${code}）：${(err || out).trim().slice(0, 500)}`))
        return
      }
      resolve()
    })
  })
}

export async function convertToText(inputPath) {
  const src = path.resolve(String(inputPath))
  if (!existsSync(src)) throw new Error(`文件不存在：${src}`)
  const ext = path.extname(src).toLowerCase()
  if (!IMPORTABLE.includes(ext)) {
    throw new Error(`只支持 ${IMPORTABLE.join(' / ')}；.pdf 请先另存为 Word，或在原软件里导出 txt`)
  }

  const integrity = checkCompoundFileIntegrity(readHeader(src), statSync(src).size)
  if (!integrity.ok) {
    throw new Error(
      `文件不完整：这是老版 Office 的复合文档，长度必须按 ${integrity.sector} 字节扇区对齐，` +
        `当前尾部少了约 ${integrity.missing} 字节（文件被截断或没传完整）。` +
        '请在 Word/WPS 里打开原文件、「另存为」新的 .docx 再导入。',
    )
  }

  const conv = resolveConverter()
  if (!conv) {
    throw new Error('找不到 LibreOffice Kit，无法转换老格式。可设置 DSH_LO_CLI / DSH_LO_NODE 指向 cli.js 与 node')
  }
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'dsh-resume-import-'))
  const txtPath = path.join(tmpDir, `${path.parse(src).name}.txt`)
  try {
    await runConvert(conv, src, txtPath)
    return normalizeImportedText(readFileSync(txtPath, 'utf8'))
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

/** 粗判原文里已经有哪些简历模块，给出下一步提示 */
export function describeSource(text) {
  const t = String(text ?? '')
  const probe = [
    ['工作经历', /工作经[历验]|任职经历|履历/],
    ['项目经历', /项目经[历验]|项目描述|主要项目/],
    ['教育背景', /教育|学历|毕业院校|院校/],
    ['专业技能', /技能|专长|技术栈/],
    ['联系方式', /\b1[3-9]\d{9}\b|@[\w.-]+\.\w+/],
  ]
  const detected = probe.filter(([, re]) => re.test(t)).map(([k]) => k)
  return {
    chars: t.replace(/\s/g, '').length,
    lines: t.split('\n').filter((l) => l.trim()).length,
    detected,
    missing: probe.map(([k]) => k).filter((k) => !detected.includes(k)),
  }
}
