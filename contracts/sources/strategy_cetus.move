/// AutoYield Cetus Strategy — concentrated liquidity provision.
/// Manages CLMM positions for swap fee collection.
/// IL is monitored; agent withdraws when IL exceeds threshold.
module autoyield::strategy_cetus;

use sui::event;
use openzeppelin_math::u64::mul_div;
use openzeppelin_math::rounding;

// Cetus CLMM mainnet global config
const CETUS_GLOBAL_CONFIG: address = @0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f;

public struct CetusPositionOpened has copy, drop {
    vault_id: ID,
    pool_id: ID,
    position_id: ID,
    tick_lower: u32,
    tick_upper: u32,
    amount_a: u64,
    amount_b: u64,
    timestamp_ms: u64,
}

public struct CetusPositionClosed has copy, drop {
    vault_id: ID,
    position_id: ID,
    amount_a_received: u64,
    amount_b_received: u64,
    fees_collected_a: u64,
    fees_collected_b: u64,
    timestamp_ms: u64,
}

public struct CetusLiquidityAdded has copy, drop {
    vault_id: ID,
    position_id: ID,
    liquidity_delta: u128,
    amount_a: u64,
    amount_b: u64,
    timestamp_ms: u64,
}

/// IL monitoring event — emitted when IL exceeds agent threshold
public struct ImpermanentLossAlert has copy, drop {
    vault_id: ID,
    position_id: ID,
    il_bps: u64, // IL in basis points
    timestamp_ms: u64,
}

/// Calculate estimated IL in basis points given price ratio change.
/// il_bps ≈ 2 * sqrt(price_ratio) / (1 + price_ratio) - 1, approximated for u64.
public fun estimate_il_bps(
    price_at_entry: u64,
    current_price: u64,
): u64 {
    if (price_at_entry == 0 || current_price == 0) return 0;
    // k = current_price / price_at_entry in PRECISION units
    let precision: u64 = 1_000_000_000;
    let k = mul_div(current_price, precision, price_at_entry, rounding::down())
        .destroy_some();
    // sqrt(k) in precision units using OZ sqrt
    let sqrt_k = openzeppelin_math::u64::sqrt(k, rounding::down());
    // IL = 2*sqrt(k)/(1+k) - 1
    let numerator = mul_div(2 * sqrt_k, precision, precision + k, rounding::down())
        .destroy_some();
    if (precision > numerator) {
        mul_div(precision - numerator, 10000, precision, rounding::down())
            .destroy_some()
    } else {
        0
    }
}

public fun record_position_opened(
    vault_id: ID,
    pool_id: ID,
    position_id: ID,
    tick_lower: u32,
    tick_upper: u32,
    amount_a: u64,
    amount_b: u64,
    timestamp_ms: u64,
) {
    event::emit(CetusPositionOpened {
        vault_id, pool_id, position_id, tick_lower, tick_upper,
        amount_a, amount_b, timestamp_ms,
    });
}

public fun record_position_closed(
    vault_id: ID,
    position_id: ID,
    amount_a_received: u64,
    amount_b_received: u64,
    fees_collected_a: u64,
    fees_collected_b: u64,
    timestamp_ms: u64,
) {
    event::emit(CetusPositionClosed {
        vault_id, position_id, amount_a_received, amount_b_received,
        fees_collected_a, fees_collected_b, timestamp_ms,
    });
}

public fun record_il_alert(
    vault_id: ID,
    position_id: ID,
    il_bps: u64,
    timestamp_ms: u64,
) {
    event::emit(ImpermanentLossAlert { vault_id, position_id, il_bps, timestamp_ms });
}

public fun global_config(): address { CETUS_GLOBAL_CONFIG }
