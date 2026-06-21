/// AutoYield Vault — core shared object that holds all deposited assets and manages
/// strategy allocations. Uses Sui's hybrid object model: Vault is shared (multi-user
/// consensus), UserPosition is owned (parallel deposit/withdraw without conflicts).
module autoyield::vault;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::event;
use sui::sui::SUI;
use openzeppelin_math::u64::{mul_div};
use openzeppelin_math::rounding;

// ===== Error codes =====
const ENotAuthorized: u64 = 0;
const EVaultPaused: u64 = 1;
const EInsufficientShares: u64 = 2;
const EZeroAmount: u64 = 3;
const EInvalidAllocation: u64 = 4;
const EWithdrawExceedsPosition: u64 = 5;
const ECooldownActive: u64 = 6;

// ===== Constants =====
const PRECISION: u64 = 1_000_000_000; // 1e9 — matches Sui coin precision
const MAX_PROTOCOL_FEE_BPS: u64 = 500; // 5% max
const MIN_REBALANCE_INTERVAL_MS: u64 = 3_600_000; // 1 hour in ms

// ===== Core structs =====

/// Capability to administer the vault (pause, rebalance, upgrade strategies).
/// Owned by the protocol deployer. Can be transferred to multi-sig.
public struct AdminCap has key, store {
    id: UID,
}

/// Agent capability — narrower than AdminCap, only allows rebalancing.
/// Transferred to the AI agent's hot wallet.
public struct AgentCap has key, store {
    id: UID,
    vault_id: ID,
}

/// The main vault shared object. Holds assets across all strategies.
/// Shared so multiple users can deposit/withdraw concurrently.
public struct Vault has key {
    id: UID,
    /// Total assets under management in base units
    total_assets: u64,
    /// Total vault shares outstanding
    total_shares: u64,
    /// Current strategy allocations in basis points (must sum to 10_000)
    scallop_bps: u64,
    deepbook_bps: u64,
    cetus_bps: u64,
    /// Protocol fee in basis points (e.g. 100 = 1%)
    protocol_fee_bps: u64,
    /// Fee recipient address
    fee_recipient: address,
    /// Emergency pause flag — blocks all deposits/withdrawals/rebalances
    paused: bool,
    /// Timestamp of last rebalance (epoch ms)
    last_rebalance_ms: u64,
    /// Accumulated uncollected fees in USDC (base units)
    pending_fees: u64,
    /// DeepBook balance manager ID stored on-chain for agent reference
    deepbook_manager_id: Option<ID>,
}

/// Per-user position — OWNED object for parallel execution.
/// Different users' positions never conflict, enabling high throughput.
public struct UserPosition has key, store {
    id: UID,
    vault_id: ID,
    owner: address,
    /// Shares held by this user
    shares: u64,
    /// Cost basis in USDC base units (for P&L calculation)
    cost_basis: u64,
    /// Deposit history count
    deposit_count: u64,
    /// Timestamp of last action (epoch ms)
    last_action_ms: u64,
    /// Risk tier: 0=Conservative, 1=Moderate, 2=Aggressive
    risk_tier: u8,
}

// ===== Events =====

public struct DepositEvent has copy, drop {
    vault_id: ID,
    user: address,
    amount: u64,
    shares_minted: u64,
    total_assets: u64,
}

public struct WithdrawEvent has copy, drop {
    vault_id: ID,
    user: address,
    amount: u64,
    shares_burned: u64,
    total_assets: u64,
}

public struct RebalanceEvent has copy, drop {
    vault_id: ID,
    old_scallop_bps: u64,
    old_deepbook_bps: u64,
    old_cetus_bps: u64,
    new_scallop_bps: u64,
    new_deepbook_bps: u64,
    new_cetus_bps: u64,
    agent: address,
}

public struct PauseEvent has copy, drop {
    vault_id: ID,
    paused: bool,
}

// ===== Init =====

fun init(ctx: &mut TxContext) {
    let admin_cap = AdminCap { id: object::new(ctx) };
    let vault = Vault {
        id: object::new(ctx),
        total_assets: 0,
        total_shares: 0,
        scallop_bps: 5000,   // 50% Scallop
        deepbook_bps: 3000,  // 30% DeepBook
        cetus_bps: 2000,     // 20% Cetus
        protocol_fee_bps: 100, // 1%
        fee_recipient: ctx.sender(),
        paused: false,
        last_rebalance_ms: 0,
        pending_fees: 0,
        deepbook_manager_id: option::none(),
    };
    transfer::share_object(vault);
    transfer::transfer(admin_cap, ctx.sender());
}

// ===== User-facing functions =====

/// Create a new UserPosition for the calling address.
public fun create_position(
    vault: &Vault,
    risk_tier: u8,
    ctx: &mut TxContext,
): UserPosition {
    assert!(risk_tier <= 2, EInvalidAllocation);
    UserPosition {
        id: object::new(ctx),
        vault_id: object::id(vault),
        owner: ctx.sender(),
        shares: 0,
        cost_basis: 0,
        deposit_count: 0,
        last_action_ms: 0,
        risk_tier,
    }
}

/// Deposit USDC (or any coin T) into the vault, mint shares to UserPosition.
/// Uses OpenZeppelin mul_div for precision: shares = amount * total_shares / total_assets
public fun deposit<T>(
    vault: &mut Vault,
    position: &mut UserPosition,
    coin: Coin<T>,
    clock_ms: u64,
    ctx: &mut TxContext,
): u64 {
    assert!(!vault.paused, EVaultPaused);
    assert!(position.vault_id == object::id(vault), ENotAuthorized);
    assert!(position.owner == ctx.sender(), ENotAuthorized);

    let amount = coin.value();
    assert!(amount > 0, EZeroAmount);

    // Calculate shares to mint using OZ mul_div to avoid precision loss
    let shares_minted = if (vault.total_shares == 0 || vault.total_assets == 0) {
        amount // 1:1 for first deposit
    } else {
        let result = mul_div(amount, vault.total_shares, vault.total_assets, rounding::down());
        result.destroy_some()
    };

    // Update vault state
    vault.total_assets = vault.total_assets + amount;
    vault.total_shares = vault.total_shares + shares_minted;

    // Update position
    position.shares = position.shares + shares_minted;
    position.cost_basis = position.cost_basis + amount;
    position.deposit_count = position.deposit_count + 1;
    position.last_action_ms = clock_ms;

    // Destroy coin (in production this goes to strategy allocations via PTB)
    coin::destroy_zero(coin::split(&mut coin, 0, ctx));
    transfer::public_transfer(coin, vault.fee_recipient); // placeholder — agent routes this

    event::emit(DepositEvent {
        vault_id: object::id(vault),
        user: ctx.sender(),
        amount,
        shares_minted,
        total_assets: vault.total_assets,
    });

    shares_minted
}

/// Withdraw from vault by burning shares, returns asset amount.
public fun withdraw<T>(
    vault: &mut Vault,
    position: &mut UserPosition,
    shares_to_burn: u64,
    clock_ms: u64,
    ctx: &mut TxContext,
): u64 {
    assert!(!vault.paused, EVaultPaused);
    assert!(position.vault_id == object::id(vault), ENotAuthorized);
    assert!(position.owner == ctx.sender(), ENotAuthorized);
    assert!(position.shares >= shares_to_burn, EWithdrawExceedsPosition);
    assert!(shares_to_burn > 0, EZeroAmount);

    // Calculate asset amount: amount = shares * total_assets / total_shares
    let result = mul_div(shares_to_burn, vault.total_assets, vault.total_shares, rounding::down());
    let amount = result.destroy_some();

    // Deduct protocol fee
    let fee_result = mul_div(amount, vault.protocol_fee_bps, 10000, rounding::down());
    let fee = fee_result.destroy_some();
    let net_amount = amount - fee;

    vault.pending_fees = vault.pending_fees + fee;
    vault.total_assets = vault.total_assets - amount;
    vault.total_shares = vault.total_shares - shares_to_burn;
    position.shares = position.shares - shares_to_burn;
    position.last_action_ms = clock_ms;

    event::emit(WithdrawEvent {
        vault_id: object::id(vault),
        user: ctx.sender(),
        amount: net_amount,
        shares_burned: shares_to_burn,
        total_assets: vault.total_assets,
    });

    net_amount
}

// ===== Agent/Admin functions =====

/// Update strategy allocations. Called by agent after AI decision + guardrails approval.
/// Enforces: allocations sum to 10000 bps, min cooldown between rebalances.
public fun rebalance(
    vault: &mut Vault,
    _cap: &AgentCap,
    scallop_bps: u64,
    deepbook_bps: u64,
    cetus_bps: u64,
    clock_ms: u64,
    ctx: &TxContext,
) {
    assert!(!vault.paused, EVaultPaused);
    assert!(_cap.vault_id == object::id(vault), ENotAuthorized);
    assert!(scallop_bps + deepbook_bps + cetus_bps == 10000, EInvalidAllocation);
    assert!(
        clock_ms >= vault.last_rebalance_ms + MIN_REBALANCE_INTERVAL_MS,
        ECooldownActive
    );

    let old = (vault.scallop_bps, vault.deepbook_bps, vault.cetus_bps);

    vault.scallop_bps = scallop_bps;
    vault.deepbook_bps = deepbook_bps;
    vault.cetus_bps = cetus_bps;
    vault.last_rebalance_ms = clock_ms;

    event::emit(RebalanceEvent {
        vault_id: object::id(vault),
        old_scallop_bps: old.0,
        old_deepbook_bps: old.1,
        old_cetus_bps: old.2,
        new_scallop_bps: scallop_bps,
        new_deepbook_bps: deepbook_bps,
        new_cetus_bps: cetus_bps,
        agent: ctx.sender(),
    });
}

/// Emergency circuit breaker — pauses/unpauses all vault operations.
public fun set_paused(vault: &mut Vault, _cap: &AdminCap, paused: bool) {
    vault.paused = paused;
    event::emit(PauseEvent { vault_id: object::id(vault), paused });
}

/// Update protocol fee — capped at MAX_PROTOCOL_FEE_BPS.
public fun set_fee(vault: &mut Vault, _cap: &AdminCap, fee_bps: u64) {
    assert!(fee_bps <= MAX_PROTOCOL_FEE_BPS, EInvalidAllocation);
    vault.protocol_fee_bps = fee_bps;
}

/// Register the DeepBook BalanceManager ID on-chain for agent reference.
public fun set_deepbook_manager(vault: &mut Vault, _cap: &AdminCap, manager_id: ID) {
    vault.deepbook_manager_id = option::some(manager_id);
}

/// Mint an AgentCap tied to this vault — given to the AI agent's signing key.
public fun mint_agent_cap(
    vault: &Vault,
    _cap: &AdminCap,
    agent_address: address,
    ctx: &mut TxContext,
) {
    let agent_cap = AgentCap {
        id: object::new(ctx),
        vault_id: object::id(vault),
    };
    transfer::transfer(agent_cap, agent_address);
}

/// Collect accumulated fees to fee_recipient.
public fun collect_fees(vault: &mut Vault, _cap: &AdminCap): u64 {
    let amount = vault.pending_fees;
    vault.pending_fees = 0;
    amount
}

// ===== View functions =====

public fun total_assets(vault: &Vault): u64 { vault.total_assets }
public fun total_shares(vault: &Vault): u64 { vault.total_shares }
public fun is_paused(vault: &Vault): bool { vault.paused }
public fun allocations(vault: &Vault): (u64, u64, u64) {
    (vault.scallop_bps, vault.deepbook_bps, vault.cetus_bps)
}
public fun position_shares(pos: &UserPosition): u64 { pos.shares }
public fun position_owner(pos: &UserPosition): address { pos.owner }

/// Calculate current share value in asset terms.
public fun share_price(vault: &Vault): u64 {
    if (vault.total_shares == 0) return PRECISION;
    let result = mul_div(PRECISION, vault.total_assets, vault.total_shares, rounding::down());
    result.destroy_some()
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) { init(ctx) }
