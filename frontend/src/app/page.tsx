'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { TfxOverlay } from '@/components/ui/TfxOverlay';
import { useVaultStore } from '@/lib/store';

const PROTOCOLS = [
  {
    id: 'scallop', emoji: '🐚', name: 'Scallop', badge: 'Lending',
    apy: '8.2', color: '#F59E0B',
    desc: 'Supply USDC to Scallop lending pools for steady, low-risk supply yield.',
    tvl: '$102M', risk: 'Low',
    bars: [40, 48, 45, 58, 55, 65, 60, 72, 68, 78, 74, 82, 80, 88],
  },
  {
    id: 'deepbook', emoji: '📖', name: 'DeepBook', badge: 'Order Book',
    apy: '11.4', color: '#F4A261',
    desc: 'Place maker limit orders on Sui native CLOB to earn trading fee rebates.',
    tvl: '$38M', risk: 'Medium',
    bars: [55, 62, 58, 70, 65, 75, 72, 80, 76, 85, 82, 90, 87, 95],
  },
  {
    id: 'cetus', emoji: '🐋', name: 'Cetus', badge: 'AMM',
    apy: '14.7', color: '#7CB87C',
    desc: 'Provide concentrated liquidity in Cetus CLMM pools for swap fee income.',
    tvl: '$85M', risk: 'Medium',
    bars: [38, 50, 44, 62, 56, 70, 64, 76, 72, 84, 80, 90, 86, 94],
  },
];

const STATS = [
  { label: 'Total Value Locked', value: '$2.4M', icon: '🏦' },
  { label: 'Blended APY', value: '11.8%', icon: '📈' },
  { label: 'Rebalances Today', value: '4', icon: '⚡' },
  { label: 'Users Protected', value: '847', icon: '🛡️' },
];

const STEPS = [
  { n: '01', emoji: '🪪', title: 'Sign in with Google', desc: 'zkLogin creates your Sui address from your Google account. No wallet. No seed phrase. Just click.' },
  { n: '02', emoji: '💸', title: 'Deposit USDC', desc: 'Fund your vault. AutoYield sponsors all gas - you pay $0 in transaction fees, ever.' },
  { n: '03', emoji: '🤖', title: 'AI Takes Over', desc: 'The agent rebalances across Scallop, DeepBook and Cetus every 30 minutes, maximising yield.' },
];

const FEATURES = [
  { icon: '🤖', title: 'AI-Driven Decisions', desc: 'GPT-4o analyses yield, risk, and market conditions every 30 seconds and explains every move.' },
  { icon: '🔒', title: 'Deterministic Guardrails', desc: '9 rule-based safety checks override every AI decision. Your principal is always protected.' },
  { icon: '⚡', title: 'Atomic PTBs', desc: 'Multi-protocol rebalances happen in a single Sui transaction. Impossible on any other chain.' },
  { icon: '🧠', title: 'Verifiable Memory', desc: 'Every decision is stored on Walrus via MemWal. Fully auditable, cryptographically provable.' },
  { icon: '🪪', title: 'Google Sign-In', desc: 'zkLogin means no seed phrases and no wallet extensions. Any user can start in 30 seconds.' },
  { icon: '⛽', title: 'Zero Gas Fees', desc: 'AutoYield sponsors every transaction. You never see a gas prompt.' },
];

function SparkLine({ heights, color }: { heights: number[]; color: string }) {
  return (
    <div className="flex items-end gap-0.5 h-7">
      {heights.map((h, i) => (
        <div key={i} className="w-1.5 rounded-sm transition-all duration-300"
          style={{ height: `${h}%`, background: color, opacity: 0.5 + i * 0.04 }} />
      ))}
    </div>
  );
}

function Ticker() {
  const items = [
    '🐚 Scallop APY 8.2%', '📖 DeepBook APR 11.4%', '🐋 Cetus APR 14.7%',
    '⚡ Last rebalance 12 min ago', '🛡️ 0 guardrail violations', '🧠 AI confidence 87%',
    '📊 Blended APY 11.8%', '🔐 $2.4M TVL secured', '🌐 Sui Network 390ms finality',
  ];
  return (
    <div className="overflow-hidden bg-amber-500/10 border-y border-amber-500/20 py-2">
      <div className="flex whitespace-nowrap animate-ticker">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="mx-8 text-xs font-semibold text-amber-700 inline-flex items-center gap-1">{item}</span>
        ))}
      </div>
    </div>
  );
}

function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 28 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.34, 1.1, 0.64, 1] }} className={className}>
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const [active, setActive] = useState(PROTOCOLS[0]!);
  const [tfx, setTfx] = useState(0);
  const [risk, setRisk] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
  const [deposit, setDeposit] = useState(500);
  const [mounted, setMounted] = useState(false);
  const setRiskStore = useVaultStore((s) => s.setRiskTier);

  useEffect(() => { setMounted(true); }, []);

  const handleProtocol = (p: typeof PROTOCOLS[0]) => {
    if (p.id === active.id) return;
    setTfx(t => t + 1);
    setTimeout(() => setActive(p), 120);
  };

  const apyMap: Record<string, number> = { conservative: 9.1, moderate: 11.8, aggressive: 13.6 };
  const bpsMap = {
    conservative: [70, 20, 10],
    moderate: [50, 30, 20],
    aggressive: [30, 40, 30],
  };
  const protocols = [
    { label: 'Scallop', apy: 0.082, emoji: '🐚' },
    { label: 'DeepBook', apy: 0.114, emoji: '📖' },
    { label: 'Cetus', apy: 0.147, emoji: '🐋' },
  ];
  const yearlyEarnings = protocols.reduce((sum, p, i) => {
    return sum + deposit * ((bpsMap[risk][i] ?? 0) / 100) * p.apy;
  }, 0);

  return (
    <div className="min-h-screen animated-bg font-body overflow-x-hidden">
      <TfxOverlay trigger={tfx} />

      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-white/40">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2">
            <span className="text-2xl animate-float">💰</span>
            <span className="font-display text-xl text-ink">AutoYield</span>
            <span className="text-xs px-2 py-0.5 rounded-full glass-amber text-amber-700 font-bold">BETA</span>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3">
            <a href="https://github.com/Tasfia-17/AutoYield" target="_blank" rel="noopener noreferrer"
              className="hidden md:block text-sm text-ink/50 hover:text-amber-600 transition font-semibold">
              GitHub
            </a>
            <Link href="/dashboard"
              onClick={() => setTfx(t => t + 1)}
              className="px-5 py-2 rounded-full font-display text-sm text-white animate-pulse-glow transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)' }}>
              Launch App
            </Link>
          </motion.div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-28 pb-6 px-6 text-center overflow-hidden">
        <div className="absolute top-20 left-1/4 w-72 h-72 rounded-full blur-3xl opacity-20 animate-float-slow pointer-events-none"
          style={{ background: 'radial-gradient(#F59E0B,transparent)' }} />
        <div className="absolute top-36 right-1/4 w-56 h-56 rounded-full blur-3xl opacity-15 animate-float pointer-events-none"
          style={{ background: 'radial-gradient(#7CB87C,transparent)' }} />

        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
          className="relative z-10 max-w-3xl mx-auto">
          <div className="text-6xl mb-4 animate-breathe select-none">💰</div>
          <h1 className="font-display text-5xl md:text-7xl text-ink mb-3 leading-tight tracking-tight">
            AutoYield
          </h1>
          <p className="font-display text-xl md:text-2xl text-amber-600 mb-3 tracking-wide">
            AUTONOMOUS DEFI TREASURY MANAGER
          </p>
          <p className="text-ink/60 max-w-xl mx-auto text-base md:text-lg mb-8 leading-relaxed">
            Deposit once. An AI agent rebalances your portfolio across Scallop,
            DeepBook and Cetus around the clock, gasless, with verifiable memory on Walrus.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {STATS.map((s, i) => (
              <motion.div key={s.label}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i + 0.35 }}
                className="glass rounded-2xl px-5 py-3 flex items-center gap-3">
                <span className="text-xl">{s.icon}</span>
                <div className="text-left">
                  <div className="font-display text-lg text-ink leading-none">{s.value}</div>
                  <div className="text-xs text-ink/50 mt-0.5">{s.label}</div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/dashboard"
              onClick={() => { setRiskStore(risk); setTfx(t => t + 1); }}
              className="px-10 py-4 rounded-2xl font-display text-xl text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 animate-pulse-glow"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)' }}>
              Launch App
            </Link>
            <a href="#how"
              className="px-10 py-4 rounded-2xl font-display text-xl text-amber-700 glass hover:glass-amber transition-all">
              How it works
            </a>
          </div>
        </motion.div>
      </section>

      <Ticker />

      {/* Protocol explorer */}
      <section className="py-16 px-4 max-w-6xl mx-auto">
        <FadeUp className="text-center mb-10">
          <h2 className="font-display text-4xl text-ink mb-2">Three Protocols. One Vault.</h2>
          <p className="text-ink/60">The AI allocates capital across all three simultaneously.</p>
        </FadeUp>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {PROTOCOLS.map((p, i) => (
            <FadeUp key={p.id} delay={i * 0.1}>
              <div
                onClick={() => handleProtocol(p)}
                className={`protocol-card glass rounded-3xl p-6 cursor-pointer relative ${active.id === p.id ? 'active' : ''}`}>
                <div className="text-center mb-1">
                  <span className="text-5xl" style={{
                    display: 'inline-block',
                    filter: active.id === p.id ? `drop-shadow(0 0 14px ${p.color})` : 'none',
                    transition: 'filter 0.3s',
                  }}>{p.emoji}</span>
                  <div className="text-3xl opacity-10 mt-0.5" style={{ transform: 'scaleY(-0.35)', filter: 'blur(2px)' }}>
                    {p.emoji}
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: p.color }}>
                    {p.badge}
                  </span>
                  <h3 className="font-display text-2xl text-ink mt-2 mb-1">{p.name}</h3>
                  <p className="text-ink/55 text-sm mb-3">{p.desc}</p>
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <div className="font-display text-2xl gain apy-glow">{p.apy}%</div>
                      <div className="text-xs text-ink/40">APY</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-ink/70 text-sm">{p.tvl}</div>
                      <div className="text-xs text-ink/40">TVL</div>
                    </div>
                  </div>
                  <SparkLine heights={p.bars} color={p.color} />
                </div>
                {active.id === p.id && (
                  <motion.div layoutId="proto-ring"
                    className="absolute inset-0 rounded-3xl pointer-events-none"
                    style={{ border: `2px solid ${p.color}`, boxShadow: `0 0 28px ${p.color}44` }} />
                )}
              </div>
            </FadeUp>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={active.id}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="glass rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6">
            <span className="text-6xl animate-breathe select-none">{active.emoji}</span>
            <div className="flex-1">
              <h3 className="font-display text-3xl text-ink mb-1">{active.name} <span className="text-ink/40 text-xl">{active.badge}</span></h3>
              <p className="text-ink/60 mb-3">{active.desc}</p>
              <div className="flex flex-wrap gap-2">
                {['Audited', 'Mainnet Live', 'Sui Native', 'Composable'].map(tag => (
                  <span key={tag} className="text-xs px-3 py-1 rounded-full glass-amber text-amber-700 font-semibold">{tag}</span>
                ))}
              </div>
            </div>
            <div className="text-center shrink-0">
              <div className="font-display text-5xl gain apy-glow">{active.apy}%</div>
              <div className="text-sm text-ink/50 mt-1">Current APY</div>
              <div className="text-xs text-ink/40 mt-0.5">Risk: {active.risk}</div>
            </div>
          </motion.div>
        </AnimatePresence>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 max-w-5xl mx-auto" id="how">
        <FadeUp className="text-center mb-12">
          <h2 className="font-display text-4xl text-ink">How AutoYield Works</h2>
        </FadeUp>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((s, i) => (
            <FadeUp key={s.n} delay={i * 0.12}>
              <div className="glass rounded-3xl p-8 text-center h-full">
                <div className="font-display text-5xl text-amber-200 mb-3 select-none">{s.n}</div>
                <div className="text-4xl mb-3 animate-float select-none" style={{ animationDelay: `${i * 0.9}s` }}>{s.emoji}</div>
                <h3 className="font-display text-xl text-ink mb-2">{s.title}</h3>
                <p className="text-ink/60 text-sm leading-relaxed">{s.desc}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 max-w-5xl mx-auto">
        <FadeUp className="text-center mb-12">
          <h2 className="font-display text-4xl text-ink">Built Different</h2>
        </FadeUp>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <FadeUp key={f.title} delay={i * 0.06}>
              <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.18 }}
                className="glass rounded-2xl p-6 h-full">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-display text-lg text-ink mb-1">{f.title}</h3>
                <p className="text-ink/60 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* Vault Simulator */}
      <section className="py-16 px-4 max-w-2xl mx-auto">
        <FadeUp>
          <div className="glass rounded-3xl p-8">
            <h2 className="font-display text-3xl text-ink text-center mb-6">
              💰 Vault Simulator
            </h2>

            <div className="mb-5">
              <div className="flex justify-between text-sm font-semibold text-ink/70 mb-2">
                <span>Deposit Amount</span>
                <span className="text-amber-600 font-display">${deposit.toLocaleString()} USDC</span>
              </div>
              <input type="range" min={100} max={10000} step={100} value={deposit}
                onChange={e => setDeposit(Number(e.target.value))}
                className="w-full accent-amber-500" />
              <div className="flex justify-between text-xs text-ink/40 mt-1">
                <span>$100</span><span>$10,000</span>
              </div>
            </div>

            <div className="mb-5">
              <div className="text-sm font-semibold text-ink/70 mb-2">Risk Profile</div>
              <div className="grid grid-cols-3 gap-2">
                {(['conservative', 'moderate', 'aggressive'] as const).map(t => (
                  <button key={t} onClick={() => setRisk(t)}
                    className="py-2.5 rounded-xl text-sm font-semibold capitalize transition-all"
                    style={risk === t
                      ? { background: '#F59E0B', color: '#fff', boxShadow: '0 0 20px rgba(245,158,11,0.4)' }
                      : { background: 'rgba(255,255,255,0.6)', color: 'var(--ink)', border: '1.5px solid rgba(0,0,0,0.08)' }
                    }>
                    {t === 'conservative' ? '🐢' : t === 'moderate' ? '🦊' : '🦅'} {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-amber rounded-2xl p-5 mb-6">
              <div className="flex justify-between text-sm font-semibold text-ink/70 mb-4">
                <span>Projected Annual Earnings</span>
                <span className="text-amber-600 text-xs">at current APY</span>
              </div>
              {protocols.map((p, i) => {
                const earning = deposit * ((bpsMap[risk][i] ?? 0) / 100) * p.apy;
                return (
                  <div key={p.label} className="flex items-center gap-2 mb-2 text-sm">
                    <span>{p.emoji}</span>
                    <span className="flex-1 text-ink/70">{p.label}</span>
                    <span className="text-ink/40 text-xs">{bpsMap[risk][i]}%</span>
                    <span className="font-display gain">+${earning.toFixed(2)}</span>
                  </div>
                );
              })}
              <div className="border-t border-amber-500/20 pt-3 mt-3 flex justify-between items-center">
                <span className="font-display text-ink">Total / Year</span>
                {mounted && (
                  <motion.span key={`${deposit}-${risk}`}
                    initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="font-display text-2xl gain apy-glow">
                    +${yearlyEarnings.toFixed(2)}
                  </motion.span>
                )}
              </div>
            </div>

            <Link href="/dashboard"
              onClick={() => { setRiskStore(risk); setTfx(t => t + 1); }}
              className="block w-full py-4 rounded-2xl font-display text-xl text-white text-center transition-all hover:scale-[1.02] animate-pulse-glow"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)' }}>
              {active.emoji} Start Earning Now
            </Link>
            <p className="text-center text-xs text-ink/40 mt-3">
              Sign in with Google · No wallet needed · Zero gas fees
            </p>
          </div>
        </FadeUp>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 text-center border-t border-amber-500/20">
        <div className="text-2xl mb-2 animate-float select-none">💰</div>
        <div className="font-display text-lg text-ink mb-1">AutoYield</div>
        <p className="text-xs text-ink/40 mb-3">Built for Sui Overflow 2026 · Powered by Scallop, DeepBook, Cetus, MemWal</p>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink/40">
          <span>Agentic Web Track</span>
          <span>Walrus Track</span>
          <span>DeepBook Track</span>
        </div>
      </footer>
    </div>
  );
}
