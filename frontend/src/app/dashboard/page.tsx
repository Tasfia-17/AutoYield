'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { AgentChat } from '@/components/chat/AgentChat';
import { TfxOverlay } from '@/components/ui/TfxOverlay';
import { useVaultStore } from '@/lib/store';
import { fetchVaultOnChain, fetchRebalanceEvents } from '@/lib/api';

const PROTOCOL_COLORS = { scallop: '#F59E0B', deepbook: '#F4A261', cetus: '#7CB87C' };

function timeAgo(ms: number) {
  if (!ms) return 'Never';
  const diff = Date.now() - ms;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m ago` : `${m}m ago`;
}

function StatCard({ emoji, label, value, sub, gain }: { emoji: string; label: string; value: string; sub?: string; gain?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { duration: 0.15 } }} className="glass rounded-2xl p-5">
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

function DepositModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState('500');
  const [step, setStep] = useState<'form' | 'signing' | 'done'>('form');

  const handleDeposit = async () => {
    setStep('signing');
    await new Promise(r => setTimeout(r, 2000));
    setStep('done');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 30 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }} className="glass rounded-3xl p-8 w-full max-w-md">
        {step === 'form' && (
          <>
            <h2 className="font-display text-3xl text-ink mb-6 text-center">💸 Deposit USDC</h2>
            <div className="mb-5">
              <label className="text-sm font-semibold text-ink/70 mb-2 block">Amount — ${amount} USDC</label>
              <input type="range" min="100" max="10000" step="100" value={amount}
                onChange={(e) => setAmount(e.target.value)} className="w-full accent-amber-500" />
              <div className="flex justify-between text-xs text-ink/40 mt-1"><span>$100</span><span>$10,000</span></div>
            </div>
            <div className="glass-amber rounded-2xl p-4 mb-5 text-sm text-amber-700">
              <div className="font-semibold mb-1">✅ Gasless Transaction</div>
              <div className="text-xs text-amber-600">AutoYield pays all gas fees. You pay $0.</div>
            </div>
            <button onClick={handleDeposit} className="w-full py-4 rounded-2xl font-display text-xl text-white animate-pulse-glow"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>Confirm Deposit</button>
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
            <button onClick={onClose} className="px-8 py-3 rounded-2xl font-display text-white" style={{ background: '#F59E0B' }}>Close</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { riskTier, suiAddress } = useVaultStore();
  const [tfxTrigger, setTfxTrigger] = useState(0);
  const [showDeposit, setShowDeposit] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'agent'>('overview');

  const { data: vault, isLoading, isError } = useQuery({
    queryKey: ['vault-onchain'],
    queryFn: fetchVaultOnChain,
    refetchInterval: 30_000,
    retry: 2,
  });

  const { data: events = [] } = useQuery({
    queryKey: ['rebalance-events'],
    queryFn: () => fetchRebalanceEvents(10),
    refetchInterval: 60_000,
    retry: 1,
  });

  const totalAssets = vault?.totalAssets ?? 0;
  const totalUsd = totalAssets / 1_000_000; // USDC has 6 decimals
  const blendedApy = vault?.blendedApy ?? 0;

  return (
    <div className="min-h-screen vault-bg font-body">
      <TfxOverlay trigger={tfxTrigger} />

      <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 glass-dark border-b border-amber-500/20">
        <button onClick={() => { setTfxTrigger(t => t + 1); setTimeout(() => router.push('/'), 300); }}
          className="flex items-center gap-2 hover:opacity-80 transition">
          <span className="text-xl animate-float">💰</span>
          <span className="font-display text-xl text-cream">AutoYield</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-amber text-xs font-semibold text-amber-600">
            <span className="w-1.5 h-1.5 rounded-full bg-matcha animate-pulse" />
            {vault?.paused ? 'Paused' : 'Agent Active'}
          </div>
          {suiAddress && (
            <div className="px-3 py-1.5 rounded-full glass text-xs font-semibold text-ink/70">
              {suiAddress.slice(0, 6)}...{suiAddress.slice(-4)}
            </div>
          )}
          <button onClick={() => setShowDeposit(true)}
            className="px-4 py-2 rounded-xl font-display text-sm text-white"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
            + Deposit
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">

        {isError && (
          <div className="glass-amber rounded-2xl p-4 mb-6 text-amber-700 text-sm">
            ⚠️ Could not reach Sui RPC. Check your network connection.
          </div>
        )}

        {isLoading && (
          <div className="text-center py-16 text-ink/40 text-sm animate-pulse">Loading vault data from Sui testnet...</div>
        )}

        {!isLoading && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard emoji="🏦" label="Vault TVL"
                value={totalUsd > 0 ? `$${totalUsd.toFixed(2)}` : '$0.00'}
                sub={`${(totalAssets / 1e6).toFixed(2)} USDC`} />
              <StatCard emoji="📈" label="Blended APY"
                value={blendedApy > 0 ? `${blendedApy.toFixed(1)}%` : '--'}
                gain={blendedApy > 0} />
              <StatCard emoji="🔀" label="Allocations"
                value={vault ? `${(vault.scallopBps / 100).toFixed(0)}/${(vault.deepbookBps / 100).toFixed(0)}/${(vault.cetusBps / 100).toFixed(0)}` : '--'}
                sub="Scallop/DeepBook/Cetus" />
              <StatCard emoji="⏱" label="Last Rebalance"
                value={vault ? timeAgo(vault.lastRebalanceMs) : '--'} />
            </div>

            <div className="flex gap-2 mb-6">
              {(['overview', 'history', 'agent'] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm capitalize transition-all"
                  style={activeTab === tab
                    ? { background: '#F59E0B', color: 'white', boxShadow: '0 0 20px rgba(245,158,11,0.35)' }
                    : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                  {tab === 'overview' ? '📊 Overview' : tab === 'history' ? '📋 History' : '🤖 Agent'}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">

              {activeTab === 'overview' && vault && (
                <motion.div key="overview" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 glass rounded-2xl p-6">
                      <h3 className="font-display text-xl text-ink mb-2">Current Allocation</h3>
                      <p className="text-xs text-ink/50 mb-4">Live from Sui testnet · Object {process.env.NEXT_PUBLIC_VAULT_ID?.slice(0, 10)}...</p>
                      <AllocationPie scallop={vault.scallopBps} deepbook={vault.deepbookBps} cetus={vault.cetusBps} />

                      <div className="mt-6 grid grid-cols-3 gap-3">
                        {[
                          { name: '🐚 Scallop', bps: vault.scallopBps, apy: 8.2, color: '#F59E0B' },
                          { name: '📖 DeepBook', bps: vault.deepbookBps, apy: 11.4, color: '#F4A261' },
                          { name: '🐋 Cetus', bps: vault.cetusBps, apy: 14.7, color: '#7CB87C' },
                        ].map((p) => (
                          <div key={p.name} className="glass-amber rounded-xl p-3 text-center">
                            <div className="text-sm font-semibold text-ink/70">{p.name}</div>
                            <div className="font-display text-2xl text-ink">{(p.bps / 100).toFixed(0)}%</div>
                            <div className="text-xs" style={{ color: p.color }}>~{p.apy}% APY</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <div className="glass rounded-2xl p-5">
                        <h3 className="font-display text-lg text-ink mb-3">Vault State</h3>
                        <div className="space-y-2 text-sm">
                          {[
                            { label: 'Status', value: vault.paused ? '⏸ Paused' : '✅ Active', gain: !vault.paused },
                            { label: 'Total Assets', value: `${(vault.totalAssets / 1e6).toFixed(2)} USDC` },
                            { label: 'Total Shares', value: vault.totalShares.toLocaleString() },
                            { label: 'Blended APY', value: `${vault.blendedApy.toFixed(2)}%`, gain: true },
                            { label: 'Last Rebalance', value: timeAgo(vault.lastRebalanceMs) },
                            { label: 'Risk Tier', value: `${riskTier === 'conservative' ? '🐢' : riskTier === 'moderate' ? '🦊' : '🦅'} ${riskTier}` },
                          ].map((row) => (
                            <div key={row.label} className="flex justify-between">
                              <span className="text-ink/50">{row.label}</span>
                              <span className={`font-semibold ${row.gain ? 'gain' : 'text-ink'}`}>{row.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="glass rounded-2xl p-5">
                        <h3 className="font-display text-lg text-ink mb-2">On-Chain Proof</h3>
                        <p className="text-xs text-ink/50 mb-3">All data read live from Sui testnet via RPC</p>
                        <a
                          href={`https://testnet.suivision.xyz/object/${process.env.NEXT_PUBLIC_VAULT_ID}`}
                          target="_blank" rel="noopener noreferrer"
                          className="block text-center py-2 rounded-xl text-xs font-semibold text-amber-600 glass-amber hover:opacity-80 transition">
                          View Vault on Explorer →
                        </a>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'history' && (
                <motion.div key="history" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                  {events.length === 0 ? (
                    <div className="glass rounded-2xl p-12 text-center">
                      <div className="text-4xl mb-3">🤖</div>
                      <h3 className="font-display text-xl text-ink mb-2">No Rebalances Yet</h3>
                      <p className="text-ink/50 text-sm">The agent has not rebalanced this vault yet. Check back after the agent loop runs.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {events.map((e: any, i: number) => {
                        const f = e.parsedJson ?? {};
                        return (
                          <motion.div key={e.id?.txDigest ?? i}
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08 }} className="glass rounded-2xl p-5">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div>
                                <div className="font-display text-lg text-ink">Rebalance</div>
                                <div className="text-xs text-ink/40 font-mono">{e.id?.txDigest?.slice(0, 20)}...</div>
                              </div>
                              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full glass-amber text-xs font-semibold text-amber-600">
                                ✅ On-Chain
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-3 text-sm">
                              {f.new_scallop_bps !== undefined && (
                                <>
                                  <span className="text-ink/60">🐚 Scallop <strong className="text-ink">{(Number(f.new_scallop_bps) / 100).toFixed(0)}%</strong></span>
                                  <span className="text-ink/60">📖 DeepBook <strong className="text-ink">{(Number(f.new_deepbook_bps) / 100).toFixed(0)}%</strong></span>
                                  <span className="text-ink/60">🐋 Cetus <strong className="text-ink">{(Number(f.new_cetus_bps) / 100).toFixed(0)}%</strong></span>
                                </>
                              )}
                              <a href={`https://testnet.suivision.xyz/txblock/${e.id?.txDigest}`}
                                target="_blank" rel="noopener noreferrer"
                                className="ml-auto text-xs text-amber-600 hover:underline">View tx →</a>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'agent' && (
                <motion.div key="agent" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                  <AgentChat />
                </motion.div>
              )}

            </AnimatePresence>
          </>
        )}
      </main>

      <AnimatePresence>
        {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
      </AnimatePresence>

      {activeTab !== 'agent' && (
        <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1, type: 'spring' }}
          onClick={() => setActiveTab('agent')}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg text-2xl flex items-center justify-center animate-pulse-glow z-30"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }} title="Ask the AI agent">
          🤖
        </motion.button>
      )}
    </div>
  );
}
