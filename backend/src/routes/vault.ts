import { Router } from 'express';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { db } from '../db/index.js';
import { snapshotQueue, rebalanceQueue } from '../jobs/queues.js';
import { zkLoginAuth, type AuthedRequest } from '../middleware/auth.ts';
import { z } from 'zod';

export const vaultRouter = Router();

const suiClient = new SuiClient({
  url: getFullnodeUrl((process.env.SUI_NETWORK ?? 'testnet') as any),
});
const VAULT_ID = process.env.VAULT_ID!;

// GET /api/vault — current vault state from chain
vaultRouter.get('/', async (_req, res) => {
  try {
    const obj = await suiClient.getObject({
      id: VAULT_ID,
      options: { showContent: true },
    });
    if (!obj.data?.content || obj.data.content.dataType !== 'moveObject') {
      res.status(404).json({ error: 'Vault not found' });
      return;
    }
    const fields = obj.data.content.fields as Record<string, unknown>;

    // Compute blended APY from latest market snapshot
    const snap = await db.query(
      `SELECT scallop_apy, deepbook_apr, cetus_apr, blended_apy FROM market_snapshots ORDER BY captured_at DESC LIMIT 1`,
    );

    const scallopBps = Number(fields['scallop_bps']);
    const deepbookBps = Number(fields['deepbook_bps']);
    const cetusBps = Number(fields['cetus_bps']);

    const row = snap.rows[0];
    const blendedApy = row
      ? (row.scallop_apy * scallopBps + row.deepbook_apr * deepbookBps + row.cetus_apr * cetusBps) / 10000
      : null;

    res.json({
      vaultId: VAULT_ID,
      totalAssets: fields['total_assets'],
      totalShares: fields['total_shares'],
      allocations: { scallopBps, deepbookBps, cetusBps },
      protocolFeeBps: fields['protocol_fee_bps'],
      paused: fields['paused'],
      lastRebalanceMs: fields['last_rebalance_ms'],
      blendedApy,
      latestApys: row ?? null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/vault/history — rebalance history
vaultRouter.get('/history', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  const offset = Number(req.query.offset ?? 0);
  try {
    const result = await db.query(
      `SELECT * FROM rebalance_history ORDER BY executed_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    res.json({ history: result.rows, total: result.rowCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/vault/snapshots — time-series market data
vaultRouter.get('/snapshots', async (req, res) => {
  const hours = Math.min(Number(req.query.hours ?? 24), 168); // max 7 days
  try {
    const result = await db.query(
      `SELECT * FROM market_snapshots WHERE captured_at > NOW() - INTERVAL '${hours} hours' ORDER BY captured_at ASC`,
    );
    res.json({ snapshots: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/vault/snapshot — agent posts fresh market data
vaultRouter.post('/snapshot', async (req, res) => {
  const schema = z.object({
    scallopApy: z.number(),
    deepbookApr: z.number(),
    cetusApr: z.number(),
    suiPriceUsd: z.number(),
    totalAssets: z.number(),
    blendedApy: z.number().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  await snapshotQueue.add('snapshot', parsed.data, { removeOnComplete: 100 });
  res.json({ queued: true });
});

// POST /api/vault/rebalance — agent posts executed rebalance
vaultRouter.post('/rebalance', async (req, res) => {
  const schema = z.object({
    txDigest: z.string(),
    vaultId: z.string(),
    scallopBefore: z.number().int(),
    deepbookBefore: z.number().int(),
    cetusBefore: z.number().int(),
    scallopAfter: z.number().int(),
    deepbookAfter: z.number().int(),
    cetusAfter: z.number().int(),
    confidenceScore: z.number(),
    reasoning: z.string(),
    gasCostMist: z.number().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  await rebalanceQueue.add('rebalance', parsed.data, { removeOnComplete: 100 });
  res.json({ queued: true });
});
