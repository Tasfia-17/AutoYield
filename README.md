<div align="center">

<img src="https://em-content.zobj.net/source/apple/391/money-bag_1f4b0.png" width="96" />

# AutoYield

### Autonomous DeFAI Treasury Manager on Sui

**The agent that never sleeps, never panics, and never pays gas.**

[![Sui](https://img.shields.io/badge/Built%20on-Sui-4CA2FF?style=flat-square)](https://sui.io)
[![Walrus](https://img.shields.io/badge/Memory-MemWal%20%2B%20Walrus-6366f1?style=flat-square)](https://walrus.xyz)
[![DeepBook](https://img.shields.io/badge/Liquidity-DeepBook%20v3-F59E0B?style=flat-square)](https://deepbook.tech)
[![OpenZeppelin](https://img.shields.io/badge/Math-OpenZeppelin%20Sui-4E5EE4?style=flat-square)](https://openzeppelin.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

*Sui Overflow 2026 · Agentic Web Track · Walrus Track · DeepBook Track*

</div>

<br/>

## The Problem We Are Solving

DeFi yields are everywhere on Sui. Scallop offers 8%+ lending APY, DeepBook generates 11%+ in maker fee rebates, Cetus gives 14%+ from concentrated liquidity. The returns are real. But capturing them requires:

- Monitoring three protocols simultaneously, 24/7
- Rebalancing manually when APYs shift (and only when gas makes it worthwhile)
- Understanding impermanent loss math, order book mechanics, and lending utilization curves
- Not panic-selling when SUI moves -15% overnight

95% of users do none of this. They deposit into one protocol, forget about it, and watch active managers outperform by 3x to 5x. The other 5% burn out from dashboard fatigue.

The real problem is not yield. It is the cognitive overhead of capturing yield.

<br/>

## Our Solution

AutoYield is a set-it-and-forget-it DeFi vault powered by an autonomous AI agent.

1. Sign in with Google (no wallet, no seed phrase via zkLogin)
2. Deposit USDC (no gas fees via sponsored transactions)
3. The AI agent handles everything else, forever

The agent watches Scallop, DeepBook, and Cetus in real time. When the math says rebalancing improves risk-adjusted yield more than the gas cost, it acts. Every decision is explained in plain English and stored permanently on Walrus via MemWal, so you can audit exactly why the agent moved your money.

<br/>

## How We Built It

We built AutoYield as a 5-layer system. Each layer has a single job.

```
Layer 5   Frontend (Next.js 14)
          Landing page > Dashboard > Agent Chat

Layer 4   AI Orchestration Engine (Node.js)
          Sense > Recall > Reason > Guardrails > Execute

Layer 3   PTB Builder (Sui TypeScript SDK)
          Atomic multi-protocol transactions

Layer 2   Smart Contracts (Sui Move)
          Vault · Strategies · Security · Registry

Layer 1   Protocols
          Scallop · DeepBook · Cetus · Pyth · Walrus · zkLogin
```

<br/>

### Layer 2: Smart Contracts (Sui Move)

This is the trust anchor. Everything on-chain is auditable and immutable.

#### vault.move

We use Sui's hybrid object model intentionally:

```
Vault          > Shared Object   > multi-user access, consensus path
UserPosition   > Owned Object    > parallel execution, no conflicts
AdminCap       > Owned Object    > deployer-only admin
AgentCap       > Owned Object    > agent-only rebalancing (narrow capability)
```

The key insight: UserPositions are owned objects. Different users depositing simultaneously never conflict, because each user mutates their own object. The Vault shared object is only touched during rebalancing. This throughput pattern is impossible on EVM where everything is shared state.

Share math uses OpenZeppelin's `mul_div` from `openzeppelin_math::u64`, the same audited library that secures $35T in onchain value:

```move
let shares_minted = mul_div(amount, vault.total_shares, vault.total_assets, rounding::down())
    .destroy_some();
```

#### security.move

Every rebalance call on-chain enforces:

- Allocations must sum to exactly 10,000 bps
- No single protocol above 60%
- Max 30% shift per rebalance
- 1-hour cooldown between rebalances
- Drawdown check against peak AUM

The contract aborts if any check fails. The AI cannot override this.

<br/>

### Layer 4: AI Orchestration Engine

The agent loop runs every 30 seconds:

```
SENSE > RECALL > REASON > GUARDRAILS > SIMULATE > EXECUTE > REMEMBER
```

**SENSE**
Polls Scallop (via ScallopQuery), DeepBook (order book state), Cetus (pool APR), and Pyth (price feeds) in parallel.

**RECALL**
Before reasoning, calls MemWal to retrieve the 5 most semantically similar past decisions. The agent learns from history. If it made a suboptimal call at 65% Scallop utilization before, it remembers that context.

**REASON**
Sends a structured prompt to GPT-4o at temperature 0.1 (near-deterministic for financial decisions). Output is validated with Zod before reaching guardrails:

```json
{
  "targetScallopBps": 4500,
  "targetDeepbookBps": 3500,
  "targetCetusBps": 2000,
  "confidenceScore": 0.87,
  "expectedImprovementBps": 120,
  "reasoning": "DeepBook maker rebates surged on elevated SUI volatility...",
  "shouldRebalance": true
}
```

**GUARDRAILS** (the most important layer)

9 deterministic checks that override every AI decision:

| Check | What it prevents |
|-------|-----------------|
| Vault paused? | Acting during emergency |
| Confidence >= 70% | Low-certainty trades |
| Improvement >= 50 bps | Churning for tiny gains |
| Allocations sum to 10,000 | Math errors |
| No protocol > 60% | Concentration risk |
| Max 30% shift | Abrupt reallocation |
| 1-hour cooldown | Over-trading |
| Daily limit <= 24 | Runaway loops |
| Drawdown <= max | Stop-loss protection |

The AI suggests. The guardrails decide.

**SIMULATE**
Before any on-chain submission, calls `suiClient.devInspectTransactionBlock()` (Sui's built-in dry-run). Verifies the PTB succeeds and checks that expected improvement covers gas cost at 10x minimum.

**REMEMBER**
After execution, the full decision record (market state, allocations, reasoning, gas cost, tx digest) is stored in MemWal with a fire-and-forget write.

<br/>

### Layer 3: Programmable Transaction Blocks

A full portfolio rebalance across 3 protocols in one atomic transaction:

```
Step 1: Withdraw from Scallop (if reducing allocation)
Step 2: Cancel DeepBook limit orders (if reducing allocation)
Step 3: Remove Cetus liquidity (if reducing allocation)
Step 4: Deposit to Scallop (if increasing allocation)
Step 5: Place DeepBook limit orders (if increasing allocation)
Step 6: Add Cetus concentrated liquidity (if increasing allocation)
Step 7: vault::rebalance() to update on-chain state
Step 8: Emit audit events for MemWal
ALL 8 STEPS = 1 TRANSACTION. If any step fails, ALL revert.
```

This is not possible on EVM. Multi-protocol atomic operations require complex custom contracts and still cannot match Sui's composability.

<br/>

### Walrus + MemWal Integration

MemWal is what makes this agent genuinely intelligent rather than just reactive.

Without MemWal: the agent makes the same mistakes repeatedly with no context about past behavior.

With MemWal: the agent recalls semantically similar past decisions before reasoning. When Scallop utilization hits 78%, it remembers the last time this happened, what it did, and what the outcome was.

```typescript
const recentMemory = await memwal.recall({
  query: `rebalance decisions scallop apy ${scallopApy}% utilization rising`
});
// Memory injected into AI prompt as context
```

Every stored memory includes allocations, reasoning, market state, and tx digest for on-chain verification. The full audit trail lives on Walrus.

<br/>

### zkLogin + Gasless UX

zkLogin lets users authenticate with their Google account. Sui derives a unique address from the OAuth JWT. No seed phrase, no extension, no friction.

Sponsored transactions mean users never pay gas. The gas station validates each request, rate-limits at 10 tx/day per user, and co-signs with the sponsor keypair.

```
User clicks Deposit
  > Frontend builds unsigned TX
  > Gas Station validates + attaches gas coin
  > User signs with ephemeral zkLogin key
  > TX executes on Sui
```

<br/>

### Frontend: Tabibito Design System

The UI uses the same design language as [Tabibito](https://github.com/Tasfia-17/tabibito):

- Warm amber/cream palette (`#FFFBF0` cream, `#F59E0B` amber, `#1A1A2E` ink)
- Fredoka One headings with Nunito body text
- Glass morphism cards with backdrop blur
- Framer Motion spring animations throughout
- Diagonal sweep page transitions (TfxOverlay component)
- Animated gradient background shifting slowly
- Float and breathe animations on hero elements
- Live ticker tape with real-time APY data

The landing page uses the exact protocol-card picker pattern from Tabibito's country selector, adapted so users can explore Scallop, DeepBook, and Cetus before depositing.

<br/>

## Repository Structure

```
autoyield/
├── contracts/
│   ├── Move.toml               # OZ deps via MVR
│   └── sources/
│       ├── vault.move          # Core vault (hybrid owned/shared model)
│       ├── strategy_registry.move
│       ├── strategy_scallop.move
│       ├── strategy_deepbook.move
│       ├── strategy_cetus.move # IL calculation using OZ sqrt
│       └── security.move       # On-chain guardrails
│
├── agent/
│   └── src/
│       ├── index.ts            # Main loop
│       ├── sensing/            # Protocol data ingestion
│       ├── reasoning/          # GPT-4o + Zod validation
│       ├── guardrails/         # 9 deterministic safety checks
│       ├── ptb/                # PTB builder + devInspect simulation
│       ├── memory/             # MemWal (Walrus) integration
│       └── types/              # Shared TypeScript types
│
├── backend/
│   └── src/
│       ├── routes/vault.ts     # Vault state, history, snapshots
│       ├── routes/user.ts      # Register, profile, preferences
│       ├── routes/gas.ts       # Gas station (sponsored tx)
│       ├── routes/chat.ts      # SSE streaming agent chat
│       ├── jobs/queues.ts      # BullMQ workers
│       ├── middleware/auth.ts  # zkLogin JWT verification
│       └── db/schema.sql       # PostgreSQL schema
│
├── frontend/
│   └── src/
│       ├── app/page.tsx        # Animated landing page
│       ├── app/dashboard/      # Full DeFi dashboard
│       ├── components/chat/    # SSE streaming chat panel
│       ├── components/ui/      # TfxOverlay, shared components
│       └── lib/                # Zustand store + API client
│
├── scripts/
│   ├── deploy.sh               # One-command contract deployment
│   └── setup-deepbook.ts       # DeepBook BalanceManager setup
├── docker-compose.yml          # Postgres + Redis
└── .env.example
```

<br/>

## Running AutoYield

### Option 1: Frontend Demo (2 minutes, no infra needed)

The frontend works fully with realistic mock data when the backend is unavailable. This is the fastest way for judges to evaluate the product.

```bash
git clone https://github.com/Tasfia-17/AutoYield
cd AutoYield/frontend
pnpm install
pnpm dev
```

Open http://localhost:3000

What to test:
- Landing page: protocol explorer, vault simulator, earnings calculator
- Dashboard Overview tab: APY charts, allocation pie, TVL chart, agent status
- Dashboard History tab: rebalance decisions with AI reasoning
- Dashboard Agent tab: ask "Why did you rebalance just now?" or "What is my P&L?"
- Deposit button: 3-step flow with PTB animation

### Option 2: Full Stack

```bash
git clone https://github.com/Tasfia-17/AutoYield
cd AutoYield

# Start infrastructure
docker-compose up -d

# Configure
cp .env.example .env
# Required: OPENAI_API_KEY, AGENT_PRIVATE_KEY, DATABASE_URL

# Install all packages
pnpm install

# Deploy contracts (requires funded Sui testnet wallet + sui CLI)
chmod +x scripts/deploy.sh
./scripts/deploy.sh testnet

# Start all services
pnpm dev:backend    # API on port 4000
pnpm dev:agent      # Agent loop (30s intervals)
pnpm dev:frontend   # Frontend on port 3000
```

### Contracts Only

```bash
cd contracts
mvr add @openzeppelin-move/integer-math
mvr add @openzeppelin-move/access
sui move build
sui move test
sui client publish --gas-budget 500000000
```

<br/>

## Vercel Deployment

The frontend is configured for zero-config Vercel deployment.

```bash
cd frontend
vercel
```

Set these environment variables in the Vercel dashboard:

```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_SUI_NETWORK=mainnet
NEXT_PUBLIC_VAULT_ID=0x...
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
```

<br/>

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | GPT-4o for agent reasoning |
| `AGENT_PRIVATE_KEY` | Yes | Ed25519 hex key for agent wallet |
| `GAS_SPONSOR_PRIVATE_KEY` | Yes | Ed25519 hex key for gas station |
| `MEMWAL_DELEGATE_KEY` | Yes | From memory.walrus.xyz playground |
| `MEMWAL_ACCOUNT_ID` | Yes | From memory.walrus.xyz playground |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTOYIELD_PACKAGE_ID` | After deploy | Published Move package ID |
| `VAULT_ID` | After deploy | Shared Vault object ID |
| `DEEPBOOK_MANAGER_ID` | After setup | DeepBook BalanceManager ID |

<br/>

## Why AutoYield Wins

### Judging Criteria

**Real-World Application (50%)**

The problem is concrete and quantifiable. DeFi yields exist but require expertise and constant attention most users do not have. AutoYield removes that barrier entirely. The TAM is every crypto holder who wants yield without complexity. That is millions of people.

**Product and UX (20%)**

zkLogin (Google sign-in) plus sponsored transactions (no gas) delivers true web2 UX on web3. The design is polished, animated, and friendly. The agent explains every decision in plain English. Users always understand what is happening with their money.

**Technical Implementation (20%)**

- Owned/Shared object hybrid for parallel deposits (Sui-native, impossible on EVM)
- Atomic 8-step PTBs with zero partial-execution risk
- devInspect simulation before every live transaction
- OpenZeppelin audited math for all share calculations
- Parallel on-chain and off-chain guardrail layers
- MemWal for verifiable, persistent agent memory on Walrus

**Presentation and Vision (10%)**

AutoYield is the infrastructure layer for autonomous DeFi on Sui. Every component is designed to scale to millions in TVL. The roadmap is executable: multi-user vaults, institutional custody, cross-chain expansion.

### Sponsor Alignment

| Sponsor | Integration |
|---------|-------------|
| Walrus (Headline) | MemWal for agent memory, Seal for access control, audit trail on Walrus blobs |
| DeepBook (Track) | BalanceManager + TradeCap, maker limit orders, fee harvesting |
| OpenZeppelin (Prize) | `mul_div` + `sqrt` from `openzeppelin_math`, `openzeppelin_access` pattern |
| OtterSec (Prize) | Security-first design: circuit breaker, capability isolation, simulation before execution |
| Scallop (Award) | Primary lending strategy, ScallopClient + ScallopQuery SDK integration |

<br/>

## Security Design

Two independent guardrail layers:

**Off-chain (TypeScript):** 9 deterministic checks before PTB construction. AI recommendations are rejected before any transaction is built.

**On-chain (security.move):** Same 9 checks enforced in Move. Even if the off-chain layer is bypassed (compromised agent key), the contract aborts.

Key decisions:
- Agent holds `AgentCap` (rebalance only), not `AdminCap` (full control)
- Emergency pause stops all operations instantly
- Gas station rate-limits sponsored transactions at 10/day per user
- Withdrawal size capped at 50% of vault per transaction
- OpenZeppelin `mul_div` prevents share inflation attacks

<br/>

## Technical Metrics

| Metric | Value |
|--------|-------|
| Smart contract modules | 6 |
| On-chain guardrail checks | 9 |
| Off-chain guardrail checks | 9 |
| Agent loop interval | 30 seconds |
| PTB steps per rebalance | Up to 8 (atomic) |
| MemWal memory categories | 5 |
| Move unit tests | 6 |
| REST API endpoints | 12 |

<br/>

## Roadmap

**Mainnet Launch**
- Multi-user vault with ERC-4626-style share accounting
- Third-party audit (OtterSec)
- MoonPay/Stripe fiat on-ramp

**Q3 2026**
- Flash loan arbitrage module (zero-capital atomic profit)
- Additional Sui protocols (Aftermath, Turbos)
- Mobile app (React Native + zkLogin)

**Q4 2026**
- Institutional custody via Scallop Obligation Key model
- Cross-chain expansion via Wormhole
- AutoYield DAO: token holders vote on strategy whitelists

<br/>

<div align="center">

**Built on Sui · Powered by Walrus · Secured by OpenZeppelin**

*Set it. Forget it. Earn.*

💰

</div>
