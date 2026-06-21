'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { TfxOverlay } from '@/components/ui/TfxOverlay';
import { useVaultStore } from '@/lib/store';

const PROTOCOLS = [
  {
    id: 'scallop',
    emoji: '🐚',
    name: 'Scallop',
    subtitle: 'Lending',
    apy: '8.2%',
    color: '#F59E0B',
    desc: 'Supply USDC to Scallop lending pools for steady, low-risk yield.',
    badge: 'Lending',
    tvl: '$102M',
  },
  {
    id: 'deepbook',
    emoji: '📖',
    name: 'DeepBook',
    subtitle: 'Order Book',
    apy: '11.4%',
    color: '#F4A261',
    desc: 'Place maker orders on Sui\'s native CLOB to earn trading fee rebates.',
    badge: 'Trading',
    tvl: '$38M',
  },
  {
    id: 'cetus',
    emoji: '🐋',
    name: 'Cetus',
    subtitle: 'AMM',
    apy: '14.7%',
    color: '#7CB87C',
    desc: 'Provide concentrated liquidity in Cetus CLMM pools for swap fees.',
    badge: 'AMM',
    tvl: '$85M',
  },
];

const STATS = [
  { label: 'Total Value Locked', value: '$2.4M', icon: '🏦' },
  { label: 'Blended APY', value: '11.8%', icon: '📈' },
  { label: 'Rebalances / Day', value: '4.2', icon: '⚡' },
  { label: 'Users Protected', value: '847', icon: '🛡️' },
];

const FEATURES = [
  { icon: '🤖', title: 'AI-Driven', desc: 'GPT-4o analyses yield, risk, and market conditions every 30 seconds.' },
  { icon: '🔒', title: 'Rule-Based Guardrails', desc: '9 deterministic safety checks override every AI decision. Your funds stay safe.' },
  { icon: '⚡', title: 'Atomic PTBs', desc: 'Multi-protocol rebalances in a single Sui transaction. Impossible on EVM.' },
  { icon: '🧠', title: 'MemWal Memory', desc: 'The agent remembers every decision on Walrus. Fully auditable and verifiable.' },
  { icon: '🪪', title: 'Sign in with Google', desc: 'zkLogin — no seed phrases, no wallet extension. Just your Google account.' },
  { icon: '⛽', title: 'Gasless', desc: 'AutoYield sponsors all your transactions. You never pay gas fees.' },
];

// Spark bar mini chart
function SparkLine({ heights, color }: { heights: number[]; color: string }) {
  return (
    <div className="flex items-end gap-0.5 h-8">
      {heights.map((h, i) => (
        <div
          key={i}
          className="spark-bar w-1.5 rounded-sm"
          style={{ height: `${h}%`, background: color, opacity: 0.7 + i * 0.03 }}
        />
      ))}
    </div>
  );
}

// Live ticker tape
function Ticker() {
  const items = [
    '🐚 Scallop APY 8.2%', '📖 DeepBook APR 11.4%', '🐋 Cetus APR 14.7%',
    '⚡ Last rebalance: 12 min ago', '🛡️ 0 guardrail violations', '🧠 AI confidence: 87%',
    '📊 Blended APY 11.8%', '🔐 $2.4M TVL secured', '🌐 Sui Network — 390ms finality',
  ];
  const doubled = [...items, ...items];
  return (
    <div className="ticker-wrap bg-amber-500/10 border-y border-amber-500/20 py-2 text-xs font-semibold text-amber-700">
      <div className="ticker-content">
        {doubled.map((item, i) => (
          <span key={i} className="mx-6 flex items-center gap-1">{item}</span>
        ))}
      </div>
    </div>
  );
}

export default function Landing() {
  const router = useRouter();
  const [activeProtocol, setActiveProtocol] = useState(PROTOCOLS[0]);
  const [tfxTrigger, setTfxTrigger] = useState(0);
  const [riskTier, setRiskTier] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
  const [depositAmount, setDepositAmount] = useState('500');
  const setStore = useVaultStore((s) => s.setRiskTier);

  const selectProtocol = (p: typeof PROTOCOLS[0]) => {
    if (p.id === activeProtocol.id) return;
    setTfxTrigger((t) => t + 1);
    setTimeout(() => setActiveProtocol(p), 120);
  };

  const handleLaunch = () => {
    setStore(riskTier);
    setTfxTrigger((t) => t + 1);
    setTimeout(() => router.push('/dashboard'), 300);
  };

  const sparkHeights = [40, 55, 48, 62, 58, 70, 65, 78, 72, 88, 82, 95, 90, 98];

  return (
    <div className="min-h-screen animated-bg font-body overflow-x-hidden">
      <TfxOverlay trigger={tfxTrigger} />

      {/* ── Navbar ── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 glass border-b border-white/40">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2"
        >
          <span className="text-2xl animate-float">💰</span>
          <span className="font-display text-xl text-ink">AutoYield</span>
          <span className="text-xs px-2 py-0.5 rounded-full glass-amber text-amber-700 font-semibold">BETA</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <a
            href="https://github.com/autoyield"
            className="text-xs text-ink/60 hover:text-amber-600 transition font-semibold hidden md:block"
          >GitHub</a>
          <button
            onClick={handleLaunch}
            className="px-5 py-2 rounded-full font-display text-sm text-white transition-all animate-pulse-glow"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
          >
            Launch App →
          </button>
        </motion.div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-8 px-6 text-center">
        {/* Floating orbs */}
        <div className="absolute top-24 left-1/4 w-64 h-64 rounded-full opacity-20 blur-3xl animate-float-slow"
          style={{ background: 'radial-gradient(circle, #F59E0B, transparent)' }} />
        <div className="absolute top-40 right-1/4 w-48 h-48 rounded-full opacity-15 blur-3xl animate-float"
          style={{ background: 'radial-gradient(circle, #7CB87C, transparent)' }} />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
          className="relative z-10"
        >
          <div className="text-6xl mb-4 animate-breathe">💰</div>
          <h1 className="font-display text-5xl md:text-7xl text-ink mb-3 leading-tight">
            AutoYield
          </h1>
          <p className="font-display text-xl md:text-2xl text-amber-600 mb-2">
            AUTONOMOUS DEFI TREASURY MANAGER
          </p>
          <p className="text-ink/60 max-w-xl mx-auto text-base md:text-lg mb-8 font-body">
            Deposit once. An AI agent rebalances your portfolio across Scallop,
            DeepBook &amp; Cetus — 24/7, gasless, with verifiable memory.
          </p>

          {/* Hero stats */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i + 0.3 }}
                className="glass rounded-2xl px-5 py-3 flex items-center gap-3"
              >
                <span className="text-xl">{s.icon}</span>
                <div className="text-left">
                  <div className="font-display text-lg text-ink leading-none">{s.value}</div>
                  <div className="text-xs text-ink/50">{s.label}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleLaunch}
              className="px-10 py-4 rounded-2xl font-display text-xl text-white shadow-lg hover:shadow-xl transition-all animate-pulse-glow"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
            >
              🚀 Launch App
            </button>
            <a
              href="#how"
              className="px-10 py-4 rounded-2xl font-display text-xl text-amber-700 glass hover:glass-amber transition-all"
            >
              How it works ↓
            </a>
          </div>
        </motion.div>
      </section>

      {/* ── Ticker tape ── */}
      <Ticker />

      {/* ── Protocol explorer (tabibito country picker pattern) ── */}
      <section className="py-16 px-6 max-w-6xl mx-auto" id="protocols">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="font-display text-4xl text-ink mb-2">Three Protocols. One Vault.</h2>
          <p className="text-ink/60">AI allocates your capital across all three, automatically.</p>
        </motion.div>

        {/* Protocol cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {PROTOCOLS.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`protocol-card glass rounded-3xl p-6 cursor-pointer ${activeProtocol.id === p.id ? 'active' : ''}`}
              onClick={() => selectProtocol(p)}
            >
              {/* Big emoji */}
              <div className="text-5xl mb-3 text-center" style={{
                filter: activeProtocol.id === p.id ? `drop-shadow(0 0 16px ${p.color})` : 'none',
                transition: 'filter 0.3s',
              }}>
                {p.emoji}
              </div>
              {/* Mirror reflection */}
              <div className="text-3xl text-center mb-3 opacity-20" style={{
                transform: 'scaleY(-0.4)', filter: 'blur(2px)',
              }}>
                {p.emoji}
              </div>
              <div className="text-center">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white mr-2"
                  style={{ background: p.color }}>{p.badge}</span>
                <h3 className="font-display text-2xl text-ink mt-2">{p.name}</h3>
                <p className="text-ink/60 text-sm mt-1 mb-3">{p.desc}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-2xl gain apy-glow">{p.apy}</div>
                    <div className="text-xs text-ink/40">Current APY</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-ink/70">{p.tvl}</div>
                    <div className="text-xs text-ink/40">TVL</div>
                  </div>
                </div>
                <div className="mt-3">
                  <SparkLine
                    heights={[40, 48, 45, 58, 55, 65, 60, 72, 68, 78, 74, 82, 80, 88]}
                    color={p.color}
                  />
                </div>
              </div>
              {activeProtocol.id === p.id && (
                <motion.div
                  layoutId="protocol-active"
                  className="absolute inset-0 rounded-3xl pointer-events-none"
                  style={{ border: `2px solid ${p.color}`, boxShadow: `0 0 30px ${p.color}40` }}
                />
              )}
            </motion.div>
          ))}
        </div>

        {/* Active protocol detail */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeProtocol.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="glass rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6"
          >
            <div className="text-6xl animate-breathe">{activeProtocol.emoji}</div>
            <div className="flex-1">
              <h3 className="font-display text-3xl text-ink mb-1">{activeProtocol.name} — {activeProtocol.subtitle}</h3>
              <p className="text-ink/60 mb-3">{activeProtocol.desc}</p>
              <div className="flex flex-wrap gap-2">
                {['Audited', 'Mainnet Live', 'Sui Native', 'Composable'].map((tag) => (
                  <span key={tag} className="text-xs px-3 py-1 rounded-full glass-amber text-amber-700 font-semibold">{tag}</span>
                ))}
              </div>
            </div>
            <div className="text-center">
              <div className="font-display text-5xl gain apy-glow">{activeProtocol.apy}</div>
              <div className="text-sm text-ink/50">Current APY</div>
            </div>
          </motion.div>
        </AnimatePresence>
      </section>

      {/* ── How it works ── */}
      <section className="py-16 px-6 max-w-5xl mx-auto" id="how">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-display text-4xl text-center text-ink mb-12"
        >
          How AutoYield Works
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: '01', emoji: '🪪', title: 'Sign in with Google', desc: 'zkLogin creates your Sui address from your Google account. No wallet. No seed phrase.' },
            { step: '02', emoji: '💸', title: 'Deposit USDC', desc: 'Fund your vault. AutoYield sponsors all gas — you pay $0 in transaction fees.' },
            { step: '03', emoji: '🤖', title: 'AI Takes Over', desc: 'The agent rebalances across Scallop, DeepBook & Cetus every 30 min, maximising your yield.' },
          ].map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              className="glass rounded-3xl p-8 text-center"
            >
              <div className="font-display text-5xl text-amber-200 mb-3">{s.step}</div>
              <div className="text-4xl mb-3 animate-float" style={{ animationDelay: `${i * 0.8}s` }}>{s.emoji}</div>
              <h3 className="font-display text-xl text-ink mb-2">{s.title}</h3>
              <p className="text-ink/60 text-sm">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features grid ── */}
      <section className="py-16 px-6 max-w-5xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-display text-4xl text-center text-ink mb-12"
        >
          Built Different
        </motion.h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, type: 'spring', stiffness: 200 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="glass rounded-2xl p-6"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-display text-lg text-ink mb-1">{f.title}</h3>
              <p className="text-ink/60 text-sm">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Risk tier selector + deposit preview ── */}
      <section className="py-16 px-6 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass rounded-3xl p-8"
        >
          <h2 className="font-display text-3xl text-ink text-center mb-6">
            💰 Try the Vault Simulator
          </h2>

          {/* Deposit amount */}
          <div className="mb-6">
            <label className="text-sm font-semibold text-ink/70 mb-2 block">
              Deposit Amount — ${depositAmount} USDC
            </label>
            <input
              type="range" min="100" max="10000" step="100"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-xs text-ink/40 mt-1">
              <span>$100</span><span>$10,000</span>
            </div>
          </div>

          {/* Risk tier */}
          <div className="mb-6">
            <label className="text-sm font-semibold text-ink/70 mb-2 block">Risk Profile</label>
            <div className="grid grid-cols-3 gap-2">
              {(['conservative', 'moderate', 'aggressive'] as const).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setRiskTier(tier)}
                  className="py-2.5 rounded-xl text-sm font-semibold capitalize transition-all"
                  style={riskTier === tier
                    ? { background: '#F59E0B', color: 'white', boxShadow: '0 0 20px rgba(245,158,11,0.4)' }
                    : { background: 'rgba(255,255,255,0.6)', color: 'var(--ink)', border: '1.5px solid rgba(0,0,0,0.08)' }
                  }
                >
                  {tier === 'conservative' ? '🐢' : tier === 'moderate' ? '🦊' : '🦅'} {tier}
                </button>
              ))}
            </div>
          </div>

          {/* Projected earnings */}
          <div className="glass-amber rounded-2xl p-5 mb-6">
            <div className="flex justify-between items-center mb-3">
              <span className="font-semibold text-ink/70 text-sm">Projected Annual Earnings</span>
              <span className="text-xs text-amber-600">at current APY</span>
            </div>
            {[
              { label: 'Scallop (8.2%)', bps: riskTier === 'conservative' ? 70 : riskTier === 'moderate' ? 50 : 30 },
              { label: 'DeepBook (11.4%)', bps: riskTier === 'conservative' ? 20 : riskTier === 'moderate' ? 30 : 40 },
              { label: 'Cetus (14.7%)', bps: riskTier === 'conservative' ? 10 : riskTier === 'moderate' ? 20 : 30 },
            ].map((row) => {
              const apyMap: Record<string, number> = { 'Scallop (8.2%)': 0.082, 'DeepBook (11.4%)': 0.114, 'Cetus (14.7%)': 0.147 };
              const earning = (Number(depositAmount) * (row.bps / 100) * (apyMap[row.label] ?? 0.1)).toFixed(2);
              return (
                <div key={row.label} className="flex items-center gap-2 mb-2">
                  <div className="flex-1 text-sm text-ink/70">{row.label}</div>
                  <div className="text-xs text-ink/40">{row.bps}%</div>
                  <div className="font-display text-base gain">+${earning}</div>
                </div>
              );
            })}
            <div className="border-t border-amber-500/20 pt-3 mt-3 flex justify-between">
              <span className="font-display text-ink">Total / Year</span>
              <span className="font-display text-2xl gain apy-glow">
                +${(() => {
                  const bpsMap = riskTier === 'conservative' ? [70, 20, 10] : riskTier === 'moderate' ? [50, 30, 20] : [30, 40, 30];
                  const apys = [0.082, 0.114, 0.147];
                  return (Number(depositAmount) * bpsMap.reduce((acc, b, i) => acc + (b / 100) * apys[i]!, 0)).toFixed(2);
                })()}
              </span>
            </div>
          </div>

          <button
            onClick={handleLaunch}
            className="w-full py-4 rounded-2xl font-display text-xl text-white transition-all animate-pulse-glow"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
          >
            {activeProtocol.emoji} Start Earning
          </button>
          <p className="text-center text-xs text-ink/40 mt-3">
            Sign in with Google · No wallet needed · Gasless
          </p>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 px-6 text-center border-t border-amber-500/20">
        <div className="text-2xl mb-2 animate-float">💰</div>
        <div className="font-display text-lg text-ink mb-1">AutoYield</div>
        <p className="text-xs text-ink/40">Built for Sui Overflow 2026 · Powered by Scallop, DeepBook, Cetus, MemWal</p>
        <div className="flex justify-center gap-4 mt-4 text-xs text-ink/50">
          <span>Agentic Web Track</span>
          <span>·</span>
          <span>Walrus Track</span>
          <span>·</span>
          <span>DeepBook Track</span>
        </div>
      </footer>
    </div>
  );
}
