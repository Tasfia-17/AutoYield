/// AutoYield Scallop Strategy — interfaces with Scallop lending protocol.
/// Deposits vault assets for supply APY, returns sCoin receipts.
/// Scallop only supports mainnet, package IDs are mainnet addresses.
module autoyield::strategy_scallop;

use sui::event;

// Scallop mainnet package (filled in at deploy time via env)
// These are the known Scallop protocol object IDs on mainnet
const SCALLOP_VERSION: address = @0xefe8b36d5b2e43728cc323298626b83177803521975b7f6f2d949db2de6a5b26;
const SCALLOP_MARKET: address = @0xa757975255146dc9686aa823b7838b507f315d704f428cbadad2f4ea061ab2d;

public struct ScallopDeposit has copy, drop {
    vault_id: ID,
    amount: u64,
    s_coin_amount: u64,
    market_id: address,
    timestamp_ms: u64,
}

public struct ScallopWithdraw has copy, drop {
    vault_id: ID,
    amount: u64,
    s_coin_burned: u64,
    timestamp_ms: u64,
}

public struct ScallopHarvest has copy, drop {
    vault_id: ID,
    yield_amount: u64,
    timestamp_ms: u64,
}

/// Emitted when the agent queries Scallop APY on-chain.
public struct ScallopApySnapshot has copy, drop {
    asset_type: vector<u8>,
    supply_apy_bps: u64, // APY in basis points
    utilization_bps: u64,
    timestamp_ms: u64,
}

// ===== Strategy interface (called from PTB) =====

/// Record a Scallop deposit event. The actual deposit happens off-chain via
/// the Scallop SDK PTB builder — this entry records it on-chain for MemWal audit.
public fun record_deposit(
    vault_id: ID,
    amount: u64,
    s_coin_amount: u64,
    timestamp_ms: u64,
) {
    event::emit(ScallopDeposit {
        vault_id,
        amount,
        s_coin_amount,
        market_id: SCALLOP_MARKET,
        timestamp_ms,
    });
}

public fun record_withdraw(
    vault_id: ID,
    amount: u64,
    s_coin_burned: u64,
    timestamp_ms: u64,
) {
    event::emit(ScallopWithdraw { vault_id, amount, s_coin_burned, timestamp_ms });
}

public fun record_harvest(
    vault_id: ID,
    yield_amount: u64,
    timestamp_ms: u64,
) {
    event::emit(ScallopHarvest { vault_id, yield_amount, timestamp_ms });
}

/// Record a point-in-time APY snapshot for on-chain verifiability.
public fun record_apy_snapshot(
    asset_type: vector<u8>,
    supply_apy_bps: u64,
    utilization_bps: u64,
    timestamp_ms: u64,
) {
    event::emit(ScallopApySnapshot {
        asset_type,
        supply_apy_bps,
        utilization_bps,
        timestamp_ms,
    });
}

// Accessors for known Scallop contract addresses
public fun market_id(): address { SCALLOP_MARKET }
public fun version_id(): address { SCALLOP_VERSION }
