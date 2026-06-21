'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { TfxOverlay } from '@/components/ui/TfxOverlay';

const PROTOCOLS = [
  {
    id: 'scallop', emoji: '🐚', name: 'Scallop', badge: 'Lending',
    color: '#F59E0B',
    desc: 'Supply USDC to Scallop lending pools. Earn supply APY from borrower interest. Low risk, steady yield.',
    risk: 'Low', docs: 'https://docs.scallop.io',
  },
  {
    id: 'deepbook', emoji: '📖', name: 'DeepBook', badge: 'Order Book',
    color: '#F4A261',
    desc: 'Place maker limit orders on Sui\'s native CLOB. Earn trading fee rebates from taker volume.',
    risk: 'Medium', docs: 'https://docs.deepbook.tech',
  },
  {
    id: 'cetus', emoji: '🐋', name: 'Cetus', badge: 'AMM',
    color: '#7CB87C',
    desc: 'Provide concentrated liquidity to Cetus CLMM pools. Earn swap fees. IL monitored by the agent.',
    risk: 'Medium-High', docs: 'https://docs.cetus.zone',
  },
];

const STEPS = [
  { emoji: '🔑', title: 'Connect or Sign In', desc: 'Use your Sui wallet or Google via zkLogin. No seed phrase needed.' },
  { emoji: '💸', title: 'Deposit USDC', desc: 'Gas is sponsored. You pay nothing to get started.' },
  { emoji: '🤖', title: 'Agent Takes Over', desc: 'The AI monitors Scallop, DeepBook, and Cetus 24/7 and rebalances atomically.' },
];

const TICKER = ['🐚 Scallop · Lending', '📖 DeepBook · Order Book', '🐋 Cetus · AMM', '⚡ Atomic PTBs · Sui', '🌊 Walrus Memory · Verifiable AI', '🛡️ 9 On-Chain Guardrails', '🔑 zkLogin · No Wallet Needed'];

export default function LandingPage() {
  const [active, setActive] = useState(0);
  const [tfx, setTfx] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen animated-bg font-body overflow-x-hidden">
      <TfxOverlay trigger={tfx} />

      {/* Ticker */}
      <div className="overflow-hidden bg-amber-500/10 border-b border-amber-500/20 py-2">
        <motion.div
          className="flex gap-8 whitespace-nowrap text-xs font-semibold text-amber-700"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}>
          {[...TICKER, ...TICKER].map((t, i) => <span key={i} className="px-4">{t}</span>)}
        </motion.div>
      </div>

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl animate-float">💰</span>
          <span className="font-display text-2xl text-ink">AutoYield</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 font-semibold ml-1">testnet</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="https://testnet.suivision.xyz/object/0x029c9ecb485714213476e98cee993f5afc6b32be0b6d10001144163f90bb962e"
            target="_blank" rel="noopener noreferrer"
            className="text-xs text-ink/50 hover:text-amber-500 transition hidden sm:block">
            View Vault On-Chain →
          </a>
          <Link href="/dashboard" onClick={() => setTfx(t => t + 1)}
            className="px-5 py-2 rounded-xl font-display text-sm text-white"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
            Launch App
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="text-7xl mb-6 animate-float">💰</div>
          <h1 className="font-display text-5xl md:text-7xl text-ink leading-tight mb-4">
            Autonomous<br />
            <span className="text-amber-400">DeFi Yield</span><br />
            on Sui
          </h1>
          <p className="text-ink/70 text-lg md:text-xl max-w-2xl mx-auto mb-8">
            An AI agent manages your USDC across Scallop, DeepBook, and Cetus.
            Rebalances atomically with Sui PTBs. Every decision stored on Walrus.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/dashboard" onClick={() => setTfx(t => t + 1)}
              className="px-8 py-4 rounded-2xl font-display text-xl text-white animate-pulse-glow"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
              Open Dashboard
            </Link>
            <a href="https://github.com/Tasfia-17/AutoYield" target="_blank" rel="noopener noreferrer"
              className="px-8 py-4 rounded-2xl font-display text-xl glass text-ink hover:opacity-80 transition">
              View Code →
            </a>
          </div>
        </motion.div>

        {/* Live contract badge */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          className="mt-10 inline-flex items-center gap-2 px-4 py-2 rounded-full glass-amber text-xs font-semibold text-amber-700">
          <span className="w-2 h-2 rounded-full bg-matcha animate-pulse" />
          Live on Sui Testnet ·
          <a href="https://testnet.suivision.xyz/object/0x029c9ecb485714213476e98cee993f5afc6b32be0b6d10001144163f90bb962e"
            target="_blank" rel="noopener noreferrer" className="underline">
            0x029c...962e
          </a>
        </motion.div>
      </section>

      {/* Protocol Explorer */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="font-display text-3xl text-ink text-center mb-8">Protocol Explorer</h2>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {PROTOCOLS.map((p, i) => (
            <motion.button key={p.id} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => setActive(i)}
              className="rounded-2xl p-4 text-center transition-all"
              style={{
                background: active === i ? `${p.color}22` : 'rgba(255,255,255,0.05)',
                border: `2px solid ${active === i ? p.color : 'transparent'}`,
              }}>
              <div className="text-3xl mb-1">{p.emoji}</div>
              <div className="font-display text-sm text-ink">{p.name}</div>
              <div className="text-xs mt-0.5" style={{ color: p.color }}>{p.badge}</div>
            </motion.button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="glass rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <span className="text-4xl">{PROTOCOLS[active].emoji}</span>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-display text-2xl text-ink">{PROTOCOLS[active].name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full text-white font-semibold"
                    style={{ background: PROTOCOLS[active].color }}>{PROTOCOLS[active].badge}</span>
                  <span className="text-xs text-ink/50">Risk: {PROTOCOLS[active].risk}</span>
                </div>
                <p className="text-ink/70 text-sm mb-3">{PROTOCOLS[active].desc}</p>
                <a href={PROTOCOLS[active].docs} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-semibold hover:underline" style={{ color: PROTOCOLS[active].color }}>
                  Read docs →
                </a>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="font-display text-3xl text-ink text-center mb-8">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="glass rounded-2xl p-6 text-center">
              <div className="text-4xl mb-3">{s.emoji}</div>
              <div className="font-display text-lg text-ink mb-2">{s.title}</div>
              <p className="text-sm text-ink/60">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Agent loop */}
      <section className="max-w-3xl mx-auto px-6 py-12">
        <h2 className="font-display text-3xl text-ink text-center mb-8">The Agent Loop</h2>
        <div className="glass rounded-2xl p-6">
          <div className="flex flex-wrap justify-center gap-2 text-sm font-semibold">
            {['SENSE', 'RECALL', 'REASON', 'GUARDRAILS', 'SIMULATE', 'EXECUTE', 'REMEMBER'].map((step, i, arr) => (
              <span key={step} className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-lg ${i === Math.floor(tick % arr.length) ? 'bg-amber-500 text-white' : 'glass text-ink/70'} transition-all duration-500`}>
                  {step}
                </span>
                {i < arr.length - 1 && <span className="text-ink/30">→</span>}
              </span>
            ))}
          </div>
          <div className="mt-4 text-center text-xs text-ink/50">
            Runs every 30 seconds · 9 guardrail checks · Atomic PTB execution · Walrus memory
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-10 text-xs text-ink/30 border-t border-amber-500/10">
        <p>AutoYield · Sui Overflow 2026 · Agentic Web + Walrus + DeepBook</p>
        <p className="mt-1">
          <a href="https://github.com/Tasfia-17/AutoYield" target="_blank" rel="noopener noreferrer"
            className="hover:text-amber-500 transition">GitHub</a>
          {' · '}
          <a href="https://testnet.suivision.xyz/object/0x029c9ecb485714213476e98cee993f5afc6b32be0b6d10001144163f90bb962e"
            target="_blank" rel="noopener noreferrer" className="hover:text-amber-500 transition">
            Vault Contract
          </a>
        </p>
      </footer>
    </div>
  );
}
