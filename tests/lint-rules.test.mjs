import assert from 'node:assert/strict'
import test from 'node:test'

import { normalize } from '../lib/model.js'
import { lint } from '../lib/lint.js'

const base = (sections, meta = {}) =>
  normalize({
    meta: { template: 'classic', maxPages: 2, ...meta },
    basics: {
      name: '规则测试',
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

const numbersIssues = (d) => lint(d).issues.filter((i) => i.rule === 'numbers')

const company = (bullets) => [
  {
    kind: 'timeline',
    title: '工作经历',
    items: [{ head: '某公司', sub: '后端', date: '2021.03 - 至今', bullets }],
  },
]

test('技能清单没有数字不产生告警', () => {
  const d = base([
    { kind: 'list', title: '专业技能', bullets: ['熟练使用 **Spring Boot** 与 MyBatis', '了解 **Redis** 缓存设计'] },
  ])
  assert.deepEqual(numbersIssues(d), [])
})

test('声称了变化却没数字，产生一条 warn', () => {
  const d = base(company(['主导 **订单中心** 重构，接口性能显著优化']))
  const hits = numbersIssues(d)
  assert.equal(hits.length, 1)
  assert.equal(hits[0].level, 'warn')
  assert.match(hits[0].message, /无法验证/)
})

test('声称了变化且有数字，不告警', () => {
  const d = base(company(['主导 **订单中心** 重构，接口 P99 降低 40%']))
  assert.deepEqual(numbersIssues(d), [])
})

test('纯功能描述没有数字不逐条告警', () => {
  const d = base(company(['完成库表结构设计与 SQL 编写，配合完成代码评审']))
  assert.deepEqual(numbersIssues(d), [])
})

test('多条目声称变化且普遍没数字，产生汇总告警', () => {
  const d = base(
    company(['优化了 **对账** 流程', '重构了 **导出** 模块，减少人工操作', '修复若干缺陷']),
  )
  const hits = numbersIssues(d)
  assert.equal(hits.length, 3)
  assert.ok(hits.some((i) => i.where === ''))
})

test('allowQualitative 把数字告警降级为 info', () => {
  const d = base(company(['优化 **查询逻辑**，响应速度提升明显']), { allowQualitative: true })
  const hits = numbersIssues(d)
  assert.equal(hits.length, 1)
  assert.equal(hits[0].level, 'info')
})

test('加粗占比 27% 会触发（旧阈值 30% 不会）', () => {
  const d = base([{ kind: 'list', title: '专业技能', bullets: ['**ABC**DEFGHIJK'] }])
  const hits = lint(d).issues.filter((i) => i.rule === 'bold')
  assert.equal(hits.length, 1)
  assert.match(hits[0].message, /25%/)
})

test('加粗占比 20% 不触发', () => {
  const d = base([{ kind: 'list', title: '专业技能', bullets: ['**AB**CDEFGHIJ'] }])
  assert.deepEqual(
    lint(d).issues.filter((i) => i.rule === 'bold'),
    [],
  )
})

test('stats 暴露 claimRatio', () => {
  const d = base(company(['优化了 **对账** 流程', '主导 **导出** 模块，耗时降低 40%']))
  const { stats } = lint(d)
  assert.equal(stats.claims, 2)
  assert.equal(stats.claimRatio, 0.5)
})
