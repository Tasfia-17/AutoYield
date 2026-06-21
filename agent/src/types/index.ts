// AutoYield Agent — shared type definitions

export interface ProtocolData {
  scallop: ScallopData;
  deepbook: DeepBookData;
  cetus: CetusData;
  prices: PriceData;
  timestamp: number;
}

export interface ScallopData {
  supplyApy: number;          // annualised, e.g. 0.082 = 8.2%
  borrowApy: number;
  utilizationRate: number;    // 0-1
  tvl: bigint;                // in base units
  availableLiquidity: bigint;
}

export interface DeepBookData {
  makerFeeApr: number;        // estimated APR from maker rebates
  spread: number;             // best bid/ask spread in bps
  volume24h: bigint;
  openOrders: OrderInfo[];
  managerBalance: ManagerBalance;
}

export interface OrderInfo {
  clientOrderId: bigint;
  isBid: boolean;
  price: bigint;
  quantity: bigint;
  filledQuantity: bigint;
}

export interface ManagerBalance {
  base: bigint;
  quote: bigint;
}

export interface CetusData {
  poolApr: number;            // estimated APR from swap fees
  currentPrice: bigint;
  sqrtPrice: bigint;
  tickCurrentIndex: number;
  positions: CetusPosition[];
}

export interface CetusPosition {
  positionId: string;
  liquidity: bigint;
  tickLower: number;
  tickUpper: number;
  feeOwedA: bigint;
  feeOwedB: bigint;
  entryPrice: bigint;
}

export interface PriceData {
  suiUsd: number;
  usdcUsd: number;
  confidence: number;         // Pyth confidence interval as %
  publishTime: number;        // unix timestamp
}

export interface VaultState {
  vaultId: string;
  totalAssets: bigint;
  totalShares: bigint;
  scallopBps: number;
  deepbookBps: number;
  cetusBps: number;
  protocolFeeBps: number;
  paused: boolean;
  lastRebalanceMs: number;
}

// AI decision output — validated by Zod schema
export interface RebalanceDecision {
  targetScallopBps: number;
  targetDeepbookBps: number;
  targetCetusBps: number;
  confidenceScore: number;    // 0-1
  expectedImprovementBps: number;
  reasoning: string;
  riskFactors: string[];
  shouldRebalance: boolean;
}

export interface GuardrailResult {
  approved: boolean;
  rejectionReason?: string;
  simulatedGasCost?: bigint;
}

export type RiskTier = 'conservative' | 'moderate' | 'aggressive';

export interface AgentConfig {
  vaultId: string;
  agentPrivateKey: string;
  agentCapId: string;
  rpcUrl: string;
  intervalMs: number;
  riskTier: RiskTier;
  maxDrawdownBps: number;
}
