import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Claude is reached through the `claude-proxy` Supabase Edge Function
// (supabase/functions/claude-proxy), which holds the Anthropic API key and only
// answers signed-in users. Never call api.anthropic.com from here or put an
// Anthropic key in a VITE_ variable: Vite inlines those into the JS bundle that
// ships on the web and inside the iOS/Android apps.
//
// Throws when there's no session or the proxy fails, so callers can fall back.
export const claudeAPI = async (prompt: string, systemPrompt?: string): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sign in to use AI features')

  const { data, error } = await supabase.functions.invoke<{ text: string }>('claude-proxy', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { prompt, system: systemPrompt },
    timeout: 45_000,
  })
  if (error) {
    const detail: string | undefined = error instanceof FunctionsHttpError
      ? await error.context.json().then((body: { error?: string }) => body.error, () => undefined)
      : undefined
    throw new Error(`claude-proxy: ${detail ?? error.message}`)
  }
  if (!data?.text) throw new Error('claude-proxy returned no text')
  return data.text
}
