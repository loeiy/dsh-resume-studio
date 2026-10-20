import { spawn } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * DOCX → PDF：走 DSH 自带的 LibreOffice Kit（与 office-export-pdf 技能同一个引擎）。
 *
 * 查找顺序：
 *   1. 环境变量 DSH_LO_CLI / DSH_LO_NODE
 *   2. 运行中 DSH 的 resources/app.asar.unpacked（Electron resourcesPath）
 *   3. 从 process.execPath 推导安装目录
 *   4. 各平台常见安装路径
 * 全部失败时抛出可读错误，调用方可只出 HTML + DOCX。
 */

let cached = null

function unique(list) {
  return [...new Set(list.filter(Boolean))]
}

function cliCandidates() {
  const rel = path.join('app.asar.unpacked', 'dsh', 'node_modules', '@deepseek-ai', 'libreoffice-kit', 'lib', 'cli.js')
  const home = os.homedir()
  const list = [process.env.DSH_LO_CLI]

  if (process.resourcesPath) list.push(path.join(process.resourcesPath, rel))

  const exeDir = path.dirname(process.execPath || '')
  list.push(path.join(exeDir, 'resources', rel))
  list.push(path.join(exeDir, '..', 'resources', rel))

  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
    list.push(path.join(local, 'Programs', 'DeepSeek Harness', 'resources', rel))
    list.push(path.join('C:', 'Program Files', 'DeepSeek Harness', 'resources', rel))
  } else if (process.platform === 'darwin') {
    list.push(path.join('/Applications', 'DeepSeek Harness.app', 'Contents', 'Resources', rel))
    list.push(path.join(home, 'Applications', 'DeepSeek Harness.app', 'Contents', 'Resources', rel))
  } else {
    list.push(path.join('/opt', 'DeepSeek Harness', 'resources', rel))
    list.push(path.join(home, '.local', 'share', 'deepseek-harness', 'resources', rel))
  }
  return unique(list)
}

function nodeCandidates() {
  const list = [process.env.DSH_LO_NODE]
  const exe = process.execPath || ''
  if (/node(\.exe)?$/i.test(path.basename(exe))) list.push(exe)

  if (process.resourcesPath) {
    const base = path.join(process.resourcesPath, 'runtime', 'primary-runtime', 'dependencies', 'node', 'bin')
    list.push(path.join(base, process.platform === 'win32' ? 'node.exe' : 'node'))
  }
  list.push('node')
  return unique(list)
}

export function resolveConverter() {
  if (cached !== null) return cached
  const cli = cliCandidates().find((p) => p && existsSync(p))
  if (!cli) {
    cached = null
    return null
  }
  const node = nodeCandidates().find((p) => p === 'node' || existsSync(p)) || 'node'
  cached = { node, cli }
  return cached
}

export function convertToPdf(docxPath, pdfPath) {
  const conv = resolveConverter()
  if (!conv) {
    return Promise.reject(
      new Error(
        '找不到 LibreOffice Kit，无法生成 PDF。可设置 DSH_LO_CLI / DSH_LO_NODE 指向 cli.js 与 node，' +
          '或改用 formats="html,docx" 只出 Word 与 HTML。',
      ),
    )
  }
  if (existsSync(pdfPath)) rmSync(pdfPath, { force: true })

  return new Promise((resolve, reject) => {
    const child = spawn(conv.node, [conv.cli, 'convert', '--input', docxPath, '--output', pdfPath], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d.toString()))
    child.stderr.on('data', (d) => (err += d.toString()))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0 || !existsSync(pdfPath)) {
        reject(new Error(`PDF 转换失败（exit ${code}）：${(err || out).trim().slice(0, 500)}`))
        return
      }
      let meta = {}
      try {
        meta = JSON.parse(out.trim().split('\n').filter(Boolean).pop() || '{}')
      } catch {
        meta = {}
      }
      resolve({ pdfPath: path.resolve(pdfPath), missingFonts: meta.missingFonts || [] })
    })
  })
}

export function converterInfo() {
  const conv = resolveConverter()
  return conv ? { ...conv, available: true } : { available: false }
}
