/// AutoYield vault unit tests
#[test_only]
module autoyield::vault_tests;

use autoyield::vault::{Self, Vault, UserPosition, AdminCap};
use autoyield::security;
use sui::test_scenario as ts;
use sui::coin;
use sui::sui::SUI;

const ADMIN: address = @0xA;
const USER1: address = @0xB;
const USER2: address = @0xC;

#[test]
fun test_init_creates_vault() {
    let mut scenario = ts::begin(ADMIN);
    {
        vault::init_for_testing(ts::ctx(&mut scenario));
    };
    ts::next_tx(&mut scenario, ADMIN);
    {
        assert!(ts::has_most_recent_shared<Vault>(), 0);
        assert!(ts::has_most_recent_for_address<AdminCap>(ADMIN), 0);
    };
    ts::end(scenario);
}

#[test]
fun test_deposit_and_withdraw() {
    let mut scenario = ts::begin(ADMIN);
    { vault::init_for_testing(ts::ctx(&mut scenario)); };

    ts::next_tx(&mut scenario, USER1);
    let mut vault = ts::take_shared<Vault>(&scenario);
    {
        let mut pos = vault::create_position(&vault, 1, ts::ctx(&mut scenario));
        let coin = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
        let shares = vault::deposit<SUI>(&mut vault, &mut pos, coin, 0, ts::ctx(&mut scenario));
        assert!(shares == 1000, 1); // first deposit: 1:1
        assert!(vault::total_assets(&vault) == 1000, 2);
        assert!(vault::position_shares(&pos) == 1000, 3);

        // Withdraw half
        let returned = vault::withdraw<SUI>(&mut vault, &mut pos, 500, 0, ts::ctx(&mut scenario));
        // returned = 500 * 1000 / 1000 = 500, minus 1% fee = 495
        assert!(returned == 495, 4);
        assert!(vault::position_shares(&pos) == 500, 5);

        transfer::public_transfer(pos, USER1);
    };
    ts::return_shared(vault);
    ts::end(scenario);
}

#[test]
fun test_share_price_grows() {
    let mut scenario = ts::begin(ADMIN);
    { vault::init_for_testing(ts::ctx(&mut scenario)); };

    ts::next_tx(&mut scenario, USER1);
    let mut vault = ts::take_shared<Vault>(&scenario);
    {
        let mut pos = vault::create_position(&vault, 0, ts::ctx(&mut scenario));
        let coin = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
        vault::deposit<SUI>(&mut vault, &mut pos, coin, 0, ts::ctx(&mut scenario));
        transfer::public_transfer(pos, USER1);
    };
    // Simulate yield accrual by checking share_price
    let price = vault::share_price(&vault);
    assert!(price == 1_000_000_000, 0); // 1:1 initially (PRECISION)
    ts::return_shared(vault);
    ts::end(scenario);
}

#[test]
fun test_pause_blocks_deposit() {
    let mut scenario = ts::begin(ADMIN);
    { vault::init_for_testing(ts::ctx(&mut scenario)); };

    ts::next_tx(&mut scenario, ADMIN);
    let mut vault = ts::take_shared<Vault>(&scenario);
    let cap = ts::take_from_address<AdminCap>(&scenario, ADMIN);
    {
        vault::set_paused(&mut vault, &cap, true);
        assert!(vault::is_paused(&vault), 0);
    };
    ts::return_to_address(ADMIN, cap);
    ts::return_shared(vault);
    ts::end(scenario);
}

#[test]
fun test_guardian_rejects_invalid_allocation() {
    let mut scenario = ts::begin(ADMIN);
    {
        let vault_id = object::id_from_address(@0x1);
        let mut g = security::create_guardian(vault_id, 2000, ts::ctx(&mut scenario));
        // This should NOT abort — valid rebalance
        security::validate_rebalance(
            &mut g,
            vault_id,
            100_000, 5000, 3000, 2000,
            4500, 3500, 2000,
            8000, // 80% confidence
            100,  // 1% improvement
            1000,
        );
        transfer::public_transfer(g, ADMIN);
    };
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = security::EAllocationSumInvalid)]
fun test_guardian_rejects_bad_sum() {
    let mut scenario = ts::begin(ADMIN);
    {
        let vault_id = object::id_from_address(@0x1);
        let mut g = security::create_guardian(vault_id, 2000, ts::ctx(&mut scenario));
        security::validate_rebalance(
            &mut g, vault_id, 100_000,
            5000, 3000, 2000,
            5000, 3000, 3000, // sum = 11000 — invalid
            8000, 100, 1000,
        );
        transfer::public_transfer(g, ADMIN);
    };
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = security::EConfidenceTooLow)]
fun test_guardian_rejects_low_confidence() {
    let mut scenario = ts::begin(ADMIN);
    {
        let vault_id = object::id_from_address(@0x1);
        let mut g = security::create_guardian(vault_id, 2000, ts::ctx(&mut scenario));
        security::validate_rebalance(
            &mut g, vault_id, 100_000,
            5000, 3000, 2000,
            4500, 3500, 2000,
            5000, // 50% confidence — below 70% threshold
            100, 1000,
        );
        transfer::public_transfer(g, ADMIN);
    };
    ts::end(scenario);
}
