/// Guardrails Layer - deterministic safety checks that override ALL AI decisions.
/// This layer is NEVER bypassed. It mirrors the on-chain security.move logic.
/// Off-chain guardrails run BEFORE building the PTB, on-chain guardrails run AFTER.
import type { RebalanceDecision, VaultState, GuardrailResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

const MAX_SINGLE_PROTOCOL_BPS = 6000;
const MIN_CONFIDENCE = 0.70;
const MIN_IMPROVEMENT_BPS = 50;
const MAX_SHIFT_PER_REBALANCE_BPS = 3000;
const MIN_REBALANCE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

interface GuardState {
  lastRebalanceMs: number;
  dailyRebalanceCount: number;
  dailyWindowStartMs: number;
  peakAssets: bigint;
  maxDrawdownBps: number;
}

export class GuardrailsLayer {
  private state: GuardState;

  constructor(maxDrawdownBps = 2000) {
    this.state = {
      lastRebalanceMs: 0,
      dailyRebalanceCount: 0,
      dailyWindowStartMs: 0,
      peakAssets: 0n,
      maxDrawdownBps,
    };
  }

  validate(
    decision: RebalanceDecision,
    vault: VaultState,
    nowMs: number = Date.now(),
  ): GuardrailResult {
    // 1. Vault circuit breaker
    if (vault.paused) {
      return this.reject('Vault is paused - emergency mode active');
    }

    // 2. AI confidence gate
    if (decision.confidenceScore < MIN_CONFIDENCE) {
      return this.reject(`AI confidence ${(decision.confidenceScore * 100).toFixed(1)}% < 70% threshold`);
    }

    // 3. Expected improvement gate
    if (decision.expectedImprovementBps < MIN_IMPROVEMENT_BPS) {
      return this.reject(`Improvement ${decision.expectedImprovementBps} bps < 50 bps minimum`);
    }

    // 4. Allocation sum must equal exactly 10000 bps
    const sum = decision.targetScallopBps + decision.targetDeepbookBps + decision.targetCetusBps;
    if (sum !== 10000) {
      return this.reject(`Allocations sum to ${sum} bps, must equal 10000`);
    }

    // 5. Concentration cap - no single protocol > 60%
    if (decision.targetScallopBps > MAX_SINGLE_PROTOCOL_BPS) {
      return this.reject(`Scallop allocation ${decision.targetScallopBps} bps exceeds 60% cap`);
    }
    if (decision.targetDeepbookBps > MAX_SINGLE_PROTOCOL_BPS) {
      return this.reject(`DeepBook allocation ${decision.targetDeepbookBps} bps exceeds 60% cap`);
    }
    if (decision.targetCetusBps > MAX_SINGLE_PROTOCOL_BPS) {
      return this.reject(`Cetus allocation ${decision.targetCetusBps} bps exceeds 60% cap`);
    }

    // 6. Max shift per rebalance - prevents abrupt portfolio swings
    const scallopShift = Math.abs(vault.scallopBps - decision.targetScallopBps);
    const deepbookShift = Math.abs(vault.deepbookBps - decision.targetDeepbookBps);
    const cetusShift = Math.abs(vault.cetusBps - decision.targetCetusBps);
    if (scallopShift > MAX_SHIFT_PER_REBALANCE_BPS) {
      return this.reject(`Scallop shift ${scallopShift} bps exceeds 30% max`);
    }
    if (deepbookShift > MAX_SHIFT_PER_REBALANCE_BPS) {
      return this.reject(`DeepBook shift ${deepbookShift} bps exceeds 30% max`);
    }
    if (cetusShift > MAX_SHIFT_PER_REBALANCE_BPS) {
      return this.reject(`Cetus shift ${cetusShift} bps exceeds 30% max`);
    }

    // 7. Cooldown - min 1 hour between rebalances (matches on-chain)
    if (nowMs < vault.lastRebalanceMs + MIN_REBALANCE_INTERVAL_MS) {
      const remaining = Math.ceil((vault.lastRebalanceMs + MIN_REBALANCE_INTERVAL_MS - nowMs) / 60000);
      return this.reject(`Cooldown active - ${remaining} min remaining`);
    }

    // 8. Daily limit
    if (nowMs >= this.state.dailyWindowStartMs + 86_400_000) {
      this.state.dailyRebalanceCount = 0;
      this.state.dailyWindowStartMs = nowMs;
    }
    if (this.state.dailyRebalanceCount >= 24) {
      return this.reject('Daily rebalance limit (24) reached');
    }

    // 9. Drawdown protection
    if (vault.totalAssets > this.state.peakAssets) {
      this.state.peakAssets = vault.totalAssets;
    }
    if (this.state.peakAssets > 0n && vault.totalAssets < this.state.peakAssets) {
      const drawdownBps = Number(
        (this.state.peakAssets - vault.totalAssets) * 10000n / this.state.peakAssets
      );
      if (drawdownBps > this.state.maxDrawdownBps) {
        return this.reject(`Drawdown ${drawdownBps} bps exceeds max ${this.state.maxDrawdownBps} bps`);
      }
    }

    // All checks passed - update state
    this.state.dailyRebalanceCount++;
    this.state.lastRebalanceMs = nowMs;

    logger.info('Guardrails approved rebalance', {
      scallop: decision.targetScallopBps,
      deepbook: decision.targetDeepbookBps,
      cetus: decision.targetCetusBps,
      confidence: decision.confidenceScore,
    });

    return { approved: true };
  }

  private reject(reason: string): GuardrailResult {
    logger.warn('Guardrails rejected decision', { reason });
    return { approved: false, rejectionReason: reason };
  }

  getState(): Readonly<GuardState> {
    return { ...this.state };
  }
}
