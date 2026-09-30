import { useEffect, useRef, useState } from 'react';
import { X, Send, Sparkles, RotateCcw } from 'lucide-react';
import { claudeChat } from '../../lib/claude';
import type { ChatMessage } from '../../lib/claude';

interface DisplayMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  // Set on an assistant bubble when the request failed; carries the question so
  // it can be retried, and keeps the failed turn out of the history we resend.
  retry?: string;
}

interface TaxAdvisorChatProps {
  open: boolean;
  onClose: () => void;
  // The driver's real numbers, rendered into the system prompt so answers are
  // grounded in their situation rather than generic.
  systemPrompt: string;
  // Shown as the assistant's opening bubble (the headline advice already on the
  // dashboard). UI only — not sent back to the model; the system prompt carries
  // the same context.
  opening: string;
  suggestions: string[];
}

let nextId = 1;
const uid = () => nextId++;

export default function TaxAdvisorChat({ open, onClose, systemPrompt, opening, suggestions }: TaxAdvisorChatProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Intentionally no autofocus on open: raising the keyboard immediately shoves
  // the fixed sheet up (iOS WebView) and buries the header, and it hides the
  // suggested questions — which are the main way in. The driver taps a
  // suggestion or the input when ready.

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || sending) return;
    setInput('');

    // Only successful turns are resent, so a failed attempt never poisons the
    // history and the model always sees a clean user/assistant sequence.
    const history: ChatMessage[] = messages
      .filter((m) => !m.retry)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, { id: uid(), role: 'user', content: q }]);
    setSending(true);
    try {
      const reply = await claudeChat([...history, { role: 'user', content: q }], systemPrompt);
      setMessages((prev) => [...prev, { id: uid(), role: 'assistant', content: reply }]);
    } catch (err) {
      console.error('Tax advisor chat failed:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: "I couldn't answer that just now. Check your connection and try again.",
          retry: q,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter for a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask(input);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-navy-950/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Tax advisor chat"
    >
      {/* Header */}
      {/* The app's viewport has no viewport-fit=cover, so env(safe-area-inset-*)
          is 0 here; the min values clear the status bar and home indicator, and
          env() still wins on devices where it's larger. */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-navy-900/80 shrink-0 pt-[max(3.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-brand-green/10 rounded-xl text-brand-green">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white leading-tight">Tax Advisor</h2>
            <p className="text-[11px] text-gray-400 leading-tight">Ask about your taxes & deductions</p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Opening advice bubble */}
        <div className="flex justify-start">
          <div className="max-w-[85%] bg-navy-800 border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3">
            <p className="text-sm text-gray-100 leading-relaxed whitespace-pre-wrap">{opening}</p>
          </div>
        </div>

        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] bg-brand-green text-navy-900 rounded-2xl rounded-tr-sm px-4 py-3">
                <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex justify-start">
              <div className={`max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 border ${m.retry ? 'bg-brand-red/10 border-brand-red/20' : 'bg-navy-800 border-white/5'}`}>
                <p className="text-sm text-gray-100 leading-relaxed whitespace-pre-wrap">{m.content}</p>
                {m.retry && (
                  <button
                    onClick={() => ask(m.retry!)}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-green hover:underline"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Try again
                  </button>
                )}
              </div>
            </div>
          )
        )}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-navy-800 border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3.5">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Suggested questions — only before the driver has asked anything, so
            the chat isn't an intimidating blank box. */}
        {messages.length === 0 && !sending && (
          <div className="pt-1 space-y-2">
            <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider px-1">Try asking</p>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="block w-full text-left text-sm text-gray-200 bg-navy-800/60 hover:bg-navy-700/60 border border-white/5 hover:border-brand-green/30 rounded-xl px-4 py-2.5 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={onSubmit}
        className="border-t border-white/10 bg-navy-900/80 px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] shrink-0"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Ask about your taxes..."
            /* min-w-0 lets the textarea shrink below its content width; without
               it a flex item defaults to min-width:auto and a long question
               pushes the send button off the right edge. */
            className="flex-1 min-w-0 resize-none max-h-32 bg-navy-800 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-green/50"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            aria-label="Send"
            className="shrink-0 w-10 h-10 rounded-full bg-brand-green text-navy-900 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-green/90 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-gray-500 mt-2 text-center">
          Estimates and general guidance — confirm big decisions with your tax pro.
        </p>
      </form>
    </div>
  );
}
