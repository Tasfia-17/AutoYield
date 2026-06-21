/// BullMQ job queues for async agent tasks:
/// - snapshot: periodic market data recording
/// - rebalance: agent rebalance result recording
/// - gas-station: sponsored tx processing
import { Queue, Worker, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';

const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// ── Queues ──
export const snapshotQueue = new Queue('market-snapshot', { connection });
export const rebalanceQueue = new Queue('rebalance-record', { connection });
export const gasStationQueue = new Queue('gas-station', { connection });

// ── Workers ──

// Records market snapshots every 60s
new Worker('market-snapshot', async (job) => {
  const { scallopApy, deepbookApr, cetusApr, suiPriceUsd, totalAssets, blendedApy } = job.data;
  await db.query(
    `INSERT INTO market_snapshots
       (scallop_apy, deepbook_apr, cetus_apr, sui_price_usd, total_assets, blended_apy)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [scallopApy, deepbookApr, cetusApr, suiPriceUsd, totalAssets, blendedApy],
  );
}, { connection });

// Records rebalance execution results
new Worker('rebalance-record', async (job) => {
  const d = job.data;
  await db.query(
    `INSERT INTO rebalance_history
       (tx_digest, vault_id,
        scallop_bps_before, deepbook_bps_before, cetus_bps_before,
        scallop_bps_after, deepbook_bps_after, cetus_bps_after,
        confidence_score, reasoning, gas_cost_mist)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (tx_digest) DO NOTHING`,
    [
      d.txDigest, d.vaultId,
      d.scallopBefore, d.deepbookBefore, d.cetusBefore,
      d.scallopAfter, d.deepbookAfter, d.cetusAfter,
      d.confidenceScore, d.reasoning, d.gasCostMist,
    ],
  );
}, { connection });

// Processes gas station requests — validates and rate-limits
new Worker('gas-station', async (job) => {
  const { userAddress, txKind } = job.data;
  const MAX_DAILY_SPONSORED = 10;
  const WINDOW_MS = 86_400_000;

  const res = await db.query(
    `SELECT tx_count_today, window_start, blacklisted FROM gas_station WHERE sui_address=$1`,
    [userAddress],
  );

  if (res.rows[0]?.blacklisted) {
    throw new Error(`Address ${userAddress} is blacklisted`);
  }

  const now = Date.now();
  if (res.rows.length === 0) {
    await db.query(
      `INSERT INTO gas_station (sui_address, tx_count_today, window_start)
       VALUES ($1, 1, NOW())`,
      [userAddress],
    );
    return { approved: true };
  }

  const row = res.rows[0];
  const windowStart = new Date(row.window_start).getTime();
  let count = row.tx_count_today;

  if (now - windowStart > WINDOW_MS) {
    count = 0;
  }

  if (count >= MAX_DAILY_SPONSORED) {
    throw new Error(`Daily sponsored tx limit reached for ${userAddress}`);
  }

  await db.query(
    `UPDATE gas_station SET tx_count_today=$1, window_start=CASE WHEN $2::bigint - EXTRACT(EPOCH FROM window_start)*1000 > $3 THEN NOW() ELSE window_start END WHERE sui_address=$4`,
    [count + 1, now, WINDOW_MS, userAddress],
  );

  return { approved: true };
}, { connection });

export function setupQueues() {
  logger.info('BullMQ queues ready');
}
