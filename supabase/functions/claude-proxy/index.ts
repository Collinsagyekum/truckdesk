// claude-proxy — the only path from TruckDesk to the Claude API.
//
// The Anthropic key is the ANTHROPIC_API_KEY function secret, so it never ships
// in the web bundle or the iOS/Android apps. Every request must carry a signed-in
// user's Supabase access token, which is checked with Supabase Auth (so deleted
// accounts are rejected too) before anything is sent to Anthropic.
//
// Deploy with the gateway JWT check off: this function verifies the caller
// itself, and the gateway check can reject valid user tokens once a project
// moves to Supabase's new JWT signing keys.
//   npx supabase functions deploy claude-proxy --no-verify-jwt --project-ref ycukpolicbsliuktqpsh

import Anthropic from 'npm:@anthropic-ai/sdk@0.126.0'
import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import { corsHeaders } from 'npm:@supabase/supabase-js@2.116.0/cors'

// Pinned here rather than taken from the request, so a signed-in user can't
// use this endpoint as a general-purpose Claude API: callers only send text.
const MODEL = 'claude-opus-5'
// The app asks for one or two sentences; this leaves room for thinking while
// capping what any single request can cost.
const MAX_TOKENS = 4096
const MAX_PROMPT_CHARS = 4000

// Hosted functions receive publishable keys as JSON ({"default": "sb_publishable_..."});
// SUPABASE_ANON_KEY is the legacy equivalent.
function supabaseApiKey(): string | undefined {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<string, string>
    return keys.default ?? Object.values(keys)[0] ?? Deno.env.get('SUPABASE_ANON_KEY')
  } catch {
    return Deno.env.get('SUPABASE_ANON_KEY')
  }
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, supabaseApiKey()!, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders })

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Sign in to use AI features' }, 401)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (!user) {
    console.warn('claude-proxy: rejected caller:', authError?.message)
    return json({ error: 'Sign in to use AI features' }, 401)
  }

  const body: { prompt?: unknown; system?: unknown } | null = await req.json().catch(() => null)
  const prompt = body?.prompt
  const system = body?.system
  if (typeof prompt !== 'string' || !prompt.trim() || (system !== undefined && typeof system !== 'string')) {
    return json({ error: 'Expected { prompt: string, system?: string }' }, 400)
  }
  if (prompt.length + (system?.length ?? 0) > MAX_PROMPT_CHARS) {
    return json({ error: 'Prompt is too long' }, 413)
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    console.error('claude-proxy: the ANTHROPIC_API_KEY secret is not set')
    return json({ error: 'AI features are not configured' }, 500)
  }
  // Built per request so a rotated key takes effect without waiting for warm
  // instances to recycle.
  const anthropic = new Anthropic({ apiKey, timeout: 20_000, maxRetries: 1 })

  try {
    const message = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // Short answers in a screen the driver is waiting on.
      output_config: { effort: 'low' },
      // If a safety classifier declines, Anthropic re-runs the request on its
      // recommended fallback model instead of returning the refusal.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: prompt }],
    })
    console.log(JSON.stringify({ user: user.id, model: message.model, stop_reason: message.stop_reason, usage: message.usage }))

    if (message.stop_reason === 'refusal') return json({ error: 'Claude declined this request' }, 422)
    const text = message.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('').trim()
    if (message.stop_reason !== 'end_turn' || !text) {
      return json({ error: `Claude returned no usable answer (${message.stop_reason})` }, 502)
    }
    return json({ text })
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error('claude-proxy: Anthropic rejected ANTHROPIC_API_KEY:', err.status)
      return json({ error: 'AI features are not configured' }, 500)
    }
    if (err instanceof Anthropic.RateLimitError) {
      return json({ error: 'AI is busy, try again shortly' }, 429)
    }
    if (err instanceof Anthropic.APIConnectionError) {
      console.error('claude-proxy: could not reach Anthropic:', err.message)
      return json({ error: 'Could not reach Claude' }, 504)
    }
    if (err instanceof Anthropic.APIError) {
      console.error('claude-proxy: Anthropic API error:', err.status, err.message)
      return json({ error: 'Claude request failed' }, 502)
    }
    throw err
  }
}

Deno.serve(async (req) => {
  try {
    return await handle(req)
  } catch (err) {
    // Uncaught errors would otherwise return a bare 500 without CORS headers,
    // which browsers report as a misleading CORS failure.
    console.error('claude-proxy: unexpected error:', err)
    return json({ error: 'Internal error' }, 500)
  }
})
