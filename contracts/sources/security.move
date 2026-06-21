module autoyield::security;

use sui::event;

// ===== Constants =====
const MAX_SINGLE_WITHDRAWAL_BPS: u64 = 5000;
const MAX_REBALANCE_SHIFT_BPS: u64 = 3000;
const MAX_DAILY_REBALANCES: u64 = 24;
const DAILY_MS: u64 = 86_400_000;

// ===== Errors =====
const EMaxWithdrawExceeded: u64 = 100;
const EMaxRebalanceShiftExceeded: u64 = 101;
const EDailyLimitExceeded: u64 = 102;
const EConfidenceTooLow: u64 = 103;
const EImprovementTooSmall: u64 = 104;
const EAllocationSumInvalid: u64 = 105;
const EConcentrationTooHigh: u64 = 106;
const EDrawdownExceeded: u64 = 107;

// ===== Inline math =====
fun mul_div_down(a: u64, b: u64, c: u64): u64 {
    assert!(c > 0, EAllocationSumInvalid);
    ((a as u128) * (b as u128) / (c as u128)) as u64
}

public struct GuardianState has key, store {
    id: UID,
    vault_id: ID,
    rebalance_count_today: u64,
    window_start_ms: u64,
    violation_count: u64,
    peak_assets: u64,
    max_drawdown_bps: u64,
}

public struct GuardianApproval has copy, drop {
    vault_id: ID,
    action: vector<u8>,
    timestamp_ms: u64,
}

public fun create_guardian(vault_id: ID, max_drawdown_bps: u64, ctx: &mut TxContext): GuardianState {
    GuardianState {
        id: object::new(ctx),
        vault_id,
        rebalance_count_today: 0,
        window_start_ms: 0,
        violation_count: 0,
        peak_assets: 0,
        max_drawdown_bps,
    }
}

public fun validate_rebalance(
    guardian: &mut GuardianState,
    vault_id: ID,
    current_total_assets: u64,
    current_scallop_bps: u64,
    current_deepbook_bps: u64,
    current_cetus_bps: u64,
    new_scallop_bps: u64,
    new_deepbook_bps: u64,
    new_cetus_bps: u64,
    confidence_score_bps: u64,
    expected_improvement_bps: u64,
    clock_ms: u64,
) {
    assert!(new_scallop_bps + new_deepbook_bps + new_cetus_bps == 10000, EAllocationSumInvalid);
    assert!(confidence_score_bps >= 7000, EConfidenceTooLow);
    assert!(expected_improvement_bps >= 50, EImprovementTooSmall);
    assert!(new_scallop_bps <= 6000, EConcentrationTooHigh);
    assert!(new_deepbook_bps <= 6000, EConcentrationTooHigh);
    assert!(new_cetus_bps <= 6000, EConcentrationTooHigh);
    assert!(abs_diff(current_scallop_bps, new_scallop_bps) <= MAX_REBALANCE_SHIFT_BPS, EMaxRebalanceShiftExceeded);
    assert!(abs_diff(current_deepbook_bps, new_deepbook_bps) <= MAX_REBALANCE_SHIFT_BPS, EMaxRebalanceShiftExceeded);
    assert!(abs_diff(current_cetus_bps, new_cetus_bps) <= MAX_REBALANCE_SHIFT_BPS, EMaxRebalanceShiftExceeded);

    if (clock_ms >= guardian.window_start_ms + DAILY_MS) {
        guardian.rebalance_count_today = 0;
        guardian.window_start_ms = clock_ms;
    };
    assert!(guardian.rebalance_count_today < MAX_DAILY_REBALANCES, EDailyLimitExceeded);

    if (current_total_assets > guardian.peak_assets) {
        guardian.peak_assets = current_total_assets;
    };
    if (guardian.peak_assets > 0 && current_total_assets < guardian.peak_assets) {
        let drawdown_bps = mul_div_down(guardian.peak_assets - current_total_assets, 10000, guardian.peak_assets);
        assert!(drawdown_bps <= guardian.max_drawdown_bps, EDrawdownExceeded);
    };

    guardian.rebalance_count_today = guardian.rebalance_count_today + 1;

    event::emit(GuardianApproval { vault_id, action: b"rebalance", timestamp_ms: clock_ms });
}

public fun validate_withdrawal(vault_id: ID, amount: u64, total_assets: u64, _timestamp_ms: u64) {
    if (total_assets == 0) return;
    let pct_bps = mul_div_down(amount, 10000, total_assets);
    assert!(pct_bps <= MAX_SINGLE_WITHDRAWAL_BPS, EMaxWithdrawExceeded);
    let _ = vault_id;
}

fun abs_diff(a: u64, b: u64): u64 {
    if (a >= b) a - b else b - a
}

public fun peak_assets(g: &GuardianState): u64 { g.peak_assets }
public fun violation_count(g: &GuardianState): u64 { g.violation_count }
public fun rebalance_count_today(g: &GuardianState): u64 { g.rebalance_count_today }
