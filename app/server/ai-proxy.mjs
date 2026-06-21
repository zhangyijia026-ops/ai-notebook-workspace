import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env')

  if (!existsSync(envPath)) {
    return
  }

  const envContent = readFileSync(envPath, 'utf8')

  for (const line of envContent.split('\n')) {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith('#') || !trimmedLine.includes('=')) {
      continue
    }

    const [rawKey, ...rawValueParts] = trimmedLine.split('=')
    const key = rawKey.trim()
    const value = rawValueParts.join('=').trim().replace(/^["']|["']$/g, '')

    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

loadEnvFile()

const port = Number(process.env.AI_PROXY_PORT || 8787)
const apiBaseUrl = (process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini'
const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    ...corsHeaders,
    'Content-Type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk

      if (body.length > 1_000_000) {
        request.destroy()
        reject(new Error('Request body is too large.'))
      }
    })

    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Invalid JSON request body.'))
      }
    })

    request.on('error', reject)
  })
}

function buildOrganizeInput(body) {
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
        '2. 生成一个适合作为笔记标题的中文短标题：必须抓住内容里的具体对象、结论或主题；不要使用“摘录”“灵感”“未命名”“AI 对话”“工作记录”这类泛称；不要超过 18 个中文字符。',
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

function buildReportInput(body) {
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
      .map((part) => {
        if (typeof part === 'string') {
          return part
        }

        return part?.text || ''
      })
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

async function requestChatCompletion(messages, useJsonMode) {
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

async function callAi(messages) {
  if (!apiKey) {
    throw new Error('AI_API_KEY is not configured.')
  }

  let response = await requestChatCompletion(messages, true)
  let payload = await response.json().catch(() => undefined)

  if (!response.ok && /response_format|json/i.test(payload?.error?.message || '')) {
    response = await requestChatCompletion(messages, false)
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

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders)
    response.end()
    return
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed.' })
    return
  }

  try {
    const body = await readJson(request)

    if (request.url === '/ai/organize') {
      const result = await callAi(buildOrganizeInput(body))
      sendJson(response, 200, result)
      return
    }

    if (request.url === '/ai/report') {
      const result = await callAi(buildReportInput(body))
      sendJson(response, 200, result)
      return
    }

    sendJson(response, 404, { error: 'Route not found.' })
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Unknown AI proxy error.',
    })
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`AI proxy listening on http://127.0.0.1:${port}`)
  console.log(`Base URL: ${apiBaseUrl}`)
  console.log(`Model: ${model}`)
})
