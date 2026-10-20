import assert from 'node:assert/strict'
import test from 'node:test'

import { normalize } from '../lib/model.js'
import { estimateLines, estimateWeights, lint, pageHints, visualWidth } from '../lib/lint.js'

const data = (sections) =>
  normalize({
    meta: { template: 'sidebar', maxPages: 1 },
    basics: {
      name: '压页测试',
      intent: '求职意向：后端工程师',
      fields: [
        ['电话', '13800000000'],
        ['邮箱', 'a@b.com'],
        ['学历', '本科'],
        ['工作年限', '5 年'],
      ],
    },
    sections,
  })

const big = () =>
  data([
    { kind: 'list', title: '专业技能', bullets: ['熟悉 Java 与 Spring Boot'] },
    {
      kind: 'project',
      title: '项目经历',
      items: [
        {
          head: '很大的项目',
          sub: '后端',
          date: '2022.05 - 2025.01',
          intro: '项目介绍：' + '这是一个很长的项目介绍'.repeat(6),
          label: '工作内容：',
          bullets: [
            '模块开发：' + '负责核心模块的编码与自测'.repeat(3),
            '性能优化：' + '治理慢查询并优化接口'.repeat(3),
          ],
        },
        {
          head: '小项目',
          sub: '后端',
          date: '2021.01 - 2022.01',
          intro: '项目介绍：一句话。',
          label: '工作内容：',
          bullets: ['修了几个 bug'],
        },
      ],
    },
    {
      kind: 'timeline',
      title: '教育背景',
      items: [{ head: '某大学', sub: '计算机 · 本科', date: '2011.09 - 2015.06' }],
    },
  ])

test('visualWidth：全角记 1，半角记 0.55', () => {
  assert.equal(visualWidth('中文'), 2)
  assert.ok(Math.abs(visualWidth('ab') - 1.1) < 1e-9)
  assert.equal(visualWidth(''), 0)
})

test('estimateLines：短句与空值都至少算 1 行', () => {
  assert.equal(estimateLines('短文'), 1)
  assert.equal(estimateLines(''), 1)
  assert.equal(estimateLines(null), 1)
  assert.ok(estimateLines('很长的句子'.repeat(40), 49) > 1)
})

test('estimateWeights 给出模块与条目的估算行数', () => {
  const w = estimateWeights(big(), 49)
  const proj = w.find((x) => x.title === '项目经历')
  assert.ok(proj.lines > 5)
  assert.equal(proj.items.length, 2)
  assert.ok(proj.items[0].lines > proj.items[1].lines, '大项目应比小项目重')
  assert.ok(proj.introLines > 0)
  assert.equal(proj.introCount, 2)
})

test('超页建议包含行距、缺口行数、最大模块、最重三块与处理顺序', () => {
  const hints = pageHints(big(), {
    pages: 3,
    maxPages: 1,
    compression: { attempts: 4, lineSpacing: 14.6, linesPerPage: 48, charsPerLine: 49 },
  })
  const all = hints.join('\n')
  assert.ok(hints.length >= 4)
  assert.match(all, /行距已自动收紧到 14\.6pt/)
  assert.match(all, /至少得减掉约 96 行/)
  assert.match(all, /篇幅最大的是「项目经历」/)
  assert.match(all, /最占篇幅的三块/)
  assert.match(all, /征得本人同意/)
})

test('没有 compression 时不编造行距与行数信息', () => {
  const hints = pageHints(big(), { pages: 3, maxPages: 1 })
  assert.equal(hints.some((h) => h.includes('行距')), false)
  assert.ok(hints.length >= 3)
})

test('lint 超页时 issues 带 hints，未超页不带', () => {
  const d = big()
  const over = lint(d, { pages: 3, maxPages: 1 }).issues.find((i) => i.rule === 'pages')
  assert.equal(over.level, 'error')
  assert.ok(Array.isArray(over.hints) && over.hints.length > 0)

  const fine = lint(d, { pages: 2, maxPages: 2 }).issues.filter((i) => i.rule === 'pages')
  assert.equal(fine.length, 0)
})
