// Supabase Edge Function: busca metadata (title/description/image) de uma URL
// para evitar CORS direto do browser. Deploy: supabase functions deploy link-preview
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

function extractMeta(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i')
  ]
  for (const re of patterns) {
    const match = html.match(re)
    if (match) return match[1]
  }
  return null
}

// Bloqueia SSRF: so http(s), sem credenciais, sem localhost/IP privado/link-local/metadata.
function isBlockedHost(host) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true
  if (h.includes(':')) return true // IPv6 literal
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])]
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
  }
  return !h.includes('.')
}

// Exige usuario logado: valida o JWT no Auth antes de fazer qualquer fetch externo.
async function requireUser(req) {
  const auth = req.headers.get('Authorization') || ''
  const base = Deno.env.get('SUPABASE_URL')
  const apikey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!auth.startsWith('Bearer ') || !base || !apikey) return false
  const r = await fetch(`${base}/auth/v1/user`, { headers: { Authorization: auth, apikey } })
  return r.ok
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!(await requireUser(req))) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const { url } = await req.json()
    if (!url) throw new Error('missing url')
    const target = new URL(url)
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || isBlockedHost(target.hostname)) {
      throw new Error('url not allowed')
    }

    const res = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0 PandaReportsBot' },
      redirect: 'error', // redirect poderia levar a um host interno
      signal: AbortSignal.timeout(8000)
    })
    const html = (await res.text()).slice(0, 500_000)

    const title = extractMeta(html, 'og:title') || html.match(/<title>([^<]+)<\/title>/i)?.[1] || null
    const description = extractMeta(html, 'og:description') || extractMeta(html, 'description')
    const image = extractMeta(html, 'og:image')

    return new Response(JSON.stringify({ title, description, image }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
