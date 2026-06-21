import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { zkLoginAuth, type AuthedRequest } from '../middleware/auth.ts';

export const userRouter = Router();

// POST /api/user/register - create user after zkLogin
userRouter.post('/register', async (req, res) => {
  const schema = z.object({
    suiAddress: z.string().min(60),
    riskTier: z.enum(['conservative', 'moderate', 'aggressive']).default('moderate'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const { suiAddress, riskTier } = parsed.data;
  try {
    const result = await db.query(
      `INSERT INTO users (sui_address, risk_tier)
       VALUES ($1, $2)
       ON CONFLICT (sui_address) DO UPDATE SET risk_tier = $2, updated_at = NOW()
       RETURNING *`,
      [suiAddress, riskTier],
    );
    res.json({ user: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/user/me - current user
userRouter.get('/me', zkLoginAuth, async (req: AuthedRequest, res) => {
  try {
    const result = await db.query(
      `SELECT id, sui_address, risk_tier, position_id, created_at FROM users WHERE sui_address=$1`,
      [req.user!.suiAddress],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/user/preferences - update risk tier + position
userRouter.put('/preferences', zkLoginAuth, async (req: AuthedRequest, res) => {
  const schema = z.object({
    riskTier: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
    positionId: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (parsed.data.riskTier) { updates.push(`risk_tier=$${idx++}`); values.push(parsed.data.riskTier); }
  if (parsed.data.positionId) { updates.push(`position_id=$${idx++}`); values.push(parsed.data.positionId); }
  if (updates.length === 0) { res.json({ ok: true }); return; }
  updates.push(`updated_at=NOW()`);
  values.push(req.user!.suiAddress);
  await db.query(
    `UPDATE users SET ${updates.join(',')} WHERE sui_address=$${idx}`,
    values,
  );
  res.json({ ok: true });
});
