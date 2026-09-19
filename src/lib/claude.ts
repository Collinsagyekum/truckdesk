import { supabase } from './supabase'

/**
 * Sends a prompt to Claude through the `claude-proxy` Edge Function.
 *
 * The Anthropic key lives in that function's environment, never in this
 * bundle. Throws on any failure, so callers keep showing their fallback copy.
 */
export const claudeAPI = async (prompt: string, systemPrompt?: string): Promise<string> => {
  const { data, error } = await supabase.functions.invoke('claude-proxy', {
    body: { prompt, systemPrompt },
  })

  // invoke() resolves with an error rather than rejecting, so without this a
  // non-2xx would look like a successful call that returned undefined.
  if (error) {
    throw new Error(`claude-proxy request failed: ${error.message}`)
  }

  const text = (data as { text?: unknown } | null)?.text
  if (typeof text !== 'string' || text.trim() === '') {
    throw new Error('claude-proxy returned no text')
  }

  return text
}
