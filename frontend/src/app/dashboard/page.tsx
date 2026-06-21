'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { AgentChat } from '@/components/chat/AgentChat';
import { TfxOverlay } from '@/components/ui/TfxOverlay';
import { useVaultStore } from '@/lib/store';
import { fetchVaultState, fetchRebalanceHistory, fetchSnapshots } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

// ── Mock data for demo ────────────────────────────────────────────────────────
const MOCK_TVL_HISTORY = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  value: 2_380_000 + Math.sin(i * 0.4) * 40_000 + i * 1_200,
}));

const MOCK_APY_HISTORY = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  scallop: 8.2 + Math.sin(i * 0.3) * 0.4,
  deepbook: 11.4 + Math.cos(i * 0.4) * 0.8,
  cetus: 14.7 + Math.sin(i * 0.5) * 1.2,
}));

const MOCK_HISTORY = [
  { id: 1, executed_at: '2026-06-21T11:30:00Z', scallop_bps_after: 4500, deepbook_bps_after: 3500, cetus_bps_after: 2000, confidence_score: 0.87, reasoning: 'DeepBook maker rebates surged on high SUI volatility - shifted 5% from Scallop.', gas_cost_mist: 8_200_000 },
  { id: 2, executed_at: '2026-06-21T08:15:00Z', scallop_bps_after: 5000, deepbook_bps_after: 3000, cetus_bps_after: 2000, confidence_score: 0.82, reasoning: 'Scallop utilization rose to 78% - supply APY improving. Increased allocation.', gas_cost_mist: 7_400_000 },
  { id: 3, executed_at: '2026-06-21T05:00:00Z', scallop_bps_after: 5500, deepbook_bps_after: 2500, cetus_bps_after: 2000, confidence_score: 0.79, reasoning: 'Cetus IL risk elevated after SUI -8% move. Reduced Cetus, moved to Scallop.', gas_cost_mist: 9_100_000 },
];

const PROTOCOL_COLORS = { scallop: '#F59E0B', deepbook: '#F4A261', cetus: '#7CB87C' };

function fmt$(n: number) { return `$${(n / 1e6).toFixed(2)}M`; }
function fmtPct(n: number) { return `${n.toFixed(1)}%`; }
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m ago` : `${m}m ago`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ emoji, label, value, sub, gain }: {
  emoji: string; label: string; value: string; sub?: string; gain?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { duration: 0.15 } }}
      className="glass rounded-2xl p-5"
    >
      <div className="text-2xl mb-1">{emoji}</div>
      <div className={`font-display text-3xl ${gain ? 'gain apy-glow' : 'text-ink'}`}>{value}</div>
      <div className="text-sm font-semibold text-ink/70 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-ink/40 mt-0.5">{sub}</div>}
    </motion.div>
  );
}

function AllocationPie({ scallop, deepbook, cetus }: { scallop: number; deepbook: number; cetus: number }) {
  const data = [
    { name: 'Scallop', value: scallop, color: '#F59E0B' },
    { name: 'DeepBook', value: deepbook, color: '#F4A261' },
    { name: 'Cetus', value: cetus, color: '#7CB87C' },
  ];
  return (
    <div className="flex items-center gap-6">
      <PieChart width={120} height={120}>
        <Pie data={data} cx={55} cy={55} innerRadius={35} outerRadius={55} dataKey="value" strokeWidth={0}>
          {data.map((d) => <Cell key={d.name} fill={d.color} />)}
        </Pie>
      </PieChart>
      <div className="flex flex-col gap-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
            <span className="text-sm text-ink/70">{d.name}</span>
            <span className="font-display text-sm text-ink ml-auto">{(d.value / 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Deposit modal ────────────────────────────────────────────────────────────

function DepositModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState('500');
  const [step, setStep] = useState<'form' | 'signing' | 'done'>('form');

  const handleDeposit = async () => {
    setStep('signing');
    await new Promise(r => setTimeout(r, 2000));
    setStep('done');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, y: 30 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="glass rounded-3xl p-8 w-full max-w-md"
      >
        {step === 'form' && (
          <>
            <h2 className="font-display text-3xl text-ink mb-6 text-center">💸 Deposit USDC</h2>
            <div className="mb-5">
              <label className="text-sm font-semibold text-ink/70 mb-2 block">Amount - ${amount} USDC</label>
              <input
                type="range" min="100" max="10000" step="100" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-xs text-ink/40 mt-1"><span>$100</span><span>$10,000</span></div>
            </div>
            <div className="glass-amber rounded-2xl p-4 mb-5 text-sm text-amber-700">
              <div className="font-semibold mb-1">✅ Gasless Transaction</div>
              <div className="text-xs text-amber-600">AutoYield pays all gas fees. You pay $0.</div>
            </div>
            <button
              onClick={handleDeposit}
              className="w-full py-4 rounded-2xl font-display text-xl text-white animate-pulse-glow"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
            >
              Confirm Deposit
            </button>
            <button onClick={onClose} className="w-full py-3 mt-2 text-sm text-ink/50 hover:text-ink transition">Cancel</button>
          </>
        )}
        {step === 'signing' && (
          <div className="text-center py-8">
            <div className="text-5xl mb-4 animate-spin-slow">⚡</div>
            <h2 className="font-display text-2xl text-ink mb-2">Building PTB...</h2>
            <p className="text-ink/60 text-sm">Constructing atomic transaction block</p>
          </div>
        )}
        {step === 'done' && (
          <div className="text-center py-8">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}
              className="text-6xl mb-4">✅</motion.div>
            <h2 className="font-display text-2xl text-ink mb-2">Deposited ${amount}!</h2>
            <p className="text-ink/60 text-sm mb-6">AI agent is now managing your funds.</p>
            <button onClick={onClose} className="px-8 py-3 rounded-2xl font-display text-white"
              style={{ background: '#F59E0B' }}>Close</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const { riskTier, suiAddress } = useVaultStore();
  const [tfxTrigger, setTfxTrigger] = useState(0);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'agent'>('overview');

  // Live vault data - falls back to mock for demo
  const { data: vaultData } = useQuery({
    queryKey: ['vault'],
    queryFn: fetchVaultState,
    refetchInterval: 30_000,
    retry: false,
  });

  const vault = vaultData ?? {
    totalAssets: 2_400_000_000_000n,
    allocations: { scallopBps: 5000, deepbookBps: 3000, cetusBps: 2000 },
    blendedApy: 11.8,
    paused: false,
    lastRebalanceMs: Date.now() - 12 * 60 * 1000,
  };

  const allocations = vault.allocations ?? { scallopBps: 5000, deepbookBps: 3000, cetusBps: 2000 };
  const blendedApy = vault.blendedApy ?? 11.8;
  const totalUsd = Number(vault.totalAssets ?? 2_400_000_000_000n) / 1e6;

  const userShares = 1000; // mock
  const userValueUsd = 1_053.40; // mock
  const userPnl = +53.40;

  return (
    <div className="min-h-screen vault-bg font-body">
      <TfxOverlay trigger={tfxTrigger} />

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 glass-dark border-b border-amber-500/20">
        <button onClick={() => { setTfxTrigger(t => t + 1); setTimeout(() => router.push('/'), 300); }}
          className="flex items-center gap-2 hover:opacity-80 transition">
          <span className="text-xl animate-float">💰</span>
          <span className="font-display text-xl text-cream">AutoYield</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Agent status pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-amber text-xs font-semibold text-amber-600">
            <span className="w-1.5 h-1.5 rounded-full bg-matcha animate-pulse" />
            Agent Active
          </div>
          <div className="px-3 py-1.5 rounded-full glass text-xs font-semibold text-ink/70">
            {suiAddress ? `${suiAddress.slice(0, 6)}...${suiAddress.slice(-4)}` : '0x1234...abcd'}
          </div>
          <button
            onClick={() => setShowDeposit(true)}
            className="px-4 py-2 rounded-xl font-display text-sm text-white"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
          >
            + Deposit
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard emoji="🏦" label="Vault TVL" value={fmt$(totalUsd * 1e6)} />
          <StatCard emoji="📈" label="Blended APY" value={fmtPct(blendedApy)} gain />
          <StatCard emoji="💰" label="Your Value" value={`$${userValueUsd.toFixed(2)}`} sub="1,000 shares" />
          <StatCard emoji="✅" label="Your P&L" value={`+$${userPnl.toFixed(2)}`} gain sub="+5.34%" />
        </div>

        {/* ── Tab nav ── */}
        <div className="flex gap-2 mb-6">
          {(['overview', 'history', 'agent'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm capitalize transition-all"
              style={activeTab === tab
                ? { background: '#F59E0B', color: 'white', boxShadow: '0 0 20px rgba(245,158,11,0.35)' }
                : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }
              }
            >
              {tab === 'overview' ? '📊 Overview' : tab === 'history' ? '📋 History' : '🤖 Agent'}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* APY chart */}
                <div className="lg:col-span-2 glass rounded-2xl p-6">
                  <h3 className="font-display text-xl text-ink mb-4">Protocol APY - 24h</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={MOCK_APY_HISTORY}>
                      <defs>
                        {Object.entries(PROTOCOL_COLORS).map(([k, c]) => (
                          <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={c} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={c} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#1A1A2E80' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#1A1A2E80' }} tickLine={false} axisLine={false}
                        tickFormatter={(v) => `${v}%`} domain={['auto', 'auto']} />
                      <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`]} contentStyle={{ background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: 12 }} />
                      <Area type="monotone" dataKey="scallop" stroke="#F59E0B" fill="url(#grad-scallop)" strokeWidth={2} dot={false} name="Scallop" />
                      <Area type="monotone" dataKey="deepbook" stroke="#F4A261" fill="url(#grad-deepbook)" strokeWidth={2} dot={false} name="DeepBook" />
                      <Area type="monotone" dataKey="cetus" stroke="#7CB87C" fill="url(#grad-cetus)" strokeWidth={2} dot={false} name="Cetus" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Allocation + status */}
                <div className="flex flex-col gap-4">
                  <div className="glass rounded-2xl p-5">
                    <h3 className="font-display text-lg text-ink mb-4">Current Allocation</h3>
                    <AllocationPie
                      scallop={allocations.scallopBps}
                      deepbook={allocations.deepbookBps}
                      cetus={allocations.cetusBps}
                    />
                  </div>

                  <div className="glass rounded-2xl p-5">
                    <h3 className="font-display text-lg text-ink mb-3">Agent Status</h3>
                    <div className="space-y-2 text-sm">
                      {[
                        { label: 'Status', value: vault.paused ? '⏸ Paused' : '✅ Active', gain: !vault.paused },
                        { label: 'Risk Tier', value: `${riskTier === 'conservative' ? '🐢' : riskTier === 'moderate' ? '🦊' : '🦅'} ${riskTier}` },
                        { label: 'Last Rebalance', value: timeAgo(new Date(vault.lastRebalanceMs ?? Date.now() - 720_000).toISOString()) },
                        { label: 'AI Confidence', value: '87%', gain: true },
                        { label: 'Daily Rebalances', value: '4 / 24' },
                      ].map((row) => (
                        <div key={row.label} className="flex justify-between">
                          <span className="text-ink/50">{row.label}</span>
                          <span className={`font-semibold ${row.gain ? 'gain' : 'text-ink'}`}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* TVL chart */}
              <div className="glass rounded-2xl p-6 mt-6">
                <h3 className="font-display text-xl text-ink mb-4">Vault TVL - 24h</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={MOCK_TVL_HISTORY}>
                    <defs>
                      <linearGradient id="tvl-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#1A1A2E80' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#1A1A2E80' }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} domain={['auto', 'auto']} />
                    <Tooltip formatter={(v: number) => [`$${(v / 1e6).toFixed(3)}M`]} contentStyle={{ background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: 12 }} />
                    <Area type="monotone" dataKey="value" stroke="#F59E0B" fill="url(#tvl-grad)" strokeWidth={2.5} dot={false} name="TVL" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Latest rebalance */}
              {MOCK_HISTORY[0] && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="glass-amber rounded-2xl p-5 mt-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-2xl animate-breathe">🤖</div>
                    <div>
                      <div className="text-xs text-amber-600 font-semibold mb-0.5">
                        Latest AI Decision - {timeAgo(MOCK_HISTORY[0].executed_at)} · Confidence {(MOCK_HISTORY[0].confidence_score * 100).toFixed(0)}%
                      </div>
                      <p className="text-sm text-ink/80">{MOCK_HISTORY[0].reasoning}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── HISTORY TAB ── */}
          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <div className="space-y-4">
                {MOCK_HISTORY.map((h, i) => (
                  <motion.div
                    key={h.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="glass rounded-2xl p-5"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="font-display text-lg text-ink">Rebalance #{h.id}</div>
                        <div className="text-xs text-ink/40">{timeAgo(h.executed_at)}</div>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full glass-amber text-xs font-semibold text-amber-600">
                        ✅ Executed
                      </div>
                    </div>
                    <p className="text-sm text-ink/70 mb-3">{h.reasoning}</p>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { label: '🐚 Scallop', bps: h.scallop_bps_after },
                        { label: '📖 DeepBook', bps: h.deepbook_bps_after },
                        { label: '🐋 Cetus', bps: h.cetus_bps_after },
                      ].map((p) => (
                        <div key={p.label} className="flex items-center gap-1.5 text-sm">
                          <span className="text-ink/60">{p.label}</span>
                          <span className="font-display text-ink">{(p.bps / 100).toFixed(0)}%</span>
                        </div>
                      ))}
                      <div className="ml-auto text-xs text-ink/40">
                        Gas: {(h.gas_cost_mist / 1e9).toFixed(4)} SUI
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── AGENT TAB ── */}
          {activeTab === 'agent' && (
            <motion.div key="agent" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <AgentChat />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* ── Deposit Modal ── */}
      <AnimatePresence>
        {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
      </AnimatePresence>

      {/* ── Floating chat button ── */}
      {activeTab !== 'agent' && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1, type: 'spring' }}
          onClick={() => setActiveTab('agent')}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg text-2xl flex items-center justify-center animate-pulse-glow z-30"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
          title="Ask the AI agent"
        >
          🤖
        </motion.button>
      )}
    </div>
  );
}
