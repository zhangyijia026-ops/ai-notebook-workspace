import type { AiOrganizeResult, AiOrganizeSource, AiReportInput, AiReportResult } from './aiService'

const proxyUrl = import.meta.env.VITE_AI_PROXY_URL || 'http://127.0.0.1:8787'

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${proxyUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => undefined)

  if (!response.ok) {
    throw new Error(payload?.error || `AI proxy request failed with ${response.status}.`)
  }

  return payload as T
}

export function organizeWithRealAi(content: string, source: AiOrganizeSource): Promise<AiOrganizeResult> {
  return postJson<AiOrganizeResult>('/ai/organize', { content, source })
}

export function generateReportWithRealAi(type: 'daily' | 'weekly', input?: AiReportInput): Promise<AiReportResult> {
  return postJson<AiReportResult>('/ai/report', { type, input })
}
