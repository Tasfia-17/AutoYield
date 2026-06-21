/// AutoYield DeepBook Strategy — places limit orders to earn maker fees.
/// Uses DeepBook V3 BalanceManager pattern. Agent holds TradeCap for
/// autonomous order management without equivocation risk.
module autoyield::strategy_deepbook;

use sui::event;

// DeepBook V3 mainnet package
const DEEPBOOK_PACKAGE: address = @0x000000000000000000000000000000000000000000000000000000000000dee9;

public struct DeepBookOrderPlaced has copy, drop {
    vault_id: ID,
    pool_key: vector<u8>,
    client_order_id: u64,
    is_bid: bool,
    price: u64,
    quantity: u64,
    timestamp_ms: u64,
}

public struct DeepBookOrderCanceled has copy, drop {
    vault_id: ID,
    client_order_id: u64,
    timestamp_ms: u64,
}

public struct DeepBookSettlement has copy, drop {
    vault_id: ID,
    base_settled: u64,
    quote_settled: u64,
    fees_earned: u64,
    timestamp_ms: u64,
}

public struct DeepBookManagerCreated has copy, drop {
    vault_id: ID,
    manager_id: ID,
    timestamp_ms: u64,
}

/// Record order placement for audit trail
public fun record_order_placed(
    vault_id: ID,
    pool_key: vector<u8>,
    client_order_id: u64,
    is_bid: bool,
    price: u64,
    quantity: u64,
    timestamp_ms: u64,
) {
    event::emit(DeepBookOrderPlaced {
        vault_id,
        pool_key,
        client_order_id,
        is_bid,
        price,
        quantity,
        timestamp_ms,
    });
}

public fun record_order_canceled(
    vault_id: ID,
    client_order_id: u64,
    timestamp_ms: u64,
) {
    event::emit(DeepBookOrderCanceled { vault_id, client_order_id, timestamp_ms });
}

public fun record_settlement(
    vault_id: ID,
    base_settled: u64,
    quote_settled: u64,
    fees_earned: u64,
    timestamp_ms: u64,
) {
    event::emit(DeepBookSettlement {
        vault_id,
        base_settled,
        quote_settled,
        fees_earned,
        timestamp_ms,
    });
}

public fun record_manager_created(
    vault_id: ID,
    manager_id: ID,
    timestamp_ms: u64,
) {
    event::emit(DeepBookManagerCreated { vault_id, manager_id, timestamp_ms });
}

public fun package_id(): address { DEEPBOOK_PACKAGE }
