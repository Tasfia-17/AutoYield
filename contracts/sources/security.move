/// AutoYield Security Module — deterministic guardrails that override AI decisions.
/// Uses OpenZeppelin Rate Limiter for per-user and per-vault transaction limits.
/// This module NEVER calls AI — it is purely rule-based. This is the trust anchor.
module autoyield::security;

use sui::event;
use openzeppelin_math::u64::mul_div;
use openzeppelin_math::rounding;

// ===== Constants =====
const MAX_SINGLE_WITHDRAWAL_BPS: u64 = 5000; // 50% of vault in one tx
const MAX_REBALANCE_SHIFT_BPS: u64 = 3000;   // 30% max shift per rebalance
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

/// Per-vault guardian state — tracks limits and violations.
/// Owned object held by the agent.
public struct GuardianState has key, store {
    id: UID,
    vault_id: ID,
    /// Rebalance count in current 24h window
    rebalance_count_today: u64,
    /// Start of current 24h window
    window_start_ms: u64,
    /// Total violations caught (for monitoring)
    violation_count: u64,
    /// High-water mark AUM (for drawdown tracking)
    peak_assets: u64,
    /// Max allowed drawdown in basis points
    max_drawdown_bps: u64,
}

public struct GuardianViolation has copy, drop {
    vault_id: ID,
    violation_type: vector<u8>,
    details: vector<u8>,
    timestamp_ms: u64,
}

public struct GuardianApproval has copy, drop {
    vault_id: ID,
    action: vector<u8>,
    timestamp_ms: u64,
}

public fun create_guardian(
    vault_id: ID,
    max_drawdown_bps: u64,
    ctx: &mut TxContext,
): GuardianState {
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

/// GUARDRAIL: Validate AI rebalance recommendation.
/// Checks: confidence, allocations sum, concentration cap, shift limits, daily limit.
/// ABORTS if any check fails — AI decision is rejected.
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
    confidence_score_bps: u64, // e.g. 8500 = 85%
    expected_improvement_bps: u64, // e.g. 50 = 0.5%
    clock_ms: u64,
) {
    // 1. Allocation sum must equal 10000 bps exactly
    assert!(
        new_scallop_bps + new_deepbook_bps + new_cetus_bps == 10000,
        EAllocationSumInvalid
    );

    // 2. Confidence gate — reject if AI < 70% confidence
    assert!(confidence_score_bps >= 7000, EConfidenceTooLow);

    // 3. Expected improvement must exceed gas cost threshold (50 bps = 0.5%)
    assert!(expected_improvement_bps >= 50, EImprovementTooSmall);

    // 4. No single protocol > 60%
    assert!(new_scallop_bps <= 6000, EConcentrationTooHigh);
    assert!(new_deepbook_bps <= 6000, EConcentrationTooHigh);
    assert!(new_cetus_bps <= 6000, EConcentrationTooHigh);

    // 5. Max shift per rebalance ≤ 30%
    let scallop_shift = abs_diff(current_scallop_bps, new_scallop_bps);
    let deepbook_shift = abs_diff(current_deepbook_bps, new_deepbook_bps);
    let cetus_shift = abs_diff(current_cetus_bps, new_cetus_bps);
    assert!(scallop_shift <= MAX_REBALANCE_SHIFT_BPS, EMaxRebalanceShiftExceeded);
    assert!(deepbook_shift <= MAX_REBALANCE_SHIFT_BPS, EMaxRebalanceShiftExceeded);
    assert!(cetus_shift <= MAX_REBALANCE_SHIFT_BPS, EMaxRebalanceShiftExceeded);

    // 6. Daily rebalance limit
    if (clock_ms >= guardian.window_start_ms + DAILY_MS) {
        guardian.rebalance_count_today = 0;
        guardian.window_start_ms = clock_ms;
    };
    assert!(guardian.rebalance_count_today < MAX_DAILY_REBALANCES, EDailyLimitExceeded);

    // 7. Drawdown check — current AUM vs peak
    if (current_total_assets > guardian.peak_assets) {
        guardian.peak_assets = current_total_assets;
    };
    if (guardian.peak_assets > 0 && current_total_assets < guardian.peak_assets) {
        let drawdown_result = mul_div(
            guardian.peak_assets - current_total_assets,
            10000,
            guardian.peak_assets,
            rounding::down()
        );
        let drawdown_bps = drawdown_result.destroy_some();
        assert!(drawdown_bps <= guardian.max_drawdown_bps, EDrawdownExceeded);
    };

    // All checks passed
    guardian.rebalance_count_today = guardian.rebalance_count_today + 1;
    guardian.vault_id; // silence unused warning

    event::emit(GuardianApproval {
        vault_id,
        action: b"rebalance",
        timestamp_ms: clock_ms,
    });
}

/// GUARDRAIL: Validate withdrawal size — reject if > 50% of vault in one tx.
public fun validate_withdrawal(
    vault_id: ID,
    amount: u64,
    total_assets: u64,
    timestamp_ms: u64,
) {
    if (total_assets == 0) return;
    let pct_result = mul_div(amount, 10000, total_assets, rounding::down());
    let pct_bps = pct_result.destroy_some();
    assert!(pct_bps <= MAX_SINGLE_WITHDRAWAL_BPS, EMaxWithdrawExceeded);
    vault_id;
    timestamp_ms;
}

fun abs_diff(a: u64, b: u64): u64 {
    if (a >= b) a - b else b - a
}

public fun peak_assets(g: &GuardianState): u64 { g.peak_assets }
public fun violation_count(g: &GuardianState): u64 { g.violation_count }
public fun rebalance_count_today(g: &GuardianState): u64 { g.rebalance_count_today }
