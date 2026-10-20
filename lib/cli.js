#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

import { checkResume, listTemplates, loadData, renderResume } from './api.js'
import { RULES } from './lint.js'

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        out[key] = next
        i++
      } else out[key] = true
    } else out._.push(a)
  }
  return out
}

function init(args) {
  const file = path.resolve(args.out || 'resume.json')
  if (fs.existsSync(file)) throw new Error(`已存在：${file}`)
  const skeleton = {
    meta: { template: 'classic', maxPages: 2 },
    basics: {
      name: '你的姓名',
      intent: '求职意向：后端开发工程师',
      fields: [
        ['电话', '13800000000'],
        ['邮箱', 'name@example.com'],
        ['工作年限', '3 年'],
        ['学历', '本科'],
      ],
    },
    sections: [
      {
        kind: 'timeline',
        title: '工作经历',
        items: [
          {
            head: '公司名称',
            sub: '后端开发工程师',
            date: '2022.07 - 至今',
            bullets: ['主导 **订单中心** 重构，把接口 P99 从 800ms 降到 220ms，线上超时告警下降 **85%**'],
          },
        ],
      },
      { kind: 'list', title: '专业技能', bullets: ['**后端**：熟悉 Java、Spring Boot，掌握 MySQL 索引优化与 Redis 缓存设计'] },
      {
        kind: 'project',
        title: '项目经历',
        items: [
          {
            head: '项目名称',
            sub: '核心开发',
            date: '2023.03 - 2023.12',
            intro: '**项目介绍：**面向 B 端的订单履约中台，支撑日均 200 万单。',
            label: '职责与成果：',
            bullets: ['**履约链路**：拆分超时任务，把平均履约时长压缩 30%'],
          },
        ],
      },
    ],
  }
  fs.writeFileSync(file, JSON.stringify(skeleton, null, 2), 'utf8')
  return { created: file }
}

const HELP = `dsh-resume — 简历渲染器（HTML / DOCX / PDF）

  node lib/cli.js render --in resume.json --out out [--templates classic,minimal,sidebar]
                         [--formats html,docx,pdf] [--max-pages 3]
  node lib/cli.js check  --in resume.json [--pdf out/x.pdf] [--max-pages 3]
  node lib/cli.js templates
  node lib/cli.js init   [--out resume.json]
`

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const cmd = args._[0]
  let result

  if (cmd === 'render') {
    if (!args.in) throw new Error('缺少 --in <data.json>')
    result = await renderResume(loadData(args.in), {
      outDir: args.out || 'out',
      templates: args.templates ? String(args.templates).split(',').map((s) => s.trim()) : undefined,
      formats: args.formats ? String(args.formats).split(',').map((s) => s.trim()) : undefined,
      maxPages: args['max-pages'],
    })
  } else if (cmd === 'check') {
    if (!args.in) throw new Error('缺少 --in <data.json>')
    result = { ...(await checkResume(loadData(args.in), { pdf: args.pdf, maxPages: args['max-pages'] })), rules: RULES }
  } else if (cmd === 'templates') {
    result = { templates: listTemplates() }
  } else if (cmd === 'init') {
    result = init(args)
  } else {
    process.stdout.write(HELP)
    return
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
}

main().catch((e) => {
  process.stderr.write(`错误：${e.message}\n`)
  process.exit(1)
})
