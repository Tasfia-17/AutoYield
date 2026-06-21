'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { PieChart, Pie, Cell } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction, ConnectButton } from '@mysten/dapp-kit';
import { AgentChat } from '@/components/chat/AgentChat';
import { TfxOverlay } from '@/components/ui/TfxOverlay';
import { useVaultStore } from '@/lib/store';
import { fetchVaultOnChain, fetchRebalanceEvents } from '@/lib/api';
import { fetchUserPosition, buildDepositTx } from '@/lib/sui';

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

function DepositModal({ onClose, userPositionId }: { onClose: () => void; userPositionId: string | null }) {
  const [amountSui, setAmountSui] = useState('0.1');
  const [step, setStep] = useState<'form' | 'signing' | 'done' | 'error'>('form');
  const [txDigest, setTxDigest] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const { riskTier } = useVaultStore();

  const handleDeposit = async () => {
    if (!account) return;
    setStep('signing');
    try {
      // Get user's SUI coins
      const coins = await client.getCoins({ owner: account.address, coinType: '0x2::sui::SUI' });
      if (!coins.data.length) throw new Error('No SUI coins found in wallet');

      const amountMist = BigInt(Math.round(parseFloat(amountSui) * 1e9));
      const riskTierNum = riskTier === 'conservative' ? 0 : riskTier === 'aggressive' ? 2 : 1;
      const tx = buildDepositTx(amountMist, userPositionId, riskTierNum, coins.data[0].coinObjectId, account.address);

      const result = await signAndExecute({ transaction: tx });
      setTxDigest(result.digest);
      setStep('done');
    } catch (e: any) {
      setErrMsg(e?.message ?? 'Transaction failed');
      setStep('error');
    }
  };

  if (!account) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}>
        <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} exit={{ scale: 0.85 }}
          className="glass rounded-3xl p-8 w-full max-w-md text-center">
          <div className="text-4xl mb-4">🔑</div>
          <h2 className="font-display text-2xl text-ink mb-3">Connect Wallet First</h2>
          <p className="text-ink/60 text-sm mb-6">Connect your Sui wallet to deposit into the vault.</p>
          <ConnectButton />
          <button onClick={onClose} className="w-full py-3 mt-3 text-sm text-ink/50 hover:text-ink transition">Cancel</button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, y: 30 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }} className="glass rounded-3xl p-8 w-full max-w-md">

        {step === 'form' && (
          <>
            <h2 className="font-display text-3xl text-ink mb-2 text-center">💸 Deposit SUI</h2>
            <p className="text-xs text-ink/40 text-center mb-5">Testnet demo uses SUI as deposit coin</p>
            <div className="mb-5">
              <label className="text-sm font-semibold text-ink/70 mb-2 block">Amount (SUI)</label>
              <input type="number" min="0.01" step="0.01" value={amountSui}
                onChange={(e) => setAmountSui(e.target.value)}
                className="w-full px-4 py-3 rounded-xl glass text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div className="glass-amber rounded-2xl p-3 mb-5 text-xs text-amber-700">
              Wallet: {account.address.slice(0, 10)}...{account.address.slice(-6)}
            </div>
            <button onClick={handleDeposit}
              className="w-full py-4 rounded-2xl font-display text-xl text-white"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
              Sign & Deposit
            </button>
            <button onClick={onClose} className="w-full py-3 mt-2 text-sm text-ink/50 hover:text-ink transition">Cancel</button>
          </>
        )}

        {step === 'signing' && (
          <div className="text-center py-8">
            <div className="text-5xl mb-4 animate-spin-slow">⚡</div>
            <h2 className="font-display text-2xl text-ink mb-2">Sign in Wallet...</h2>
            <p className="text-ink/60 text-sm">Approve the transaction in your wallet</p>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-8">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}
              className="text-6xl mb-4">✅</motion.div>
            <h2 className="font-display text-2xl text-ink mb-2">Deposited {amountSui} SUI!</h2>
            <a href={`https://testnet.suivision.xyz/txblock/${txDigest}`} target="_blank" rel="noopener noreferrer"
              className="text-xs text-amber-600 hover:underline block mb-6">View on Explorer →</a>
            <button onClick={onClose} className="px-8 py-3 rounded-2xl font-display text-white" style={{ background: '#F59E0B' }}>Close</button>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">❌</div>
            <h2 className="font-display text-2xl text-ink mb-2">Transaction Failed</h2>
            <p className="text-xs text-ink/50 mb-6 break-all">{errMsg}</p>
            <button onClick={() => setStep('form')} className="px-8 py-3 rounded-2xl font-display text-white" style={{ background: '#F59E0B' }}>Try Again</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { riskTier } = useVaultStore();
  const [tfxTrigger, setTfxTrigger] = useState(0);
  const [showDeposit, setShowDeposit] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'agent'>('overview');

  const account = useCurrentAccount();
  const client = useSuiClient();

  const { data: vault, isLoading } = useQuery({
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

  const { data: userPosition } = useQuery({
    queryKey: ['user-position', account?.address],
    queryFn: () => fetchUserPosition(client, account!.address),
    enabled: !!account,
    refetchInterval: 30_000,
  });

  const totalAssets = vault?.totalAssets ?? 0;
  const totalUsd = totalAssets / 1_000_000;

  // User value: shares / totalShares * totalAssets
  const userValueRaw = userPosition && vault && vault.totalShares > 0
    ? (userPosition.shares / vault.totalShares) * vault.totalAssets
    : 0;
  const userPnl = userValueRaw - (userPosition?.costBasis ?? 0);

  return (
    <div className="min-h-screen animated-bg font-body">
      <TfxOverlay trigger={tfxTrigger} />

      <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 glass border-b border-amber-500/20">
        <button onClick={() => { setTfxTrigger(t => t + 1); setTimeout(() => router.push('/'), 300); }}
          className="flex items-center gap-2 hover:opacity-80 transition">
          <span className="text-xl animate-float">💰</span>
          <span className="font-display text-xl text-ink">AutoYield</span>
        </button>
        <div className="flex items-center gap-2">
          {vault && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-amber text-xs font-semibold text-amber-600">
              <span className="w-1.5 h-1.5 rounded-full bg-matcha animate-pulse" />
              {vault.paused ? 'Paused' : 'Agent Active'}
            </div>
          )}
          <ConnectButton />
          {account && (
            <button onClick={() => setShowDeposit(true)}
              className="px-4 py-2 rounded-xl font-display text-sm text-white"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
              + Deposit
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Not connected banner */}
        {!account && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="glass-amber rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="font-display text-xl text-ink mb-1">Connect your Sui wallet to get started</div>
              <p className="text-sm text-ink/60">View the live vault state below, or connect to deposit and track your position.</p>
            </div>
            <ConnectButton />
          </motion.div>
        )}

        {isLoading && (
          <div className="text-center py-16 text-ink/40 text-sm animate-pulse">Loading vault from Sui testnet...</div>
        )}

        {!isLoading && vault && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard emoji="🏦" label="Vault TVL"
                value={totalUsd > 0 ? `$${totalUsd.toFixed(2)}` : '0 USDC'}
                sub="Live on-chain" />
              <StatCard emoji="📈" label="Blended APY"
                value={vault.blendedApy > 0 ? `${vault.blendedApy.toFixed(1)}%` : '--'}
                gain={vault.blendedApy > 0} />
              <StatCard emoji="💰" label="Your Value"
                value={account && userPosition ? `${(userValueRaw / 1e9).toFixed(4)} SUI` : '--'}
                sub={account && userPosition ? `${userPosition.shares} shares` : 'Connect wallet'} />
              <StatCard emoji="📊" label="Your P&L"
                value={account && userPosition && userPnl !== 0 ? `${userPnl > 0 ? '+' : ''}${(userPnl / 1e9).toFixed(4)} SUI` : '--'}
                gain={userPnl > 0} />
            </div>

            {/* User position banner */}
            {account && !userPosition && (
              <div className="glass-amber rounded-2xl p-4 mb-6 flex items-center justify-between">
                <span className="text-sm text-amber-700">You have no position in this vault yet.</span>
                <button onClick={() => setShowDeposit(true)}
                  className="px-4 py-2 rounded-xl text-sm font-display text-white"
                  style={{ background: '#F59E0B' }}>Deposit Now</button>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              {(['overview', 'history', 'agent'] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm capitalize transition-all"
                  style={activeTab === tab
                    ? { background: '#F59E0B', color: 'white', boxShadow: '0 0 20px rgba(245,158,11,0.35)' }
                    : { background: 'rgba(0,0,0,0.06)', color: 'rgba(26,26,46,0.6)' }}>
                  {tab === 'overview' ? '📊 Overview' : tab === 'history' ? '📋 History' : '🤖 Agent'}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">

              {activeTab === 'overview' && (
                <motion.div key="overview" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 glass rounded-2xl p-6">
                      <h3 className="font-display text-xl text-ink mb-1">Current Allocation</h3>
                      <p className="text-xs text-ink/40 mb-4">
                        Live from Sui testnet ·{' '}
                        <a href={`https://testnet.suivision.xyz/object/${process.env.NEXT_PUBLIC_VAULT_ID}`}
                          target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline">
                          View vault object →
                        </a>
                      </p>
                      <AllocationPie scallop={vault.scallopBps} deepbook={vault.deepbookBps} cetus={vault.cetusBps} />
                      <div className="mt-6 grid grid-cols-3 gap-3">
                        {[
                          { name: '🐚 Scallop', bps: vault.scallopBps, apy: 8.2, color: '#F59E0B' },
                          { name: '📖 DeepBook', bps: vault.deepbookBps, apy: 11.4, color: '#F4A261' },
                          { name: '🐋 Cetus', bps: vault.cetusBps, apy: 14.7, color: '#7CB87C' },
                        ].map((p) => (
                          <div key={p.name} className="glass-amber rounded-xl p-3 text-center">
                            <div className="text-xs font-semibold text-ink/60">{p.name}</div>
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
                            { label: 'Total Assets', value: `${(vault.totalAssets / 1e9).toFixed(4)} SUI` },
                            { label: 'Total Shares', value: vault.totalShares.toLocaleString() },
                            { label: 'APY', value: `${vault.blendedApy.toFixed(2)}%`, gain: true },
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

                      {account && userPosition && (
                        <div className="glass rounded-2xl p-5">
                          <h3 className="font-display text-lg text-ink mb-3">Your Position</h3>
                          <div className="space-y-2 text-sm">
                            {[
                              { label: 'Shares', value: userPosition.shares.toLocaleString() },
                              { label: 'Deposits', value: userPosition.depositCount.toString() },
                              { label: 'Cost Basis', value: `${(userPosition.costBasis / 1e9).toFixed(4)} SUI` },
                              { label: 'Current Value', value: `${(userValueRaw / 1e9).toFixed(4)} SUI` },
                            ].map((row) => (
                              <div key={row.label} className="flex justify-between">
                                <span className="text-ink/50">{row.label}</span>
                                <span className="font-semibold text-ink">{row.value}</span>
                              </div>
                            ))}
                          </div>
                          <a href={`https://testnet.suivision.xyz/object/${userPosition.objectId}`}
                            target="_blank" rel="noopener noreferrer"
                            className="block text-center mt-3 py-2 rounded-xl text-xs font-semibold text-amber-600 glass-amber hover:opacity-80 transition">
                            View Your Position On-Chain →
                          </a>
                        </div>
                      )}
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
                      <p className="text-ink/50 text-sm">The agent has not rebalanced this vault yet.</p>
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
                                <div className="text-xs text-ink/40 font-mono">{e.id?.txDigest?.slice(0, 24)}...</div>
                              </div>
                              <span className="px-3 py-1 rounded-full glass-amber text-xs font-semibold text-amber-600">✅ On-Chain</span>
                            </div>
                            {f.new_scallop_bps !== undefined && (
                              <div className="flex flex-wrap gap-3 text-sm">
                                <span className="text-ink/60">🐚 Scallop <strong className="text-ink">{(Number(f.new_scallop_bps) / 100).toFixed(0)}%</strong></span>
                                <span className="text-ink/60">📖 DeepBook <strong className="text-ink">{(Number(f.new_deepbook_bps) / 100).toFixed(0)}%</strong></span>
                                <span className="text-ink/60">🐋 Cetus <strong className="text-ink">{(Number(f.new_cetus_bps) / 100).toFixed(0)}%</strong></span>
                                <a href={`https://testnet.suivision.xyz/txblock/${e.id?.txDigest}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="ml-auto text-xs text-amber-600 hover:underline">View tx →</a>
                              </div>
                            )}
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
        {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} userPositionId={userPosition?.objectId ?? null} />}
      </AnimatePresence>

      {activeTab !== 'agent' && (
        <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1, type: 'spring' }}
          onClick={() => setActiveTab('agent')}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg text-2xl flex items-center justify-center animate-pulse-glow z-30"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
          🤖
        </motion.button>
      )}
    </div>
  );
}
