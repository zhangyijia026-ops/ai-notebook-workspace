export function buildOrganizeInput(body) {
  return [
    {
      role: 'system',
      content:
        '你是一个中文个人知识管理助手。请把用户粘贴的内容解读成可沉淀的笔记素材。只输出严格 JSON，不要输出 Markdown 代码块或解释文字。JSON 字段必须是 title、summary、tags、recommendedNotebookId。',
    },
    {
      role: 'user',
      content: [
        `来源：${body.source || 'manual'}`,
        '',
        '请完成：',
        '1. 解读内容，而不是只复述原文。',
        '2. 生成一个适合作为笔记标题的中文短标题：必须抓住内容里的具体对象、结论或主题；不要使用"摘录""灵感""未命名""AI 对话""工作记录"这类泛称；不要超过 18 个中文字符。',
        '3. 判断应该归入哪个笔记本。',
        '4. 生成适合检索的中文标签。',
        '5. recommendedNotebookId 只能从这些值中选择：notebook_work、notebook_inspiration、notebook_ai_chats、notebook_xiaohongshu、notebook_reports、notebook_unsorted。',
        '6. 不要提取 Todo，不要修改用户任务，只整理笔记本归类、摘要和标签。',
        '',
        '内容：',
        String(body.content || '').slice(0, 12000),
      ].join('\n'),
    },
  ]
}

export function buildReportInput(body) {
  const reportTypeLabel = body.type === 'weekly' ? '周报' : '日报'

  return [
    {
      role: 'system',
      content:
        '你是一个中文工作总结助手。请基于用户提供的 Todo、笔记和摘录生成清晰、务实、可编辑的报告。只输出严格 JSON，不要输出 Markdown 代码块或解释文字。JSON 字段必须是 title、content。',
    },
    {
      role: 'user',
      content: [
        `报告类型：${reportTypeLabel}`,
        '',
        '要求：',
        '1. 不要编造未提供的事实。',
        '2. 内容要适合直接保存为个人工作笔记。',
        '3. 日报包含：今日完成、进行中、关键思考、明日计划。',
        '4. 周报包含：本周重点成果、关键进展、问题与风险、下周计划、灵感与素材。',
        '',
        `已完成 Todo：${JSON.stringify(body.input?.completedTodos ?? [])}`,
        `未完成 Todo：${JSON.stringify(body.input?.pendingTodos ?? [])}`,
        `笔记重点：${JSON.stringify(body.input?.noteHighlights ?? [])}`,
        `摘录重点：${JSON.stringify(body.input?.clipHighlights ?? [])}`,
      ].join('\n'),
    },
  ]
}

function extractChatText(payload) {
  const content = payload?.choices?.[0]?.message?.content

  if (typeof content === 'string') {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .join('\n')
      .trim()
  }

  return ''
}

function parseJsonText(text) {
  const trimmedText = text.trim()
  const withoutFence = trimmedText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  const jsonStart = withoutFence.indexOf('{')
  const jsonEnd = withoutFence.lastIndexOf('}')

  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    return JSON.parse(withoutFence.slice(jsonStart, jsonEnd + 1))
  }

  return JSON.parse(withoutFence)
}

export async function callAi(env, messages) {
  const apiBaseUrl = (env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = env.AI_MODEL || 'gpt-4.1-mini'
  const apiKey = env.AI_API_KEY

  if (!apiKey) {
    throw new Error('AI_API_KEY is not configured.')
  }

  async function requestChatCompletion(useJsonMode) {
    const body = {
      model,
      messages,
      temperature: 0.2,
    }

    if (useJsonMode) {
      body.response_format = { type: 'json_object' }
    }

    return fetch(`${apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  let response = await requestChatCompletion(true)
  let payload = await response.json().catch(() => undefined)

  if (!response.ok && /response_format|json/i.test(payload?.error?.message || '')) {
    response = await requestChatCompletion(false)
    payload = await response.json().catch(() => undefined)
  }

  if (!response.ok) {
    throw new Error(payload?.error?.message || `AI request failed with ${response.status}.`)
  }

  const textOutput = extractChatText(payload)

  if (!textOutput) {
    throw new Error('AI returned an empty response.')
  }

  return parseJsonText(textOutput)
}
