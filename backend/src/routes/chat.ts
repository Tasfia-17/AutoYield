/// Agent chat route - streams natural language explanations from GPT-4o.
/// Users can ask "why did you rebalance?" or "what's my P&L?" in plain English.
import { Router } from 'express';
import { z } from 'zod';
import OpenAI from 'openai';
import { db } from '../db/index.js';

export const chatRouter = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

chatRouter.post('/message', async (req, res) => {
  const schema = z.object({
    message: z.string().max(500),
    suiAddress: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  // Fetch context: recent rebalances + current vault state
  const history = await db.query(
    `SELECT scallop_bps_after, deepbook_bps_after, cetus_bps_after, confidence_score, reasoning, executed_at
     FROM rebalance_history ORDER BY executed_at DESC LIMIT 5`,
  );
  const snap = await db.query(
    `SELECT scallop_apy, deepbook_apr, cetus_apr, sui_price_usd FROM market_snapshots ORDER BY captured_at DESC LIMIT 1`,
  );

  const context = `
Recent rebalances: ${JSON.stringify(history.rows)}
Latest market: ${JSON.stringify(snap.rows[0] ?? {})}
`.trim();

  // Stream response back to client
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    stream: true,
    temperature: 0.3,
    max_tokens: 400,
    messages: [
      {
        role: 'system',
        content: `You are AutoYield's AI assistant. Explain DeFi portfolio decisions in plain English for non-crypto users.
Be concise, factual, and reassuring. Never use jargon without explaining it.
Context about the vault: ${context}`,
      },
      { role: 'user', content: parsed.data.message },
    ],
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? '';
    if (text) {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
  }
  res.write('data: [DONE]\n\n');
  res.end();
});
