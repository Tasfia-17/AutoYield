/// Reasoning Layer — GPT-4o strategy engine.
/// Temperature 0.1 for deterministic financial decisions.
/// All output validated with Zod before passing to guardrails.
import OpenAI from 'openai';
import { z } from 'zod';
import type { ProtocolData, RebalanceDecision, VaultState, RiskTier } from '../types/index.js';
import { logger } from '../utils/logger.js';

// Strict output schema — guardrails rely on this being valid
const DecisionSchema = z.object({
  targetScallopBps: z.number().int().min(0).max(10000),
  targetDeepbookBps: z.number().int().min(0).max(10000),
  targetCetusBps: z.number().int().min(0).max(10000),
  confidenceScore: z.number().min(0).max(1),
  expectedImprovementBps: z.number().int().min(0),
  reasoning: z.string().max(500),
  riskFactors: z.array(z.string()).max(5),
  shouldRebalance: z.boolean(),
}).refine(
  (d) => d.targetScallopBps + d.targetDeepbookBps + d.targetCetusBps === 10000,
  { message: 'Allocations must sum to 10000 bps' },
);

// Risk tier constraints passed to AI as hard constraints
const RISK_CONSTRAINTS: Record<RiskTier, string> = {
  conservative: 'Scallop 60-80%, DeepBook 10-30%, Cetus 5-15%',
  moderate:     'Scallop 40-60%, DeepBook 20-40%, Cetus 10-25%',
  aggressive:   'Scallop 20-40%, DeepBook 30-50%, Cetus 20-35%',
};

export class ReasoningLayer {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, model = 'gpt-4o') {
    this.openai = new OpenAI({ apiKey });
    this.model = model;
  }

  async decide(
    vault: VaultState,
    data: ProtocolData,
    riskTier: RiskTier,
    recentMemory: string,
  ): Promise<RebalanceDecision> {
    const prompt = this.buildPrompt(vault, data, riskTier, recentMemory);

    let raw: string;
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        temperature: 0.1,  // near-deterministic for financial decisions
        max_tokens: 800,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      });
      raw = response.choices[0].message.content ?? '{}';
    } catch (err) {
      logger.error('OpenAI API call failed', { err });
      // Return conservative no-op decision on failure
      return this.noOpDecision(vault, 'AI API unavailable');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      logger.error('AI response not valid JSON', { raw });
      return this.noOpDecision(vault, 'AI returned invalid JSON');
    }

    const result = DecisionSchema.safeParse(parsed);
    if (!result.success) {
      logger.error('AI output failed Zod validation', { errors: result.error.issues, raw });
      return this.noOpDecision(vault, `Schema validation: ${result.error.issues[0]?.message}`);
    }

    logger.info('AI decision generated', {
      shouldRebalance: result.data.shouldRebalance,
      confidence: result.data.confidenceScore,
      reasoning: result.data.reasoning,
    });

    return result.data;
  }

  private buildPrompt(
    vault: VaultState,
    data: ProtocolData,
    riskTier: RiskTier,
    recentMemory: string,
  ): string {
    const aum = (Number(vault.totalAssets) / 1e6).toFixed(2); // USDC has 6 decimals
    return `
CURRENT PORTFOLIO STATE:
- Total AUM: $${aum} USDC
- Current allocations: Scallop ${vault.scallopBps / 100}% | DeepBook ${vault.deepbookBps / 100}% | Cetus ${vault.cetusBps / 100}%
- Vault paused: ${vault.paused}
- Last rebalance: ${new Date(vault.lastRebalanceMs).toISOString()}

LIVE MARKET CONDITIONS:
- Scallop USDC supply APY: ${(data.scallop.supplyApy * 100).toFixed(2)}% | utilization: ${(data.scallop.utilizationRate * 100).toFixed(1)}%
- DeepBook SUI/USDC maker fee APR: ${(data.deepbook.makerFeeApr * 100).toFixed(2)}% | spread: ${data.deepbook.spread} bps
- Cetus SUI/USDC pool APR: ${(data.cetus.poolApr * 100).toFixed(2)}%
- SUI price: $${data.prices.suiUsd} (Pyth confidence: ±${(data.prices.confidence * 100).toFixed(2)}%)

USER RISK PROFILE: ${riskTier.toUpperCase()}
Allowed ranges: ${RISK_CONSTRAINTS[riskTier]}

RECENT STRATEGY MEMORY:
${recentMemory || 'No prior context.'}

TASK: Recommend optimal allocations. Output strict JSON matching the schema.
Max concentration: 60% in any single protocol.
Only recommend shouldRebalance=true if expected improvement > 0.5% APY.
`.trim();
  }

  private noOpDecision(vault: VaultState, reason: string): RebalanceDecision {
    return {
      targetScallopBps: vault.scallopBps,
      targetDeepbookBps: vault.deepbookBps,
      targetCetusBps: vault.cetusBps,
      confidenceScore: 0,
      expectedImprovementBps: 0,
      reasoning: `No action — ${reason}`,
      riskFactors: [reason],
      shouldRebalance: false,
    };
  }
}

const SYSTEM_PROMPT = `You are AutoYield's strategy engine — a precise, risk-aware DeFi portfolio optimizer on Sui.

Your role is NOT to make predictions. Your role is to:
1. Read quantitative yield data across Scallop (lending), DeepBook (maker fees), and Cetus (AMM fees)
2. Interpret risk signals: utilization spikes, spread widening, IL exposure, price volatility
3. Recommend a reallocation that maximizes risk-adjusted yield for the user's risk tier
4. Explain your reasoning in 1-2 plain English sentences a non-crypto user can understand

You MUST output valid JSON matching this schema exactly:
{
  "targetScallopBps": <integer 0-10000>,
  "targetDeepbookBps": <integer 0-10000>,
  "targetCetusBps": <integer 0-10000>,
  "confidenceScore": <float 0.0-1.0>,
  "expectedImprovementBps": <integer, basis points of APY improvement>,
  "reasoning": <string, max 500 chars, plain English>,
  "riskFactors": [<string>, ...],
  "shouldRebalance": <boolean>
}

HARD CONSTRAINTS (never violate):
- targetScallopBps + targetDeepbookBps + targetCetusBps MUST equal exactly 10000
- No single protocol > 6000 bps (60%)
- If vault is paused, set shouldRebalance=false
- Set confidenceScore < 0.7 if data is stale (>5 min old) or high uncertainty
- Set shouldRebalance=false if expectedImprovementBps < 50`;
