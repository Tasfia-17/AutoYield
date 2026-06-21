/// AutoYield Agent - main orchestration loop.
/// Flow: Sense → Recall Memory → Reason → Guardrails → Simulate → Execute → Remember
import 'dotenv/config';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { DeepBookClient } from '@mysten/deepbook-v3';
import { Scallop } from '@scallop-io/sui-scallop-sdk';
import { SensingLayer } from './sensing/index.js';
import { ReasoningLayer } from './reasoning/index.js';
import { GuardrailsLayer } from './guardrails/index.js';
import { PtbBuilder } from './ptb/index.js';
import { MemoryLayer } from './memory/index.js';
import { logger } from './utils/logger.js';
import type { RiskTier } from './types/index.js';

const INTERVAL_MS = Number(process.env.AGENT_INTERVAL_MS ?? 30_000);
const RISK_TIER = (process.env.RISK_TIER ?? 'moderate') as RiskTier;
const NETWORK = (process.env.SUI_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';

async function main() {
  logger.info('AutoYield agent starting', { network: NETWORK, riskTier: RISK_TIER });

  // ── Bootstrap clients ──
  const suiClient = new SuiClient({ url: getFullnodeUrl(NETWORK) });

  const keypair = Ed25519Keypair.fromSecretKey(
    Buffer.from(process.env.AGENT_PRIVATE_KEY!, 'hex'),
  );

  const deepbookClient = new DeepBookClient({
    client: suiClient,
    address: keypair.getPublicKey().toSuiAddress(),
    balanceManagers: {
      MANAGER_1: {
        address: process.env.DEEPBOOK_MANAGER_ID!,
        tradeCap: process.env.DEEPBOOK_TRADE_CAP_ID,
      },
    },
    pools: {
      SUI_USDC: {
        baseAsset: 'SUI',
        quoteAsset: 'USDC',
      } as any,
    },
  });

  const scallop = new Scallop({
    networkType: NETWORK,
    suiClient,
  });

  const sensing = new SensingLayer(
    suiClient,
    deepbookClient,
    scallop,
    process.env.VAULT_ID!,
    'MANAGER_1',
  );

  const reasoning = new ReasoningLayer(process.env.OPENAI_API_KEY!);
  const guardrails = new GuardrailsLayer(Number(process.env.MAX_DRAWDOWN_BPS ?? 2000));
  const ptbBuilder = new PtbBuilder(suiClient, keypair, deepbookClient);
  const memory = new MemoryLayer(
    process.env.MEMWAL_DELEGATE_KEY!,
    process.env.MEMWAL_ACCOUNT_ID!,
  );

  logger.info('All clients initialized - starting agent loop');

  // ── Agent loop ──
  while (true) {
    try {
      await runCycle(sensing, reasoning, guardrails, ptbBuilder, memory);
    } catch (err) {
      logger.error('Agent cycle error', { err });
    }
    await sleep(INTERVAL_MS);
  }
}

async function runCycle(
  sensing: SensingLayer,
  reasoning: ReasoningLayer,
  guardrails: GuardrailsLayer,
  ptbBuilder: PtbBuilder,
  memory: MemoryLayer,
) {
  logger.info('--- Agent cycle start ---');

  // 1. SENSE: collect fresh market data + vault state
  const [data, vault] = await Promise.all([
    sensing.collect(),
    sensing.fetchVaultState(),
  ]);

  if (vault.paused) {
    logger.warn('Vault paused - skipping cycle');
    return;
  }

  // 2. RECALL: fetch relevant past decisions from MemWal
  const recentMemory = await memory.recall(
    `rebalance decisions scallop deepbook cetus apy ${(data.scallop.supplyApy * 100).toFixed(1)}%`,
  );

  // 3. REASON: ask AI for optimal allocation
  const decision = await reasoning.decide(vault, data, RISK_TIER, recentMemory);

  if (!decision.shouldRebalance) {
    logger.info('AI decided no rebalance needed', { reasoning: decision.reasoning });
    return;
  }

  // 4. GUARDRAILS: deterministic override - rejects if any rule fails
  const check = guardrails.validate(decision, vault);
  if (!check.approved) {
    logger.warn('Guardrails rejected decision', { reason: check.rejectionReason });
    await memory.rememberDecision({
      action: 'guardrail_rejected',
      reason: check.rejectionReason!,
      decision,
      market: data,
    });
    return;
  }

  // 5. SIMULATE: dry-run PTB to verify gas + expected state
  const sim = await ptbBuilder.simulateRebalance(decision, vault);
  if (!sim.success) {
    logger.error('PTB simulation failed', { error: sim.error });
    return;
  }

  // Gas cost sanity check: expected improvement must cover gas 10x
  const improvementUsd =
    (Number(vault.totalAssets) / 1e6) * (decision.expectedImprovementBps / 10000) * (1 / 365);
  const gasCostSui = Number(sim.gasCost) / 1e9;
  const gasCostUsd = gasCostSui * data.prices.suiUsd;

  if (improvementUsd < gasCostUsd * 10) {
    logger.warn('Gas cost too high relative to improvement', {
      improvementUsd: improvementUsd.toFixed(4),
      gasCostUsd: gasCostUsd.toFixed(6),
    });
    return;
  }

  // 6. EXECUTE: submit the atomic PTB
  const result = await ptbBuilder.executeRebalance(decision, vault);
  logger.info('Rebalance executed on-chain', { digest: result.digest });

  // 7. REMEMBER: store full decision + outcome in MemWal for future reasoning
  await memory.rememberDecision({
    action: 'rebalance_executed',
    txDigest: result.digest,
    decision,
    market: data,
    gasCost: result.gasCost.toString(),
    vaultState: {
      before: vault,
      afterAllocations: {
        scallop: decision.targetScallopBps,
        deepbook: decision.targetDeepbookBps,
        cetus: decision.targetCetusBps,
      },
    },
  });

  logger.info('--- Agent cycle complete ---');
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  logger.error('Fatal agent error', { err });
  process.exit(1);
});
