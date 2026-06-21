#!/usr/bin/env bash
# deploy.sh — AutoYield deployment script
# Usage: ./scripts/deploy.sh [testnet|mainnet]
# Prerequisites: sui CLI installed, funded wallet, .env file present

set -euo pipefail

NETWORK=${1:-testnet}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CONTRACTS_DIR="$ROOT_DIR/contracts"
ENV_FILE="$ROOT_DIR/.env"

echo "╔══════════════════════════════════════╗"
echo "║      AutoYield Deployment Script     ║"
echo "║      Network: $NETWORK               ║"
echo "╚══════════════════════════════════════╝"

# ── 1. Check prerequisites ──
command -v sui &>/dev/null || { echo "❌ sui CLI not found. Install from https://docs.sui.io"; exit 1; }
command -v jq  &>/dev/null || { echo "❌ jq not found. brew install jq / apt install jq"; exit 1; }

echo "✅ Sui CLI: $(sui --version)"

# ── 2. Check active wallet ──
ACTIVE_ADDR=$(sui client active-address 2>/dev/null || echo "")
if [ -z "$ACTIVE_ADDR" ]; then
  echo "❌ No active Sui wallet. Run: sui client new-address ed25519"
  exit 1
fi
echo "✅ Active address: $ACTIVE_ADDR"

# ── 3. Check balance ──
SUI_BALANCE=$(sui client gas --json 2>/dev/null | jq -r '.[0].gasCoinValue // "0"' || echo "0")
echo "✅ SUI balance: $SUI_BALANCE MIST"
if [ "$SUI_BALANCE" -lt "100000000" ]; then
  echo "⚠️  Low balance. Visit https://faucet.sui.io to get testnet SUI"
  if [ "$NETWORK" = "testnet" ]; then
    echo "   Requesting faucet..."
    sui client faucet || true
    sleep 3
  fi
fi

# ── 4. Publish Move contracts ──
echo ""
echo "📦 Publishing Move contracts to $NETWORK..."

cd "$CONTRACTS_DIR"

# Install MVR dependencies (OpenZeppelin)
if command -v mvr &>/dev/null; then
  echo "   Installing MVR dependencies..."
  mvr install || echo "   ⚠️  MVR install failed — OZ deps may not resolve. Continuing..."
fi

PUBLISH_OUTPUT=$(sui client publish \
  --gas-budget 500000000 \
  --json 2>/dev/null || echo "{}")

if [ "$PUBLISH_OUTPUT" = "{}" ]; then
  echo "❌ Contract publish failed. Check Move.toml and contract code."
  exit 1
fi

# Extract IDs from publish output
PACKAGE_ID=$(echo "$PUBLISH_OUTPUT" | jq -r '.objectChanges[] | select(.type == "published") | .packageId' 2>/dev/null || echo "")
VAULT_ID=$(echo "$PUBLISH_OUTPUT" | jq -r '.objectChanges[] | select(.objectType | contains("::vault::Vault")) | .objectId' 2>/dev/null || echo "")
REGISTRY_ID=$(echo "$PUBLISH_OUTPUT" | jq -r '.objectChanges[] | select(.objectType | contains("::strategy_registry::StrategyRegistry")) | .objectId' 2>/dev/null || echo "")
ADMIN_CAP_ID=$(echo "$PUBLISH_OUTPUT" | jq -r '.objectChanges[] | select(.objectType | contains("::vault::AdminCap")) | .objectId' 2>/dev/null || echo "")

echo "✅ Package ID:    $PACKAGE_ID"
echo "✅ Vault ID:      $VAULT_ID"
echo "✅ Registry ID:   $REGISTRY_ID"
echo "✅ AdminCap ID:   $ADMIN_CAP_ID"

# ── 5. Set up DeepBook BalanceManager ──
echo ""
echo "📖 Creating DeepBook BalanceManager..."

# Commented out — requires deepbook CLI or custom PTB
# Run this manually after deployment:
# sui client call --package 0xdee9... --module balance_manager --function create_and_share...
echo "   ⚠️  Run scripts/setup-deepbook.ts manually after deployment (requires funded manager)"
MANAGER_ID="<run setup-deepbook.ts>"

# ── 6. Write .env ──
echo ""
echo "📝 Writing deployment addresses to .env..."

if [ ! -f "$ENV_FILE" ]; then
  cp "$ROOT_DIR/.env.example" "$ENV_FILE"
fi

update_env() {
  local key=$1 val=$2
  if grep -q "^$key=" "$ENV_FILE"; then
    sed -i "s|^$key=.*|$key=$val|" "$ENV_FILE"
  else
    echo "$key=$val" >> "$ENV_FILE"
  fi
}

update_env "SUI_NETWORK" "$NETWORK"
update_env "AUTOYIELD_PACKAGE_ID" "$PACKAGE_ID"
update_env "VAULT_ID" "$VAULT_ID"
update_env "STRATEGY_REGISTRY_ID" "$REGISTRY_ID"
update_env "NEXT_PUBLIC_VAULT_ID" "$VAULT_ID"
update_env "NEXT_PUBLIC_SUI_NETWORK" "$NETWORK"

# ── 7. Run DB migration ──
echo ""
echo "🗄️  Setting up PostgreSQL schema..."
if [ -n "${DATABASE_URL:-}" ]; then
  psql "$DATABASE_URL" -f "$ROOT_DIR/backend/src/db/schema.sql" && echo "✅ DB schema applied"
else
  echo "   ⚠️  DATABASE_URL not set. Run manually: psql \$DATABASE_URL -f backend/src/db/schema.sql"
fi

# ── 8. Summary ──
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║              Deployment Complete! 🎉             ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║  Package:  $PACKAGE_ID"
echo "║  Vault:    $VAULT_ID"
echo "║  Network:  $NETWORK"
echo "╠══════════════════════════════════════════════════╣"
echo "║  Next steps:                                     ║"
echo "║  1. Fill AGENT_PRIVATE_KEY in .env               ║"
echo "║  2. Fill GAS_SPONSOR_PRIVATE_KEY in .env         ║"
echo "║  3. Fill OPENAI_API_KEY in .env                  ║"
echo "║  4. Fill MEMWAL_DELEGATE_KEY + ACCOUNT_ID        ║"
echo "║  5. cd backend && pnpm dev                       ║"
echo "║  6. cd agent && pnpm dev                         ║"
echo "║  7. cd frontend && pnpm dev                      ║"
echo "╚══════════════════════════════════════════════════╝"
