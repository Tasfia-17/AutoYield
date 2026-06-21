<div align="center">

<img src="https://em-content.zobj.net/source/apple/391/money-bag_1f4b0.png" width="96" />

# AutoYield

### Autonomous DeFAI Treasury Manager on Sui

**The agent that never sleeps, never panics, and never pays gas.**

[![Sui](https://img.shields.io/badge/Built%20on-Sui-4CA2FF?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PC9zdmc+)](https://sui.io)
[![Walrus](https://img.shields.io/badge/Memory-MemWal%20%2B%20Walrus-6366f1?style=flat-square)](https://walrus.xyz)
[![DeepBook](https://img.shields.io/badge/Liquidity-DeepBook%20v3-F59E0B?style=flat-square)](https://deepbook.tech)
[![OpenZeppelin](https://img.shields.io/badge/Math-OpenZeppelin%20Contracts-4E5EE4?style=flat-square)](https://openzeppelin.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

*Sui Overflow 2026 · Agentic Web Track · Walrus Track · DeepBook Track*

</div>

---

## 🧠 The Problem We're Solving

DeFi yields are everywhere on Sui — Scallop offers 8%+ lending APY, DeepBook generates 11%+ in maker fee rebates, Cetus gives 14%+ from concentrated liquidity. The returns are real. But to capture them, you need to:

- Monitor three protocols simultaneously, 24/7
- Rebalance manually when APYs shift (and gas is cheap enough to be worth it)
- Understand impermanent loss math, order book mechanics, and lending utilization curves
- Not panic-sell when SUI moves -15% overnight

**95% of users do none of this.** They deposit into one protocol, forget about it, and watch their peers outperform by 3–5× with active management. The other 5% burn out from monitoring dashboards all day.

The real problem isn't yield. It's **the cognitive overhead of capturing yield**.

---

## 💡 Our Solution

**AutoYield is a "set it and forget it" DeFi vault** powered by an autonomous AI agent.

1. Sign in with Google (no wallet, no seed phrase — zkLogin)
2. Deposit USDC (no gas fees — sponsored transactions)
3. The AI agent handles everything else, forever

The agent watches Scallop, DeepBook, and Cetus in real time. When the math says rebalancing improves your risk-adjusted yield by more than the gas cost, it acts. Every decision is explained in plain English and stored permanently on Walrus via MemWal — so you can audit exactly why the agent moved your money.

---

## 🏗️ How We Built It

We built AutoYield as a 5-layer system. Each layer has a single job.

```
┌─────────────────────────────────────────────────────┐
│  Layer 5 · Frontend (Next.js 14)                    │
│  Landing page → Dashboard → Agent Chat              │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  Layer 4 · AI Orchestration Engine (Node.js)        │
│  Sense → Recall → Reason → Guardrails → Execute     │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  Layer 3 · PTB Builder (Sui TypeScript SDK)         │
│  Atomic multi-protocol transactions                  │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  Layer 2 · Smart Contracts (Sui Move)               │
│  Vault · Strategies · Security · Registry           │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  Layer 1 · Protocols (Scallop · DeepBook · Cetus)   │
│  + Pyth Oracle · Walrus MemWal · zkLogin · Gas Stn  │
└─────────────────────────────────────────────────────┘
```

---

### 📦 Layer 2 — Smart Contracts (Sui Move)

This is the trust anchor. Everything on-chain is auditable and immutable.

#### `vault.move` — The Core

We use Sui's hybrid object model intentionally:

```
Vault          → Shared Object   → multi-user access, consensus path
UserPosition   → Owned Object    → parallel execution, no conflicts
AdminCap       → Owned Object    → deployer-only admin
AgentCap       → Owned Object    → agent-only rebalancing (narrow capability)
```

The key insight: **UserPositions are owned objects**. Different users depositing simultaneously never conflict, because each user mutates their own object. The Vault shared object is only touched during rebalancing — a much less frequent operation. This is a throughput pattern impossible on EVM where everything is shared state.

Share math uses **OpenZeppelin's `mul_div`** from `openzeppelin_math::u64` — the same audited library that secures $35T in onchain value. No precision loss, no rounding attacks.

```move
// Shares minted = amount * total_shares / total_assets
let shares_minted = mul_div(amount, vault.total_shares, vault.total_assets, rounding::down())
    .destroy_some();
```

#### `security.move` — The On-Chain Guardrails

Every rebalance call on-chain enforces:
- Allocations must sum to exactly 10,000 bps
- No single protocol above 60%
- Max 30% shift per rebalance
- 1-hour cooldown between rebalances
- Drawdown check against peak AUM

The contract **aborts** if any check fails. The AI cannot override this.

#### Strategy Modules

Each protocol (Scallop, DeepBook, Cetus) has its own Move module emitting structured events. This creates an on-chain audit trail that feeds directly into MemWal for agent learning.

---

### 🤖 Layer 4 — AI Orchestration Engine

The agent loop runs every 30 seconds:

```
SENSE → RECALL → REASON → GUARDRAILS → SIMULATE → EXECUTE → REMEMBER
```

#### 🔍 SENSE
The sensing layer polls Scallop (via `ScallopQuery`), DeepBook (order book state), Cetus (pool APR), and Pyth (price feeds) in parallel. Fresh data every 30s.

#### 🧠 RECALL
Before reasoning, the agent calls MemWal to retrieve the 5 most semantically similar past decisions. This means the agent *learns* — if it made a bad call at 65% Scallop utilization before, it remembers that context.

#### 🎯 REASON
We send a structured prompt to GPT-4o at **temperature 0.1** (near-deterministic for financial decisions). The model must output strict JSON:

```typescript
{
  targetScallopBps: 4500,
  targetDeepbookBps: 3500,
  targetCetusBps: 2000,
  confidenceScore: 0.87,
  expectedImprovementBps: 120,
  reasoning: "DeepBook maker rebates surged on elevated SUI volatility...",
  riskFactors: ["elevated IL risk in Cetus", "Scallop utilization at 78%"],
  shouldRebalance: true
}
```

Output is validated with **Zod** before it ever reaches the guardrails. If GPT-4o returns malformed JSON, the agent returns a safe no-op decision.

#### 🛡️ GUARDRAILS (the most important layer)

This is the answer to the question every judge will ask: *"What stops the AI from doing something stupid?"*

**9 deterministic checks, in TypeScript, that override every AI decision:**

| # | Check | What it prevents |
|---|-------|-----------------|
| 1 | Vault paused? | Acting during emergency |
| 2 | Confidence ≥ 70% | Low-certainty trades |
| 3 | Improvement ≥ 50 bps | Churning for tiny gains |
| 4 | Allocations sum to 10,000 | Math errors |
| 5 | No protocol > 60% | Concentration risk |
| 6 | Max 30% shift | Abrupt reallocation |
| 7 | 1-hour cooldown | Over-trading |
| 8 | Daily limit ≤ 24 | Runaway loops |
| 9 | Drawdown ≤ max | Stop-loss protection |

The AI **suggests**. The guardrails **decide**. This architecture is the same pattern used by Griffain, HeyAnon, and Mode Network in production.

#### ⚡ SIMULATE
Before submitting anything on-chain, we call `suiClient.devInspectTransactionBlock()` — Sui's built-in dry-run. We verify the PTB will succeed, measure exact gas cost, and check that the expected improvement justifies the gas (10× minimum ratio).

#### 📝 REMEMBER
After execution, the full decision record — market state, allocations, reasoning, gas cost, tx digest — is stored in **MemWal** with a fire-and-forget write. The agent never blocks on memory writes.

---

### ⚡ Layer 3 — Programmable Transaction Blocks

The PTB builder is where Sui's superpower becomes concrete. A full portfolio rebalance across 3 protocols happens in **one atomic transaction**:

```
Step 1: Withdraw from Scallop (if reducing allocation)
Step 2: Cancel DeepBook limit orders (if reducing allocation)
Step 3: Remove Cetus liquidity (if reducing allocation)
Step 4: Deposit to Scallop (if increasing allocation)
Step 5: Place DeepBook limit orders (if increasing allocation)
Step 6: Add Cetus concentrated liquidity (if increasing allocation)
Step 7: vault::rebalance() — update on-chain state
Step 8: Record audit events for MemWal
────────────────────────────────────────────────────────
ALL 8 STEPS = 1 TRANSACTION. If any step fails, ALL revert.
```

This is not possible on EVM. Multi-protocol atomic operations require complex custom contracts and still can't match Sui's composability.

---

### 🌊 Walrus + MemWal Integration

MemWal is the memory layer that makes this agent genuinely intelligent rather than just reactive.

**Without MemWal:** The agent makes the same mistakes repeatedly. It has no context about what it tried before.

**With MemWal:** The agent recalls semantically similar past decisions before reasoning. When Scallop utilization hits 78%, it remembers the last time this happened, what it did, and what the outcome was.

```typescript
// Before reasoning, recall relevant context
const recentMemory = await memwal.recall({
  query: `rebalance decisions scallop apy ${scallopApy}% utilization rising`
});

// Memory is injected into the AI prompt as context
// Agent says: "Last time utilization hit 78%, I increased Scallop by 10% — APY improved 1.2%"
```

Every stored memory includes: allocations, reasoning, market state at decision time, and the tx digest for on-chain verification. The full audit trail is stored on **Walrus** — decentralized, content-addressed, verifiable.

---

### 🔐 zkLogin + Gasless UX

The biggest DeFi UX problem: normal people don't have wallets.

zkLogin lets users authenticate with their Google account. Under the hood, Sui derives a unique address from the OAuth JWT — no seed phrase, no extension, no confusion.

Sponsored transactions mean users **never pay gas**. The gas station validates each request, rate-limits (10 tx/day/user), and co-signs with our sponsor keypair. Users click "Deposit" and it just works.

```
User clicks "Deposit" →
  Frontend builds unsigned TX →
  Gas Station validates + attaches gas coin →
  User signs with ephemeral zkLogin key →
  TX executes on Sui mainnet
```

---

### 🎨 Frontend — Tabibito Design System

The frontend uses the same design language as the [Tabibito](https://github.com/Tasfia-17/tabibito) travel planner:

- **Warm amber/cream palette** (`#FFFBF0` cream, `#F59E0B` amber, `#1A1A2E` ink)
- **Fredoka One** headings + **Nunito** body text
- **Glass morphism** cards with backdrop blur
- **Framer Motion** spring animations throughout
- **Diagonal sweep transitions** between pages (the `TfxOverlay` component)
- **Animated gradient background** that shifts slowly
- **Float/breathe animations** on hero elements
- **Ticker tape** with live protocol APY data

The landing page uses the exact country-card picker pattern from Tabibito — adapted into a protocol explorer where users can click between Scallop, DeepBook, and Cetus to understand each one.

---

## 🗂️ Repository Structure

```
autoyield/
├── contracts/                  # Sui Move smart contracts
│   ├── Move.toml               # OZ deps via MVR
│   ├── sources/
│   │   ├── vault.move          # Core vault (Vault, UserPosition, AdminCap, AgentCap)
│   │   ├── strategy_registry.move
│   │   ├── strategy_scallop.move
│   │   ├── strategy_deepbook.move
│   │   ├── strategy_cetus.move # IL calculation using OZ sqrt
│   │   └── security.move       # On-chain guardrails (GuardianState)
│   └── tests/
│       └── vault_tests.move    # Unit tests incl. guardrail edge cases
│
├── agent/                      # AI orchestration engine
│   └── src/
│       ├── index.ts            # Main loop: Sense→Recall→Reason→Guard→Sim→Exec→Remember
│       ├── sensing/            # Scallop/DeepBook/Cetus/Pyth data ingestion
│       ├── reasoning/          # GPT-4o with Zod output validation
│       ├── guardrails/         # 9 deterministic safety checks
│       ├── ptb/                # Atomic PTB builder + devInspect simulation
│       ├── memory/             # MemWal integration (Walrus)
│       └── types/              # Shared TypeScript types
│
├── backend/                    # REST API + async jobs
│   └── src/
│       ├── index.ts            # Express server (port 4000)
│       ├── routes/
│       │   ├── vault.ts        # GET/POST vault state, history, snapshots
│       │   ├── user.ts         # Register, profile, preferences
│       │   ├── gas.ts          # Gas station (sponsored tx co-signer)
│       │   └── chat.ts         # SSE streaming agent chat
│       ├── jobs/queues.ts      # BullMQ workers (snapshot, rebalance, gas limit)
│       ├── middleware/auth.ts  # zkLogin JWT verification
│       └── db/schema.sql       # PostgreSQL schema
│
├── frontend/                   # Next.js 14 app
│   └── src/
│       ├── app/
│       │   ├── page.tsx        # Animated landing page
│       │   └── dashboard/      # Full DeFi dashboard
│       ├── components/
│       │   ├── chat/AgentChat.tsx   # SSE streaming chat panel
│       │   └── ui/TfxOverlay.tsx   # Tabibito diagonal sweep transition
│       └── lib/
│           ├── store.ts        # Zustand global state
│           └── api.ts          # API client + SSE chat
│
├── scripts/
│   ├── deploy.sh               # One-command contract deployment
│   └── setup-deepbook.ts       # DeepBook BalanceManager + TradeCap setup
├── docker-compose.yml          # Postgres + Redis for local dev
├── .env.example                # All env vars documented
└── README.md                   # This file
```

---

## 🚀 Running AutoYield

### Prerequisites
- Node.js 20+, pnpm 9+
- Sui CLI (for contract deployment)
- Docker (for local Postgres + Redis)

### Option 1 — Frontend Demo (judges, 2 minutes)

The frontend is fully functional with realistic mock data when the backend is unavailable.

```bash
git clone https://github.com/Tasfia-17/AutoYield
cd AutoYield/frontend
pnpm install
pnpm dev
# → http://localhost:3000
```

**What to test:**
- Landing page: protocol explorer, vault simulator, earnings calculator
- `/dashboard`: APY charts, allocation pie, rebalance history
- Agent tab: ask the AI "Why did you rebalance just now?" or "What's my P&L?"
- Deposit modal: watch the PTB loading animation

### Option 2 — Full Stack

```bash
# 1. Clone
git clone https://github.com/Tasfia-17/AutoYield
cd AutoYield

# 2. Infrastructure
docker-compose up -d   # starts Postgres + Redis

# 3. Environment
cp .env.example .env
# Edit .env — required: OPENAI_API_KEY, AGENT_PRIVATE_KEY, DATABASE_URL

# 4. Install all
pnpm install

# 5. Deploy contracts (needs funded Sui testnet wallet)
chmod +x scripts/deploy.sh && ./scripts/deploy.sh testnet
# Copy printed IDs into .env

# 6. Start services
pnpm dev:backend   # API on :4000
pnpm dev:agent     # Agent loop (30s intervals)
pnpm dev:frontend  # Frontend on :3000
```

### Contract Deployment Only

```bash
cd contracts
# Install OpenZeppelin deps via MVR
mvr add @openzeppelin-move/integer-math
mvr add @openzeppelin-move/access
# Build + test
sui move build
sui move test
# Deploy
sui client publish --gas-budget 500000000
```

---

## 🔑 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | ✅ | GPT-4o for agent reasoning |
| `AGENT_PRIVATE_KEY` | ✅ | Ed25519 hex key for agent wallet |
| `GAS_SPONSOR_PRIVATE_KEY` | ✅ | Ed25519 hex key for gas station |
| `MEMWAL_DELEGATE_KEY` | ✅ | From [memory.walrus.xyz](https://memory.walrus.xyz) playground |
| `MEMWAL_ACCOUNT_ID` | ✅ | From [memory.walrus.xyz](https://memory.walrus.xyz) playground |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `AUTOYIELD_PACKAGE_ID` | ✅ (after deploy) | Published Move package ID |
| `VAULT_ID` | ✅ (after deploy) | Shared Vault object ID |
| `DEEPBOOK_MANAGER_ID` | ✅ (after setup) | DeepBook BalanceManager ID |

---

## 🏆 Why AutoYield Wins

### Judging Criteria Alignment

**Real-World Application — 50%**

The problem is concrete: DeFi yields exist but require expertise and constant attention most users don't have. AutoYield removes that barrier entirely. Sign in with Google, deposit USDC, earn optimized yield. The TAM is every crypto holder who wants yield but not complexity — that's millions of people.

**Product & UX — 20%**

zkLogin (Google sign-in) + sponsored transactions (no gas) = true web2 UX on web3. The design is polished, animated, and friendly. The agent explains every decision in plain English — "I moved 5% out of Cetus because IL risk spiked after SUI fell 8%." Users understand what's happening.

**Technical Implementation — 20%**

- Owned/Shared object hybrid for parallel deposits (Sui-native, impossible on EVM)
- Atomic 8-step PTBs for zero-partial-execution risk
- devInspect simulation before every live transaction
- OpenZeppelin audited math for all share calculations
- On-chain + off-chain guardrails in parallel
- MemWal for verifiable, persistent agent memory

**Presentation & Vision — 10%**

AutoYield is the infrastructure layer for autonomous DeFi on Sui. The roadmap is clear: multi-user vaults → institutional custody → cross-chain expansion via Wormhole. Every component is designed to scale to millions in TVL.

### Sponsor Alignment

| Sponsor | How We Use Their Tech |
|---------|-----------------------|
| 🌊 **Walrus** (Headline) | MemWal for agent memory, Seal for access control, audit trail on Walrus blobs |
| 📖 **DeepBook** (Track) | BalanceManager + TradeCap, maker limit orders, fee harvesting |
| 🛡️ **OpenZeppelin** (Prize) | `openzeppelin_math::u64::mul_div` + `sqrt`, `openzeppelin_access` for AdminCap pattern |
| 🔍 **OtterSec** (Prize) | Security-first design: circuit breaker, capability isolation, simulation before execution |
| 💰 **Scallop** (Award) | Primary lending strategy, `ScallopClient` + `ScallopQuery` SDK integration |

---

## 🔐 Security Design

**The security model has two independent layers:**

*Off-chain (TypeScript guardrails):* 9 deterministic checks before PTB construction. AI recommendations are rejected before any transaction is built.

*On-chain (security.move):* Same 9 checks re-enforced in Move. Even if the off-chain layer is bypassed (compromised agent key), the contract aborts.

Key decisions:
- Agent holds `AgentCap` (rebalance only), not `AdminCap` (full control)
- Emergency pause (`AdminCap` required) stops all operations instantly
- Gas station rate-limits sponsored transactions (10/day/user, blacklist support)
- Withdrawal size capped at 50% of vault per transaction
- OpenZeppelin `mul_div` prevents share inflation attacks

---

## 📊 Technical Metrics

| Metric | Value |
|--------|-------|
| Smart contract files | 6 Move modules |
| On-chain guardrails | 9 checks in `security.move` |
| Off-chain guardrails | 9 checks in `guardrails/index.ts` |
| Agent loop interval | 30 seconds |
| PTB steps per rebalance | Up to 8 (atomic) |
| MemWal memory types | 5 (decision, performance, preference, error, reasoning trace) |
| Test cases | 6 Move unit tests |
| API endpoints | 12 REST endpoints |

---

## 🗺️ Roadmap

**Post-Hackathon (Mainnet Launch)**
- [ ] Multi-user vault with ERC-4626-style share accounting
- [ ] Mainnet deployment + third-party audit (OtterSec)
- [ ] MoonPay/Stripe fiat on-ramp for non-crypto users

**Q3 2026**
- [ ] Flash loan arbitrage module (zero-capital atomic profit)
- [ ] Yield strategies across additional Sui protocols (Aftermath, Turbos)
- [ ] Mobile app (React Native + zkLogin)

**Q4 2026**
- [ ] Institutional custody via Scallop Obligation Key model
- [ ] Cross-chain expansion via Wormhole
- [ ] AutoYield DAO — token holders vote on strategy whitelists

---

## 👥 Team

Built for **Sui Overflow 2026** by team AutoYield.

---

<div align="center">

**Built on Sui · Powered by Walrus · Secured by OpenZeppelin**

*Set it. Forget it. Earn.*

💰

</div>
