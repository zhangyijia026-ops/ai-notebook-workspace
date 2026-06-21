const SUPABASE_URL = 'https://yialxhrpwumtwgxldpjd.supabase.co'

export async function onRequest(context) {
  const url = new URL(context.request.url)
  const targetUrl = SUPABASE_URL + url.pathname.replace(/^\/supabase-proxy/, '') + url.search

  const headers = new Headers(context.request.headers)
  headers.delete('host')

  const response = await fetch(targetUrl, {
    method: context.request.method,
    headers,
    body: ['GET', 'HEAD'].includes(context.request.method) ? undefined : context.request.body,
  })

  const responseHeaders = new Headers(response.headers)
  responseHeaders.set('Access-Control-Allow-Origin', '*')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}
