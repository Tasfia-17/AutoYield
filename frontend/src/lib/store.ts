import { create } from 'zustand';

interface VaultStore {
  riskTier: 'conservative' | 'moderate' | 'aggressive';
  suiAddress: string | null;
  positionId: string | null;
  setRiskTier: (t: 'conservative' | 'moderate' | 'aggressive') => void;
  setAuth: (address: string, positionId?: string) => void;
  clear: () => void;
}

export const useVaultStore = create<VaultStore>((set) => ({
  riskTier: 'moderate',
  suiAddress: null,
  positionId: null,
  setRiskTier: (riskTier) => set({ riskTier }),
  setAuth: (suiAddress, positionId) => set({ suiAddress, positionId: positionId ?? null }),
  clear: () => set({ suiAddress: null, positionId: null }),
}));
