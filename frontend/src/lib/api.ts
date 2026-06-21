import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  timeout: 15_000,
});

export async function fetchVaultState() {
  const { data } = await api.get('/api/vault');
  return data;
}

export async function fetchRebalanceHistory(limit = 20) {
  const { data } = await api.get(`/api/vault/history?limit=${limit}`);
  return data;
}

export async function fetchSnapshots(hours = 24) {
  const { data } = await api.get(`/api/vault/snapshots?hours=${hours}`);
  return data;
}

export async function registerUser(suiAddress: string, riskTier: string) {
  const { data } = await api.post('/api/user/register', { suiAddress, riskTier });
  return data;
}

export async function sendChatMessage(
  message: string,
  suiAddress?: string,
  onChunk?: (text: string) => void,
): Promise<string> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat/message`, {
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
      try {
        const { text } = JSON.parse(raw);
        full += text;
        onChunk?.(text);
      } catch {}
    }
  }
  return full;
}
