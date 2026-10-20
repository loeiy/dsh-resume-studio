import assert from 'node:assert/strict'
import test from 'node:test'

import { normalize, parseRich } from '../lib/model.js'
import { lint } from '../lib/lint.js'
import { renderHTML } from '../lib/render-html.js'
import { buildDocx } from '../lib/render-docx.js'
import { getTemplate } from '../lib/templates.js'

const sample = {
  meta: { template: 'classic', maxPages: 2 },
  basics: {
    name: '测试',
    intent: '求职意向：后端工程师',
    fields: [
      ['电话', '13800000000'],
      ['邮箱', 'test@example.com'],
      ['学历', '本科'],
      ['工作年限', '3 年'],
    ],
  },
  sections: [
    {
      kind: 'timeline',
      title: '工作经历',
      items: [
        {
          head: '某某公司',
          sub: '工程师',
          date: '2022.07 - 至今',
          bullets: ['主导 **订单中心** 重构，接口 P99 从 800ms 降到 220ms'],
        },
      ],
    },
    { kind: 'list', title: '专业技能', bullets: ['**后端**：熟悉 Java 与 Spring Boot'] },
  ],
}

test('parseRich splits bold spans', () => {
  assert.deepEqual(parseRich('主导 **订单中心** 重构'), [
    { text: '主导 ', bold: false },
    { text: '订单中心', bold: true },
    { text: ' 重构', bold: false },
  ])
})

test('parseRich keeps unmatched marker as plain text', () => {
  const out = parseRich('未完 **开放')
  assert.equal(out.map((r) => r.text).join(''), '未完 **开放')
})

test('normalize rejects missing name', () => {
  assert.throws(() => normalize({ sections: [] }), /basics\.name/)
})

test('normalize drops empty fields and keeps order', () => {
  const d = normalize({
    basics: { name: 'A', fields: [['电话', ''], ['邮箱', 'a@b.c']] },
    sections: [{ kind: 'list', title: '技能', bullets: ['x'] }],
  })
  assert.deepEqual(d.basics.fields, [['邮箱', 'a@b.c']])
})

test('lint flags missing contact and unnumbered bullets', () => {
  const d = normalize({
    basics: { name: 'A', fields: [['学历', '本科']] },
    sections: [{ kind: 'list', title: '技能', bullets: ['负责一些事情'] }],
  })
  const { issues } = lint(d, {})
  const rules = issues.map((i) => i.rule)
  assert.ok(rules.includes('contact'))
  assert.ok(rules.includes('numbers'))
})

test('lint reports page overflow', () => {
  const d = normalize(sample)
  const { issues } = lint(d, { pages: 4, maxPages: 2 })
  assert.ok(issues.some((i) => i.rule === 'pages' && i.level === 'error'))
})

test('renderHTML embeds data, bold and print rules', () => {
  const d = normalize(sample)
  const html = renderHTML(d, getTemplate('classic'))
  assert.match(html, /测试/)
  assert.match(html, /<strong>订单中心<\/strong>/)
  assert.match(html, /@page \{ size: A4/)
  assert.match(html, /工作经历/)
})

test('buildDocx returns a docx package buffer', async () => {
  const d = normalize(sample)
  const buf = await buildDocx(d, getTemplate('minimal'))
  assert.ok(Buffer.isBuffer(buf))
  assert.equal(buf.subarray(0, 2).toString(), 'PK')
  assert.ok(buf.length > 5000)
})

test('all templates render both formats', async () => {
  const d = normalize(sample)
  for (const id of ['classic', 'minimal', 'sidebar']) {
    const html = renderHTML(d, getTemplate(id))
    assert.match(html, /某某公司/)
    const buf = await buildDocx(d, getTemplate(id))
    assert.equal(buf.subarray(0, 2).toString(), 'PK')
  }
})
