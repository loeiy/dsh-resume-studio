/**
 * 三套版式 + 共用的排版标尺（单位：pt / mm）。
 * 设计目标：同一份数据结构，HTML 与 DOCX 用同一组“设计 token”渲染，保证观感一致。
 */

export const TEMPLATES = {
  classic: {
    id: 'classic',
    name: '经典蓝线',
    desc: '深蓝分区线 + 单栏推进，稳重清晰，适合银行/国企/交付管理岗',
    page: { top: 12, bottom: 12, left: 14, right: 14 },
    font: { body: 'Microsoft YaHei', latin: 'Segoe UI' },
    size: { body: 10.5, name: 22.5, intent: 11.25, section: 12.75, small: 9.5 },
    line: 14.8,
    color: { text: '1F2329', muted: '4E5969', accent: '1A5FB4', rule: 'B9C9DD', name: '111111', band: 'F4F7FB' },
    header: { layout: 'stack', infoColumns: 2, gap: 40, nameTracking: 1.5 },
    section: { style: 'rule', ruleSize: 9, spaceBefore: 8.25, spaceAfter: 3 },
    entry: { spaceBefore: 5.25, roleGap: '　' },
    bullet: { left: 14, hanging: 9, spaceBefore: 0 },
    rules: { pageNumbers: false },
  },

  minimal: {
    id: 'minimal',
    name: '极简黑白',
    desc: '无彩色、细横线、字距标题，克制专业，适合外企/学术/咨询',
    page: { top: 14, bottom: 14, left: 16, right: 16 },
    font: { body: 'Microsoft YaHei', latin: 'Segoe UI' },
    size: { body: 10.5, name: 20, intent: 10.5, section: 10, small: 9.5 },
    line: 15.2,
    color: { text: '111111', muted: '555555', accent: '111111', rule: 'D0D0D0', name: '000000', band: 'FAFAFA' },
    header: { layout: 'stack', infoColumns: 3, gap: 24, nameTracking: 6 },
    section: { style: 'tracked', ruleSize: 4, spaceBefore: 10.5, spaceAfter: 3.75 },
    entry: { spaceBefore: 6, roleGap: ' · ' },
    bullet: { left: 13, hanging: 8, spaceBefore: 0 },
    rules: { pageNumbers: false },
  },

  sidebar: {
    id: 'sidebar',
    name: '侧栏信息带',
    desc: '首屏浅灰信息带（左姓名右联系）+ 左侧竖线分区，现代感强，适合互联网/产品/技术',
    page: { top: 10, bottom: 12, left: 13, right: 13 },
    font: { body: 'Microsoft YaHei', latin: 'Segoe UI' },
    size: { body: 10.5, name: 20, intent: 10.5, section: 11.5, small: 9 },
    line: 14.6,
    color: { text: '1F2329', muted: '4E5969', accent: '0F766E', rule: 'CBD5D3', name: '0B1F1C', band: 'F1F5F4' },
    header: { layout: 'band', infoColumns: 3, gap: 14, nameTracking: 2 },
    section: { style: 'bar', ruleSize: 12, spaceBefore: 8, spaceAfter: 2.5 },
    entry: { spaceBefore: 5, roleGap: '　' },
    bullet: { left: 13.5, hanging: 8.5, spaceBefore: 0 },
    rules: { pageNumbers: true },
  },
}

export const TEMPLATE_IDS = Object.keys(TEMPLATES)

export function getTemplate(id) {
  const t = TEMPLATES[id || 'classic']
  if (!t) throw new Error(`未知版式 "${id}"，可选：${TEMPLATE_IDS.join(' / ')}`)
  return t
}

export const PT_PER_MM = 72 / 25.4
export const TWIP_PER_PT = 20

export function textWidthPt(t) {
  return (210 - t.page.left - t.page.right) * PT_PER_MM
}
