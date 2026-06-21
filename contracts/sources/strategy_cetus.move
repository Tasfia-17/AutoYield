module autoyield::strategy_cetus;

use sui::event;

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

public struct ImpermanentLossAlert has copy, drop {
    vault_id: ID,
    position_id: ID,
    il_bps: u64,
    timestamp_ms: u64,
}

// Integer square root (floor) using Newton's method
fun isqrt(n: u64): u64 {
    if (n == 0) return 0;
    let mut x = n;
    let mut y = (x + 1) / 2;
    while (y < x) {
        x = y;
        y = (x + n / x) / 2;
    };
    x
}

/// Estimate IL in basis points given price change.
public fun estimate_il_bps(price_at_entry: u64, current_price: u64): u64 {
    if (price_at_entry == 0 || current_price == 0) return 0;
    let precision: u64 = 1_000_000_000;
    // k = current_price / price_at_entry scaled by precision
    let k = ((current_price as u128) * (precision as u128) / (price_at_entry as u128)) as u64;
    let sqrt_k = isqrt(k); // sqrt of (k * precision^0) -- already scaled
    // IL = 2*sqrt(k)/(1+k) - 1, all in precision units
    // numerator = 2 * sqrt_k (in sqrt-precision units, i.e. precision^0.5)
    // We scale: sqrt_k is sqrt of (k scaled by precision), so sqrt_k ~ sqrt(k) * sqrt(precision)
    let sqrt_precision = isqrt(precision); // = 31622
    // normalize sqrt_k to precision scale
    let sqrt_k_norm = ((sqrt_k as u128) * (precision as u128) / (sqrt_precision as u128)) as u64;
    let denom = precision + k;
    if (denom == 0) return 0;
    let numerator = (2 * (sqrt_k_norm as u128) * (precision as u128) / (denom as u128)) as u64;
    if (precision > numerator) {
        (((precision - numerator) as u128) * 10000 / (precision as u128)) as u64
    } else {
        0
    }
}

public fun record_position_opened(
    vault_id: ID, pool_id: ID, position_id: ID,
    tick_lower: u32, tick_upper: u32,
    amount_a: u64, amount_b: u64, timestamp_ms: u64,
) {
    event::emit(CetusPositionOpened { vault_id, pool_id, position_id, tick_lower, tick_upper, amount_a, amount_b, timestamp_ms });
}

public fun record_position_closed(
    vault_id: ID, position_id: ID,
    amount_a_received: u64, amount_b_received: u64,
    fees_collected_a: u64, fees_collected_b: u64, timestamp_ms: u64,
) {
    event::emit(CetusPositionClosed { vault_id, position_id, amount_a_received, amount_b_received, fees_collected_a, fees_collected_b, timestamp_ms });
}

public fun record_il_alert(vault_id: ID, position_id: ID, il_bps: u64, timestamp_ms: u64) {
    event::emit(ImpermanentLossAlert { vault_id, position_id, il_bps, timestamp_ms });
}

public fun global_config(): address { CETUS_GLOBAL_CONFIG }
