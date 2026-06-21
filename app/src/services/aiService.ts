export type AiOrganizeResult = {
  title?: string
  summary: string
  tags: string[]
  recommendedNotebookId?: string
}

export type AiReportResult = {
  title: string
  content: string
}

export type AiReportInput = {
  completedTodos: string[]
  pendingTodos: string[]
  noteHighlights: string[]
  clipHighlights: string[]
}

export type AiOrganizeSource = 'xiaohongshu' | 'ai_chat' | 'wechat' | 'feishu' | 'web' | 'manual' | 'other'

import { generateReportWithRealAi, organizeWithRealAi } from './aiClient'

const aiMode = import.meta.env.VITE_AI_MODE === 'real' ? 'real' : 'mock'

function pickContentType(content: string, source: AiOrganizeSource) {
  if (source === 'xiaohongshu') {
    if (/护肤|穿搭|食谱|旅行|探店|种草|避雷|攻略/.test(content)) {
      return '小红书内容灵感'
    }

    return '小红书选题/表达素材'
  }

  if (source === 'ai_chat') {
    return 'AI 对话方案/思路'
  }

  if (source === 'wechat' || source === 'feishu') {
    return '工作消息/协作信息'
  }

  return '通用灵感摘录'
}

function buildInterpretation(content: string, source: AiOrganizeSource) {
  if (!content) {
    return '内容解读：暂无内容。'
  }

  const compactContent = content.replace(/\s+/g, ' ').trim()
  const preview = compactContent.slice(0, 140)
  const contentType = pickContentType(compactContent, source)
  const sourceNameMap: Record<AiOrganizeSource, string> = {
    xiaohongshu: '小红书',
    ai_chat: 'AI 聊天',
    wechat: '微信',
    feishu: '飞书',
    web: '网页',
    manual: '手动输入',
    other: '其他来源',
  }

  return [
    `内容类型：${contentType}`,
    `核心观点：这条${sourceNameMap[source]}内容的重点是“${preview}${compactContent.length > 140 ? '...' : ''}”。`,
    '可复用价值：可以沉淀为选题、工作思路、表达素材或后续行动线索。',
    source === 'xiaohongshu'
      ? '小红书解读：优先关注标题角度、用户痛点、场景表达、评论区可能延展的问题，以及是否能转化为自己的内容选题。'
      : '使用建议：建议结合当前工作目标判断是否需要转成 Todo、方案片段或长期素材。',
    '下一步建议：补充自己的判断，再决定是否转入对应笔记本长期保存。',
  ].join('\n')
}

function buildSuggestedTitle(content: string, source: AiOrganizeSource) {
  const compactContent = content.replace(/\s+/g, ' ').trim()

  if (!compactContent) {
    return '未命名笔记'
  }

  const firstLine = content
    .split('\n')
    .map((line) => line.trim().replace(/^#+\s*/, ''))
    .find(Boolean)

  const titleBase = firstLine || compactContent
  const sourcePrefixMap: Partial<Record<AiOrganizeSource, string>> = {
    xiaohongshu: '小红书',
    ai_chat: 'AI',
    wechat: '微信',
    feishu: '飞书',
  }
  const prefix = sourcePrefixMap[source]
  const cleanedTitle = titleBase
    .replace(/^标题[:：]/, '')
    .replace(/^(关于|一篇|一条)/, '')
    .replace(/[。！？.!?].*$/, '')
  const trimmedTitle = cleanedTitle.slice(0, 18)

  return prefix ? `${prefix}：${trimmedTitle}` : trimmedTitle
}

async function organizeContentWithMock(
  content: string,
  source: AiOrganizeSource = 'manual',
): Promise<AiOrganizeResult> {
  const normalizedContent = content.trim()
  const sourceConfig: Record<AiOrganizeSource, Pick<AiOrganizeResult, 'tags' | 'recommendedNotebookId'>> = {
    xiaohongshu: {
      tags: ['小红书', '内容灵感', 'AI 识别'],
      recommendedNotebookId: 'notebook_xiaohongshu',
    },
    ai_chat: {
      tags: ['AI 对话', '灵感摘录', 'AI 识别'],
      recommendedNotebookId: 'notebook_ai_chats',
    },
    wechat: {
      tags: ['微信', '工作消息', '待整理'],
      recommendedNotebookId: 'notebook_work',
    },
    feishu: {
      tags: ['飞书', '工作消息', '待整理'],
      recommendedNotebookId: 'notebook_work',
    },
    web: {
      tags: ['网页', '资料摘录', '待整理'],
      recommendedNotebookId: 'notebook_inspiration',
    },
    manual: {
      tags: ['手动输入', '灵感', '待整理'],
      recommendedNotebookId: 'notebook_inspiration',
    },
    other: {
      tags: ['其他来源', '待整理'],
      recommendedNotebookId: 'notebook_unsorted',
    },
  }
  const config = sourceConfig[source]

  return {
    title: buildSuggestedTitle(normalizedContent, source),
    summary: buildInterpretation(normalizedContent, source),
    tags: config.tags,
    recommendedNotebookId: config.recommendedNotebookId,
  }
}

function formatList(items: string[], fallback: string) {
  if (items.length === 0) {
    return `1. ${fallback}`
  }

  return items.map((item, index) => `${index + 1}. ${item}`).join('\n')
}

async function generateReportWithMock(type: 'daily' | 'weekly', input?: AiReportInput): Promise<AiReportResult> {
  const title = type === 'daily' ? '今日日报草稿' : '本周周报草稿'
  const completedTodos = input?.completedTodos ?? []
  const pendingTodos = input?.pendingTodos ?? []
  const noteHighlights = input?.noteHighlights ?? []
  const clipHighlights = input?.clipHighlights ?? []
  return {
    title,
    content:
      type === 'daily'
        ? [
            '今日完成：',
            formatList(completedTodos, '暂无已完成 Todo，可补充今日实际完成事项。'),
            '',
            '进行中：',
            formatList(pendingTodos, '暂无进行中 Todo。'),
            '',
            '关键思考：',
            formatList([...noteHighlights, ...clipHighlights].slice(0, 5), '暂无笔记或摘录沉淀。'),
            '',
            '明日计划：',
            formatList(pendingTodos.slice(0, 5), '根据今日进展补充明日计划。'),
          ].join('\n')
        : [
            '本周重点成果：',
            formatList(completedTodos, '暂无已完成 Todo，可补充本周实际成果。'),
            '',
            '关键进展：',
            formatList(noteHighlights.slice(0, 6), '暂无笔记沉淀。'),
            '',
            '问题与风险：',
            formatList(pendingTodos.slice(0, 5), '暂无明确风险，可补充阻塞事项。'),
            '',
            '下周计划：',
            formatList(pendingTodos.slice(0, 6), '根据本周未完成事项补充下周计划。'),
            '',
            '灵感与素材：',
            formatList(clipHighlights.slice(0, 6), '暂无摘录素材。'),
          ].join('\n'),
  }
}

export async function organizeContent(
  content: string,
  source: AiOrganizeSource = 'manual',
): Promise<AiOrganizeResult> {
  if (aiMode === 'real') {
    try {
      return await organizeWithRealAi(content, source)
    } catch (error) {
      console.warn('Real AI organize failed, falling back to mock.', error)
    }
  }

  return organizeContentWithMock(content, source)
}

export async function generateReport(type: 'daily' | 'weekly', input?: AiReportInput): Promise<AiReportResult> {
  if (aiMode === 'real') {
    try {
      return await generateReportWithRealAi(type, input)
    } catch (error) {
      console.warn('Real AI report failed, falling back to mock.', error)
    }
  }

  return generateReportWithMock(type, input)
}
