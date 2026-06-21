/// StrategyRegistry - tracks active protocol integrations and their metadata.
/// Each strategy is independently upgradeable without touching the core vault.
module autoyield::strategy_registry;

use autoyield::vault::AdminCap;

// ===== Errors =====
const EStrategyNotFound: u64 = 0;
const EStrategyAlreadyExists: u64 = 1;
const EDuplicateProtocol: u64 = 2;

// Strategy status
const STATUS_ACTIVE: u8 = 0;
const STATUS_DEPRECATED: u8 = 1;
const STATUS_EMERGENCY: u8 = 2;

public struct StrategyConfig has store, drop {
    /// Human-readable name (e.g. "scallop-lending")
    name: vector<u8>,
    /// On-chain package ID of the strategy module
    package_id: address,
    /// Max allocation in basis points
    max_bps: u64,
    /// STATUS_ACTIVE | STATUS_DEPRECATED | STATUS_EMERGENCY
    status: u8,
    /// Current TVL tracked off-chain via events (informational)
    tvl_snapshot: u64,
    /// Last harvest timestamp ms
    last_harvest_ms: u64,
}

/// Shared registry - stores strategy configs keyed by protocol name.
public struct StrategyRegistry has key {
    id: UID,
    strategies: vector<StrategyConfig>,
    strategy_names: vector<vector<u8>>,
}

fun init(ctx: &mut TxContext) {
    let mut registry = StrategyRegistry {
        id: object::new(ctx),
        strategies: vector::empty(),
        strategy_names: vector::empty(),
    };
    // Register default strategies
    add_strategy_internal(&mut registry, b"scallop", @0x0, 6000);
    add_strategy_internal(&mut registry, b"deepbook", @0x0, 5000);
    add_strategy_internal(&mut registry, b"cetus", @0x0, 4000);
    transfer::share_object(registry);
}

fun add_strategy_internal(
    registry: &mut StrategyRegistry,
    name: vector<u8>,
    package_id: address,
    max_bps: u64,
) {
    registry.strategy_names.push_back(name);
    registry.strategies.push_back(StrategyConfig {
        name,
        package_id,
        max_bps,
        status: STATUS_ACTIVE,
        tvl_snapshot: 0,
        last_harvest_ms: 0,
    });
}

public fun register_strategy(
    registry: &mut StrategyRegistry,
    _cap: &AdminCap,
    name: vector<u8>,
    package_id: address,
    max_bps: u64,
) {
    let i = find_index(registry, &name);
    assert!(i == registry.strategies.length(), EStrategyAlreadyExists);
    add_strategy_internal(registry, name, package_id, max_bps);
}

public fun set_strategy_status(
    registry: &mut StrategyRegistry,
    _cap: &AdminCap,
    name: vector<u8>,
    status: u8,
) {
    let i = find_index(registry, &name);
    assert!(i < registry.strategies.length(), EStrategyNotFound);
    registry.strategies[i].status = status;
}

public fun update_tvl_snapshot(
    registry: &mut StrategyRegistry,
    name: vector<u8>,
    tvl: u64,
    harvest_ms: u64,
) {
    let i = find_index(registry, &name);
    assert!(i < registry.strategies.length(), EStrategyNotFound);
    registry.strategies[i].tvl_snapshot = tvl;
    registry.strategies[i].last_harvest_ms = harvest_ms;
}

public fun is_active(registry: &StrategyRegistry, name: &vector<u8>): bool {
    let i = find_index(registry, name);
    if (i >= registry.strategies.length()) return false;
    registry.strategies[i].status == STATUS_ACTIVE
}

fun find_index(registry: &StrategyRegistry, name: &vector<u8>): u64 {
    let len = registry.strategy_names.length();
    let mut i = 0;
    while (i < len) {
        if (&registry.strategy_names[i] == name) return i;
        i = i + 1;
    };
    len
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) { init(ctx) }
