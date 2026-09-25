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
// The app asks for short answers; this leaves room for thinking while capping
// what any single request can cost.
const MAX_TOKENS = 4096
// Covers a grounding system prompt (~1k chars) plus several turns of a tax-
// advisor chat. Still a hard ceiling on what one request can cost.
const MAX_INPUT_CHARS = 16000
// A chat can't grow without bound; old turns are dropped client-side before this.
const MAX_MESSAGES = 24

type ChatMessage = { role: 'user' | 'assistant'; content: string }

// Accepts either { prompt } (one-shot callers like the negotiation script) or
// { messages } (the tax-advisor chat). Returns the validated turns, or a string
// describing what's wrong with the request.
function parseMessages(body: { prompt?: unknown; messages?: unknown }): ChatMessage[] | string {
  if (Array.isArray(body.messages)) {
    const raw = body.messages
    if (raw.length === 0 || raw.length > MAX_MESSAGES) return `Expected 1..${MAX_MESSAGES} messages`
    const out: ChatMessage[] = []
    for (const m of raw) {
      if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim()) {
        return 'Each message needs role "user" or "assistant" and non-empty content'
      }
      out.push({ role: m.role, content: m.content })
    }
    // Anthropic requires the first turn to be the user's; we always send the
    // driver's new question last, so the reply answers it.
    if (out[0].role !== 'user' || out[out.length - 1].role !== 'user') {
      return 'Conversation must start and end with a user message'
    }
    return out
  }
  if (typeof body.prompt === 'string' && body.prompt.trim()) {
    return [{ role: 'user', content: body.prompt }]
  }
  return 'Expected { prompt: string } or { messages: [{ role, content }] }'
}

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

  const body: { prompt?: unknown; messages?: unknown; system?: unknown } | null = await req.json().catch(() => null)
  const system = body?.system
  if (system !== undefined && typeof system !== 'string') {
    return json({ error: 'system must be a string' }, 400)
  }
  const messages = parseMessages(body ?? {})
  if (typeof messages === 'string') return json({ error: messages }, 400)

  const totalChars = (system?.length ?? 0) + messages.reduce((n, m) => n + m.content.length, 0)
  if (totalChars > MAX_INPUT_CHARS) {
    return json({ error: 'Conversation is too long' }, 413)
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
      messages,
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
