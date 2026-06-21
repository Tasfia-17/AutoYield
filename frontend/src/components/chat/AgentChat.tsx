'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendChatMessage } from '@/lib/api';
import { useVaultStore } from '@/lib/store';

interface Message {
  id: number;
  role: 'user' | 'agent';
  text: string;
  ts: Date;
}

const QUICK_PROMPTS = [
  'Why did you rebalance just now?',
  "What's my current P&L?",
  'Is my portfolio safe from impermanent loss?',
  'What would happen if SUI drops 20%?',
  'Explain my current allocations',
];

export function AgentChat() {
  const { suiAddress } = useVaultStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: 'agent',
      text: "👋 Hey! I'm the AutoYield AI agent. I'm actively managing your vault across Scallop, DeepBook, and Cetus. Ask me anything about your portfolio, my decisions, or the current market conditions.",
      ts: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: Date.now(), role: 'user', text: text.trim(), ts: new Date() };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setLoading(true);

    // Add streaming agent message placeholder
    const agentId = Date.now() + 1;
    setMessages((m) => [...m, { id: agentId, role: 'agent', text: '', ts: new Date() }]);

    try {
      await sendChatMessage(text, suiAddress ?? undefined, (chunk) => {
        setMessages((m) =>
          m.map((msg) => msg.id === agentId ? { ...msg, text: msg.text + chunk } : msg)
        );
      });
    } catch {
      setMessages((m) =>
        m.map((msg) => msg.id === agentId
          ? { ...msg, text: 'I couldn\'t connect to the backend. Make sure the API server is running.' }
          : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass rounded-2xl overflow-hidden flex flex-col" style={{ height: '65vh' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-amber-500/20 glass-amber">
        <div className="text-2xl animate-breathe">🤖</div>
        <div>
          <div className="font-display text-lg text-ink">AutoYield Agent</div>
          <div className="flex items-center gap-1.5 text-xs text-matcha font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-matcha animate-pulse" />
            Online · Monitoring vault
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'agent' && <span className="mr-2 mt-1 text-lg flex-shrink-0">🤖</span>}
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'text-white rounded-tr-sm'
                  : 'glass text-ink rounded-tl-sm'
              }`}
              style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #F59E0B, #D97706)' } : {}}
            >
              {msg.text || (
                <span className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
            </div>
          </motion.div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div className="px-5 py-2 border-t border-amber-500/10">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full glass-amber text-amber-700 font-semibold hover:opacity-80 transition whitespace-nowrap"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-5 pb-5 pt-2">
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the agent anything..."
            className="flex-1 px-4 py-3 rounded-xl glass text-sm text-ink placeholder-ink/40 focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-5 py-3 rounded-xl font-display text-sm text-white disabled:opacity-50 transition"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
          >
            {loading ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
