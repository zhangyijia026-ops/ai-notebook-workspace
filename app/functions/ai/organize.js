import { buildOrganizeInput, callAi } from '../_shared/aiProxy.js'

export async function onRequestPost(context) {
  try {
    const body = await context.request.json()
    const result = await callAi(context.env, buildOrganizeInput(body))

    return Response.json(result)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown AI proxy error.' },
      { status: 500 },
    )
  }
}
