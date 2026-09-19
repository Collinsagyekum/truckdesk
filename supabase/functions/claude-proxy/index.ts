// Supabase Edge Function: claude-proxy
//
// Holds the Anthropic API key server-side. The web build and the Capacitor
// builds call this with the signed-in user's JWT; the key itself only ever
// exists as the ANTHROPIC_API_KEY secret on this function.

import Anthropic from 'npm:@anthropic-ai/sdk@0.127.0'
import { createClient } from 'npm:@supabase/supabase-js@2.106.2'

// The model the client used before this moved server-side. Set the
// ANTHROPIC_MODEL secret to change it without shipping a new app build.
const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-20250514'
const MAX_TOKENS = 1000

// Both prompts are a few hundred characters today; the cap is here so a
// compromised client can't turn one call into a large billable request.
const MAX_PROMPT_CHARS = 8000

// Requests are gated by the auth check below rather than by origin: the
// Capacitor builds send capacitor://localhost and https://localhost, which no
// fixed allowlist covers cleanly.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // Require a real signed-in user. Supabase's own verify_jwt is not enough on
  // its own: the anon key is itself a valid JWT and ships inside the client
  // bundle, so without this check anyone holding it could spend our credits.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let body: { prompt?: unknown; systemPrompt?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body must be JSON' }, 400)
  }

  const { prompt, systemPrompt } = body
  if (typeof prompt !== 'string' || prompt.trim() === '') {
    return json({ error: 'prompt is required' }, 400)
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return json({ error: 'prompt is too long' }, 400)
  }
  if (systemPrompt !== undefined && typeof systemPrompt !== 'string') {
    return json({ error: 'systemPrompt must be a string' }, 400)
  }
  if (typeof systemPrompt === 'string' && systemPrompt.length > MAX_PROMPT_CHARS) {
    return json({ error: 'systemPrompt is too long' }, 400)
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY secret is not set')
    return json({ error: 'Claude is not configured' }, 500)
  }

  try {
    const response = await new Anthropic({ apiKey }).messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim()

    if (!text) {
      return json({ error: 'Claude returned no text' }, 502)
    }

    return json({ text })
  } catch (err) {
    // Log the detail server-side but return a generic message: upstream errors
    // can echo request content back, and the client only needs to know it
    // failed so it can show its own fallback copy.
    console.error('Anthropic request failed:', err)
    if (err instanceof Anthropic.RateLimitError) {
      return json({ error: 'Claude is rate limited' }, 429)
    }
    if (err instanceof Anthropic.APIError) {
      return json({ error: 'Claude request failed' }, 502)
    }
    return json({ error: 'Claude request failed' }, 500)
  }
})
