/// MemWal Memory Layer - persistent, verifiable agent memory on Walrus.
/// Stores strategy decisions, market snapshots, and reasoning traces.
/// Enables the AI to learn from past decisions and provide audit trails.
import { MemWal } from '@mysten-incubation/memwal';
import type { ProtocolData, RebalanceDecision, VaultState } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface DecisionRecord {
  action: string;
  txDigest?: string;
  reason?: string;
  decision: RebalanceDecision;
  market: ProtocolData;
  gasCost?: string;
  vaultState?: {
    before: VaultState;
    afterAllocations?: { scallop: number; deepbook: number; cetus: number };
  };
}

export interface PerformanceRecord {
  periodStartMs: number;
  periodEndMs: number;
  apyAchieved: number;
  apyBenchmark: number;     // simple hold benchmark
  rebalanceCount: number;
  totalGasCostUsd: number;
  maxDrawdownBps: number;
}

export class MemoryLayer {
  private memwal: MemWal;
  private ready = false;

  constructor(delegateKey: string, accountId: string) {
    this.memwal = MemWal.create({
      key: delegateKey,
      accountId,
      serverUrl: process.env.MEMWAL_SERVER_URL ?? 'https://memwal-relayer.walrus.xyz',
      namespace: 'autoyield-v1',
    });
  }

  async init() {
    try {
      await this.memwal.health();
      this.ready = true;
      logger.info('MemWal connected');
    } catch (err) {
      logger.warn('MemWal unavailable - running without persistent memory', { err });
    }
  }

  /// Recall relevant past decisions to give AI historical context.
  async recall(query: string, limit = 5): Promise<string> {
    if (!this.ready) return '';
    try {
      const memories = await this.memwal.recall({ query, limit });
      if (!memories || memories.length === 0) return '';
      return memories
        .map((m: any, i: number) => `[${i + 1}] ${m.content}`)
        .join('\n');
    } catch (err) {
      logger.warn('MemWal recall failed', { err });
      return '';
    }
  }

  /// Store a decision record with full market context.
  async rememberDecision(record: DecisionRecord): Promise<void> {
    if (!this.ready) return;
    try {
      const content = JSON.stringify({
        type: 'decision',
        timestamp: Date.now(),
        action: record.action,
        txDigest: record.txDigest,
        reason: record.reason,
        allocations: {
          scallop: record.decision.targetScallopBps,
          deepbook: record.decision.targetDeepbookBps,
          cetus: record.decision.targetCetusBps,
        },
        reasoning: record.decision.reasoning,
        confidence: record.decision.confidenceScore,
        expectedImprovementBps: record.decision.expectedImprovementBps,
        riskFactors: record.decision.riskFactors,
        market: {
          scallopApy: record.market.scallop.supplyApy,
          deepbookApr: record.market.deepbook.makerFeeApr,
          cetusApr: record.market.cetus.poolApr,
          suiPrice: record.market.prices.suiUsd,
        },
        gasCost: record.gasCost,
      });

      const job = await this.memwal.remember(content);
      // Fire-and-forget - don't block the agent loop on memory writes
      this.memwal.waitForRememberJob(job.job_id).catch((err) => {
        logger.warn('MemWal remember job failed', { err });
      });
    } catch (err) {
      logger.warn('MemWal remember failed', { err });
    }
  }

  /// Store a performance report - used to evaluate agent over time.
  async rememberPerformance(report: PerformanceRecord): Promise<void> {
    if (!this.ready) return;
    try {
      const content = JSON.stringify({ type: 'performance', ...report });
      const job = await this.memwal.remember(content);
      await this.memwal.waitForRememberJob(job.job_id);
      logger.info('Performance report stored in MemWal');
    } catch (err) {
      logger.warn('MemWal performance store failed', { err });
    }
  }

  /// Store a user preference update.
  async rememberUserPreference(userId: string, preference: object): Promise<void> {
    if (!this.ready) return;
    try {
      const content = JSON.stringify({
        type: 'user_preference',
        userId,
        timestamp: Date.now(),
        ...preference,
      });
      const job = await this.memwal.remember(content);
      this.memwal.waitForRememberJob(job.job_id).catch(() => {});
    } catch (err) {
      logger.warn('MemWal user preference store failed', { err });
    }
  }

  /// Restore full memory namespace - useful after agent restart.
  async restore(): Promise<void> {
    if (!this.ready) return;
    try {
      await this.memwal.restore('autoyield-v1');
      logger.info('MemWal namespace restored');
    } catch (err) {
      logger.warn('MemWal restore failed', { err });
    }
  }
}
