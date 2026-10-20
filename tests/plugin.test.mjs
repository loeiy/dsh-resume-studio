import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import * as plugin from '../lib/plugin.js'

const sample = {
  meta: { template: 'classic', maxPages: 2 },
  basics: {
    name: '插件测试',
    intent: '求职意向：平台工程师',
    fields: [
      ['电话', '13800000000'],
      ['邮箱', 'plugin@example.com'],
      ['学历', '本科'],
      ['工作年限', '5 年'],
    ],
  },
  sections: [
    {
      kind: 'timeline',
      title: '工作经历',
      items: [
        {
          head: '某某公司',
          sub: '平台工程师',
          date: '2021.03 - 至今',
          bullets: ['主导 **发布平台** 建设，发布耗时从 40 分钟降到 8 分钟'],
        },
      ],
    },
  ],
}

async function loadTools(config = {}) {
  const tools = []
  const ctx = { tools: { register: (t) => tools.push(t) } }
  await plugin.apply(ctx, config)
  return tools
}

test('plugin registers five tools', async () => {
  assert.equal(plugin.name, 'dsh-resume')
  const tools = await loadTools()
  assert.deepEqual(
    tools.map((t) => t.name),
    ['resume_render', 'resume_check', 'resume_guide', 'resume_templates', 'resume_init'],
  )
  const render = tools[0]
  assert.equal(render.parameters.type, 'object')
  assert.ok(render.parameters.properties.dataPath)
  assert.deepEqual(render.parameters.required, ['dataPath'])
  assert.equal(typeof render.output.render, 'function')
  assert.deepEqual(render.output.schema, { type: 'string' })
})

test('resume_guide serves the guide and can filter one section', async () => {
  const tools = await loadTools()
  const guide = tools.find((t) => t.name === 'resume_guide')

  const all = await guide.execute({})
  assert.match(all, /访谈/)
  assert.match(all, /加粗/)

  const bold = await guide.execute({ topic: 'bold' })
  assert.match(bold, /加粗/)
  assert.ok(bold.length < all.length, '按 topic 过滤后应更短')

  const unknown = await guide.execute({ topic: '不存在的主题' })
  assert.match(unknown, /未找到/)
})

test('resume_templates returns the three layouts', async () => {
  const tools = await loadTools()
  const out = JSON.parse(await tools.find((t) => t.name === 'resume_templates').execute({}))
  assert.deepEqual(
    out.templates.map((t) => t.id),
    ['classic', 'minimal', 'sidebar'],
  )
})

test('resume_render writes html and docx', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-'))
  const dataPath = path.join(dir, 'data.json')
  fs.writeFileSync(dataPath, JSON.stringify(sample), 'utf8')

  const tools = await loadTools()
  const raw = await tools
    .find((t) => t.name === 'resume_render')
    .execute({ dataPath, outDir: path.join(dir, 'out'), formats: 'html,docx' })
  const res = JSON.parse(raw)

  assert.equal(res.results.length, 1)
  assert.ok(fs.existsSync(res.results[0].files.html))
  assert.ok(fs.existsSync(res.results[0].files.docx))
  assert.equal(res.results[0].errors, 0)
})

test('resume_check reports stats and rules', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-'))
  const dataPath = path.join(dir, 'data.json')
  fs.writeFileSync(dataPath, JSON.stringify(sample), 'utf8')

  const tools = await loadTools()
  const out = JSON.parse(await tools.find((t) => t.name === 'resume_check').execute({ dataPath }))
  assert.equal(out.stats.bullets, 1)
  assert.ok(Array.isArray(out.issues))
})

test('plugin config supplies default outDir and template', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-'))
  const dataPath = path.join(dir, 'data.json')
  fs.writeFileSync(dataPath, JSON.stringify(sample), 'utf8')

  const outDir = path.join(dir, 'cfg-out')
  const tools = await loadTools({ outDir, template: 'minimal' })
  const res = JSON.parse(
    await tools.find((t) => t.name === 'resume_render').execute({ dataPath, formats: 'docx' }),
  )
  assert.equal(res.results[0].template, 'minimal')
  assert.ok(fs.existsSync(path.join(outDir, '插件测试-简历.docx')))
})
