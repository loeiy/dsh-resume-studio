import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  IMPORTABLE,
  checkCompoundFileIntegrity,
  convertToText,
  describeSource,
  normalizeImportedText,
} from '../lib/import.js'

/** 造一个头部合法、总长度可控的复合文档头 */
function fakeHeader() {
  const h = Buffer.alloc(512)
  Buffer.from('d0cf11e0a1b11ae1', 'hex').copy(h, 0)
  h.writeUInt16LE(3, 26)
  h.writeUInt16LE(0xfffe, 28)
  h.writeUInt16LE(9, 30)
  h.writeUInt16LE(6, 32)
  return h
}

test('IMPORTABLE 覆盖 Word 老格式，且不含 .pdf', () => {
  assert.deepEqual(IMPORTABLE, ['.doc', '.docx', '.odt'])
})

test('normalizeImportedText 统一换行并压缩空行', () => {
  const raw = '  简历\r\n\r\n\r\n\r\n工作经历\t\r\n项目\r\n'
  assert.equal(normalizeImportedText(raw), '简历\n\n工作经历\n项目')
})

test('normalizeImportedText 容忍空输入', () => {
  assert.equal(normalizeImportedText(null), '')
  assert.equal(normalizeImportedText('   \n\n  '), '')
})

test('按扇区对齐的复合文档不判为损坏', () => {
  assert.equal(checkCompoundFileIntegrity(fakeHeader(), 86528).ok, true)
})

test('尾部未对齐的老 .doc 判为截断，并算出缺多少', () => {
  const r = checkCompoundFileIntegrity(fakeHeader(), 86415)
  assert.equal(r.ok, false)
  assert.equal(r.sector, 512)
  assert.equal(r.missing, 113)
})

test('非复合文档（如 .docx 的 zip 头）直接放行', () => {
  const zip = Buffer.alloc(512)
  zip.write('PK\u0003\u0004', 0)
  assert.equal(checkCompoundFileIntegrity(zip, 12345).ok, true)
})

test('convertToText 对 .pdf 给出明确拒绝', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-import-'))
  const pdf = path.join(dir, 'a.pdf')
  fs.writeFileSync(pdf, '%PDF-1.4\n', 'utf8')
  await assert.rejects(() => convertToText(pdf), /只支持/)
})

test('convertToText 对不存在的文件报错', async () => {
  await assert.rejects(() => convertToText(path.join(os.tmpdir(), 'nope-missing.doc')), /文件不存在/)
})

test('convertToText 对被截断的 .doc 给出可执行建议', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-import-'))
  const doc = path.join(dir, 'broken.doc')
  fs.writeFileSync(doc, Buffer.concat([fakeHeader(), Buffer.alloc(488)]))
  await assert.rejects(() => convertToText(doc), /文件不完整[\s\S]*另存为/)
})

test('describeSource 识别已有模块并列出缺失', () => {
  const text = '示例 13800001111 a@b.com\n教育背景：某大学\n工作经历：某公司\n项目经历：某系统'
  const info = describeSource(text)
  assert.ok(info.detected.includes('工作经历'))
  assert.ok(info.detected.includes('教育背景'))
  assert.ok(info.detected.includes('项目经历'))
  assert.ok(info.detected.includes('联系方式'))
  assert.ok(info.missing.includes('专业技能'))
  assert.ok(info.chars > 0)
  assert.ok(info.lines >= 4)
})
