-- AutoYield PostgreSQL schema
-- Run: psql $DATABASE_URL -f schema.sql

CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sui_address    TEXT NOT NULL UNIQUE,
  -- zkLogin sub (Google OAuth subject) - hashed for privacy
  oauth_sub_hash TEXT UNIQUE,
  risk_tier      TEXT NOT NULL DEFAULT 'moderate' CHECK (risk_tier IN ('conservative','moderate','aggressive')),
  position_id    TEXT,           -- on-chain UserPosition object ID
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rebalance_history (
  id                BIGSERIAL PRIMARY KEY,
  tx_digest         TEXT NOT NULL UNIQUE,
  vault_id          TEXT NOT NULL,
  scallop_bps_before  INT NOT NULL,
  deepbook_bps_before INT NOT NULL,
  cetus_bps_before    INT NOT NULL,
  scallop_bps_after   INT NOT NULL,
  deepbook_bps_after  INT NOT NULL,
  cetus_bps_after     INT NOT NULL,
  confidence_score  NUMERIC(5,4) NOT NULL,
  reasoning         TEXT,
  gas_cost_mist     BIGINT,
  executed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market_snapshots (
  id               BIGSERIAL PRIMARY KEY,
  scallop_apy      NUMERIC(8,6) NOT NULL,
  deepbook_apr     NUMERIC(8,6) NOT NULL,
  cetus_apr        NUMERIC(8,6) NOT NULL,
  sui_price_usd    NUMERIC(12,6) NOT NULL,
  total_assets     BIGINT NOT NULL,
  blended_apy      NUMERIC(8,6),
  captured_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TimescaleDB hypertable for market data (if TimescaleDB is available)
-- SELECT create_hypertable('market_snapshots', 'captured_at', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS gas_station (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sui_address      TEXT NOT NULL UNIQUE,
  -- Count of sponsored txs today
  tx_count_today   INT NOT NULL DEFAULT 0,
  window_start     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blacklisted      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_address ON users(sui_address);
CREATE INDEX IF NOT EXISTS idx_rebalance_vault ON rebalance_history(vault_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_time ON market_snapshots(captured_at DESC);
