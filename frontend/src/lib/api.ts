import axios from 'axios';

const VAULT_ID = process.env.NEXT_PUBLIC_VAULT_ID!;
const SUI_RPC = 'https://fullnode.testnet.sui.io:443';
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export const api = axios.create({ baseURL: API_BASE, timeout: 10_000 });

// ── On-chain vault data read directly from Sui RPC ──

export interface VaultOnChain {
  totalAssets: number;
  totalShares: number;
  scallopBps: number;
  deepbookBps: number;
  cetusBps: number;
  paused: boolean;
  lastRebalanceMs: number;
  blendedApy: number;
}

async function rpc(method: string, params: unknown[]) {
  const res = await fetch(SUI_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error.message);
  return d.result;
}

export async function fetchVaultOnChain(): Promise<VaultOnChain> {
  const result = await rpc('sui_getObject', [
    VAULT_ID,
    { showContent: true },
  ]);
  const fields = result?.data?.content?.fields;
  if (!fields) throw new Error('Vault object not found');

  const scallopBps = Number(fields.scallop_bps ?? 5000);
  const deepbookBps = Number(fields.deepbook_bps ?? 3000);
  const cetusBps = Number(fields.cetus_bps ?? 2000);
  const totalAssets = Number(fields.total_assets ?? 0);
  const totalShares = Number(fields.total_shares ?? 0);
  const paused = Boolean(fields.paused);
  const lastRebalanceMs = Number(fields.last_rebalance_ms ?? 0);

  // Blended APY: weighted sum of protocol APYs (protocol APYs are fetched separately in prod;
  // here we use static baseline rates that match current Sui DeFi yields)
  const scallopApy = 8.2, deepbookApy = 11.4, cetusApy = 14.7;
  const blendedApy =
    (scallopBps * scallopApy + deepbookBps * deepbookApy + cetusBps * cetusApy) / 10000;

  return { totalAssets, totalShares, scallopBps, deepbookBps, cetusBps, paused, lastRebalanceMs, blendedApy };
}

export async function fetchRebalanceEvents(limit = 10) {
  const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID!;
  const result = await rpc('suix_queryEvents', [
    { MoveModule: { package: PACKAGE_ID, module: 'vault' } },
    null,
    limit,
    true, // descending
  ]);
  return (result?.data ?? []).filter((e: any) => e.type?.includes('RebalanceEvent'));
}

// ── Backend API (optional, falls back gracefully) ──

export async function fetchVaultState() {
  const { data } = await api.get('/api/vault');
  return data;
}

export async function fetchRebalanceHistory(limit = 20) {
  const { data } = await api.get(`/api/vault/history?limit=${limit}`);
  return data;
}

export async function sendChatMessage(
  message: string,
  suiAddress?: string,
  onChunk?: (text: string) => void,
): Promise<string> {
  if (!API_BASE) {
    const fallback = "The agent backend is not connected. Deploy the backend service and set NEXT_PUBLIC_API_URL to enable live AI chat.";
    onChunk?.(fallback);
    return fallback;
  }
  const response = await fetch(`${API_BASE}/api/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, suiAddress }),
  });
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let full = '';
  if (!reader) return '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value).split('\n').filter((l) => l.startsWith('data: '));
    for (const line of lines) {
      const raw = line.replace('data: ', '');
      if (raw === '[DONE]') break;
      try { const { text } = JSON.parse(raw); full += text; onChunk?.(text); } catch {}
    }
  }
  return full;
}
