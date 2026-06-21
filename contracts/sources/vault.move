module autoyield::vault;

use sui::coin::{Self, Coin};
use sui::event;

// ===== Error codes =====
const ENotAuthorized: u64 = 0;
const EVaultPaused: u64 = 1;
const EInsufficientShares: u64 = 2;
const EZeroAmount: u64 = 3;
const EInvalidAllocation: u64 = 4;
const EWithdrawExceedsPosition: u64 = 5;
const ECooldownActive: u64 = 6;

// ===== Constants =====
const PRECISION: u64 = 1_000_000_000;
const MAX_PROTOCOL_FEE_BPS: u64 = 500;
const MIN_REBALANCE_INTERVAL_MS: u64 = 3_600_000;

// ===== Inline math =====
// Computes floor(a * b / c) safely. Aborts on divide-by-zero.
fun mul_div_down(a: u64, b: u64, c: u64): u64 {
    assert!(c > 0, EInvalidAllocation);
    ((a as u128) * (b as u128) / (c as u128)) as u64
}

// ===== Core structs =====

public struct AdminCap has key, store { id: UID }

public struct AgentCap has key, store {
    id: UID,
    vault_id: ID,
}

public struct Vault has key {
    id: UID,
    total_assets: u64,
    total_shares: u64,
    scallop_bps: u64,
    deepbook_bps: u64,
    cetus_bps: u64,
    protocol_fee_bps: u64,
    fee_recipient: address,
    paused: bool,
    last_rebalance_ms: u64,
    pending_fees: u64,
    deepbook_manager_id: Option<ID>,
}

public struct UserPosition has key, store {
    id: UID,
    vault_id: ID,
    owner: address,
    shares: u64,
    cost_basis: u64,
    deposit_count: u64,
    last_action_ms: u64,
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
        scallop_bps: 5000,
        deepbook_bps: 3000,
        cetus_bps: 2000,
        protocol_fee_bps: 100,
        fee_recipient: ctx.sender(),
        paused: false,
        last_rebalance_ms: 0,
        pending_fees: 0,
        deepbook_manager_id: option::none(),
    };
    transfer::share_object(vault);
    transfer::transfer(admin_cap, ctx.sender());
}

// ===== User functions =====

public fun create_position(vault: &Vault, risk_tier: u8, ctx: &mut TxContext): UserPosition {
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

    let shares_minted = if (vault.total_shares == 0 || vault.total_assets == 0) {
        amount
    } else {
        mul_div_down(amount, vault.total_shares, vault.total_assets)
    };

    vault.total_assets = vault.total_assets + amount;
    vault.total_shares = vault.total_shares + shares_minted;
    position.shares = position.shares + shares_minted;
    position.cost_basis = position.cost_basis + amount;
    position.deposit_count = position.deposit_count + 1;
    position.last_action_ms = clock_ms;

    // Transfer coin to fee_recipient as placeholder (agent routes via PTB in production)
    transfer::public_transfer(coin, vault.fee_recipient);

    event::emit(DepositEvent {
        vault_id: object::id(vault),
        user: ctx.sender(),
        amount,
        shares_minted,
        total_assets: vault.total_assets,
    });

    shares_minted
}

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

    let amount = mul_div_down(shares_to_burn, vault.total_assets, vault.total_shares);
    let fee = mul_div_down(amount, vault.protocol_fee_bps, 10000);
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
    assert!(clock_ms >= vault.last_rebalance_ms + MIN_REBALANCE_INTERVAL_MS, ECooldownActive);

    let old_scallop = vault.scallop_bps;
    let old_deepbook = vault.deepbook_bps;
    let old_cetus = vault.cetus_bps;
    vault.scallop_bps = scallop_bps;
    vault.deepbook_bps = deepbook_bps;
    vault.cetus_bps = cetus_bps;
    vault.last_rebalance_ms = clock_ms;

    event::emit(RebalanceEvent {
        vault_id: object::id(vault),
        old_scallop_bps: old_scallop,
        old_deepbook_bps: old_deepbook,
        old_cetus_bps: old_cetus,
        new_scallop_bps: scallop_bps,
        new_deepbook_bps: deepbook_bps,
        new_cetus_bps: cetus_bps,
        agent: ctx.sender(),
    });
}

public fun set_paused(vault: &mut Vault, _cap: &AdminCap, paused: bool) {
    vault.paused = paused;
    event::emit(PauseEvent { vault_id: object::id(vault), paused });
}

public fun set_fee(vault: &mut Vault, _cap: &AdminCap, fee_bps: u64) {
    assert!(fee_bps <= MAX_PROTOCOL_FEE_BPS, EInvalidAllocation);
    vault.protocol_fee_bps = fee_bps;
}

public fun set_deepbook_manager(vault: &mut Vault, _cap: &AdminCap, manager_id: ID) {
    vault.deepbook_manager_id = option::some(manager_id);
}

public fun mint_agent_cap(vault: &Vault, _cap: &AdminCap, agent_address: address, ctx: &mut TxContext) {
    transfer::transfer(AgentCap { id: object::new(ctx), vault_id: object::id(vault) }, agent_address);
}

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

public fun share_price(vault: &Vault): u64 {
    if (vault.total_shares == 0) return PRECISION;
    mul_div_down(PRECISION, vault.total_assets, vault.total_shares)
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) { init(ctx) }
