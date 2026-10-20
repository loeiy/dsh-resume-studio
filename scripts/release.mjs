#!/usr/bin/env node
/**
 * Release 打包脚本（零依赖）。
 *
 *   node scripts/release.mjs                 # 用当前版本打包
 *   node scripts/release.mjs --bump patch    # 先升版本（patch|minor|major）
 *   node scripts/release.mjs --no-test       # 跳过测试（不推荐）
 *
 * 产物：dist/<name>-<version>.tgz + dist/release-notes.md
 * 最后打印 gh release create 命令，是否发布由你决定。
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const isWin = process.platform === 'win32'
const argv = process.argv.slice(2)
const has = (name) => argv.includes(name)
const flag = (name) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}
const die = (msg) => {
  process.stderr.write(`\n✗ ${msg}\n`)
  process.exit(1)
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: isWin })
  if (r.status !== 0) die(`${cmd} ${args.join(' ')} 失败`)
}
function capture(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: isWin })
  if (r.status !== 0) die(`${cmd} ${args.join(' ')} 失败：${(r.stderr || '').trim()}`)
  return r.stdout
}
function captureSoft(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: isWin })
  return r.status === 0 ? r.stdout.trim() : ''
}

// 1. 工作区检查
const dirty = captureSoft('git', ['status', '--porcelain'])
if (dirty) {
  process.stderr.write('! 工作区有未提交改动，打出来的包会包含它们：\n')
  process.stderr.write(dirty.split('\n').slice(0, 8).map((l) => `  ${l}`).join('\n') + '\n\n')
}

// 2. 测试
if (!has('--no-test')) run('npm', ['test'])

// 3. 版本
const bump = flag('--bump')
if (bump && !['patch', 'minor', 'major'].includes(bump)) die(`--bump 只能是 patch/minor/major，收到 "${bump}"`)
if (bump) run('npm', ['version', bump, '--no-git-tag-version'])

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const { name, version } = pkg
const tag = `v${version}`

// 4. 打包
if (!existsSync('dist')) mkdirSync('dist')
const packed = JSON.parse(capture('npm', ['pack', '--pack-destination', 'dist', '--json']))
const info = Array.isArray(packed) ? packed[0] : packed
const tarball = join('dist', info.filename)
const bytes = readFileSync(tarball)
const sha256 = createHash('sha256').update(bytes).digest('hex')
const kb = (bytes.length / 1024).toFixed(1)

// 5. 推断仓库地址（用于写明安装命令）
const remote = captureSoft('git', ['remote', 'get-url', 'origin'])
const m = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)/)
const slug = m ? `${m[1]}/${m[2]}` : 'loeiy/dsh-resume-studio'

// 6. Release notes
const notes = `## ${name} ${tag}

- 打包时间：${new Date().toLocaleString('zh-CN', { hour12: false })}
- 文件：\`${info.filename}\`（${kb} kB）
- SHA-256：\`${sha256}\`

### 安装

\`\`\`powershell
dsh plugin add github:${slug}#${tag}
# 或直接用这个 tarball
dsh plugin add https://github.com/${slug}/releases/download/${tag}/${info.filename}
\`\`\`

### 内容

${info.files?.map((f) => `- \`${f.path}\``).join('\n') || '- 见 npm pack 输出'}
`
const notesFile = join('dist', 'release-notes.md')
writeFileSync(notesFile, notes, 'utf8')

// 7. 汇总
const posixTarball = tarball.split('\\').join('/')
const posixNotes = notesFile.split('\\').join('/')

process.stdout.write(`
✓ 打包完成
  版本    ${version}
  文件    ${tarball}（${kb} kB）
  SHA-256 ${sha256}
  说明    ${notesFile}

下一步（三选一）：

  # A. 只在本地留档
  #    已生成 ${tarball}

  # B. 发 GitHub Release（需要 gh CLI 已登录）
  git tag ${tag} && git push origin ${tag}
  gh release create ${tag} "${posixTarball}" --title "${tag}" --notes-file "${posixNotes}"

  # C. 发 npm（可选，需先 npm login --registry=https://registry.npmjs.org）
  npm run publish:npm
`)

if (has('--bump')) {
  process.stdout.write(`\n提醒：版本已改为 ${version}，记得提交：\n  git add package.json package-lock.json\n  git commit -m "chore(release): ${tag}"\n`)
}
