// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ItemCatalog} from "../contracts/stabilization/items/ItemCatalog.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";
import {CreatureStabilizer} from "../contracts/stabilization/CreatureStabilizer.sol";

/**
 * @title SmokeStabilizationSystem
 * @notice Read-only and optional stateful smoke tests for deployed stabilization system
 * @dev Attaches to deployed contracts and performs sanity checks
 */
contract SmokeStabilizationSystem is Script {
    // Test-only creature ID (not used in production)
    uint256 constant TEST_CREATURE_ID = 999999;

    function run() external {
        // Read deployed addresses from environment
        address stabilizerAddr = vm.envAddress("STAB_CREATURE_STABILIZER");
        address catalogAddr = vm.envAddress("STAB_ITEM_CATALOG");
        address itemTokenAddr = vm.envAddress("STAB_ITEM_TOKEN");

        console.log("=== Smoke Test: Stabilization System ===");
        console.log("Chain ID:", block.chainid);
        console.log("Block number:", block.number);
        console.log("Block timestamp:", block.timestamp);

        // Attach to contracts
        CreatureStabilizer stabilizer = CreatureStabilizer(stabilizerAddr);
        ItemCatalog catalog = ItemCatalog(catalogAddr);
        ItemToken1155 itemToken = ItemToken1155(itemTokenAddr);

        console.log("\n=== Read-Only Checks ===");

        // CreatureStabilizer configuration
        uint256 daySeconds = stabilizer.DAY_SECONDS();
        uint256 gameStart = stabilizer.GAME_START();
        console.log("DAY_SECONDS:", daySeconds);
        console.log("GAME_START:", gameStart);
        console.log("Current day (from stabilizer):", stabilizer.currentDay());

        // ItemCatalog state
        uint256 templateCount = catalog.templateCount();
        console.log("ItemCatalog templateCount:", templateCount);
        require(templateCount > 0, "Catalog is empty");

        // ItemToken1155 metadata
        address itemTokenStabilizer = itemToken.stabilizer();
        address itemTokenCatalog = itemToken.itemCatalog();
        console.log("ItemToken1155 stabilizer:", itemTokenStabilizer);
        console.log("ItemToken1155 itemCatalog:", itemTokenCatalog);

        // Sample a few templates
        console.log("\n=== Sample Templates ===");
        uint256 samplesToCheck = templateCount < 5 ? templateCount : 5;
        for (uint256 i = 0; i < samplesToCheck; i++) {
            ItemCatalog.ItemTemplate memory template = catalog.getTemplate(i);
            console.log("Template", i, ":", template.name);
            console.log("  Rarity:", template.rarity);
            console.log("  Primary trait:", template.primaryTrait);
            console.log("  Primary delta:", template.primaryDelta);
        }

        console.log("\n=== Optional Stateful Smoke Test ===");
        console.log("Using test creature ID:", TEST_CREATURE_ID);
        console.log("NOTE: This is a smoke-only test; creature ID", TEST_CREATURE_ID, "is not used in production");

        // Check if test creature is already initialized
        try stabilizer.getCreatureState(TEST_CREATURE_ID) returns (
            CreatureStabilizer.CreatureState memory state
        ) {
            if (state.targetSal > 0 || state.targetPH > 0 || state.targetTemp > 0 || state.targetFreq > 0) {
                console.log("Test creature already initialized, skipping initialization");
                console.log("Current state:");
                console.log("  currSal:", state.currSal);
                console.log("  targetSal:", state.targetSal);
                console.log("  vibes:", state.vibes);
                console.log("  lockedCount:", state.lockedCount);
            } else {
                console.log("Test creature not initialized, skipping stateful test");
                console.log("(To run stateful test, uncomment the code below)");
            }
        } catch {
            console.log("Test creature not initialized, skipping stateful test");
            console.log("(To run stateful test, uncomment the code below)");
        }

        // OPTIONAL: Uncomment below to run a stateful smoke test
        // WARNING: This will create a test creature and mint items. Only use on testnets or with a test wallet.
        /*
        vm.startBroadcast();

        // Initialize test creature with safe values
        stabilizer.initializeCreature(
            TEST_CREATURE_ID,
            uint16(50),  // targetSal
            uint16(50),  // targetPH
            uint16(50),  // targetTemp
            uint16(50),  // targetFreq
            uint16(65),  // currSal (15% offset)
            uint16(35),  // currPH (15% offset)
            uint16(65),  // currTemp (15% offset)
            uint16(35)   // currFreq (15% offset)
        );
        console.log("Test creature initialized");

        // Claim daily items (should grant starter pack)
        stabilizer.claimDailyItems(TEST_CREATURE_ID);
        console.log("Daily items claimed");

        // Read back state
        CreatureStabilizer.CreatureState memory afterState = stabilizer.getCreatureState(TEST_CREATURE_ID);
        console.log("After state:");
        console.log("  currSal:", afterState.currSal);
        console.log("  targetSal:", afterState.targetSal);
        console.log("  vibes:", afterState.vibes);
        console.log("  lockedCount:", afterState.lockedCount);

        vm.stopBroadcast();
        */

        console.log("\n=== Smoke Test Complete ===");
        console.log("All read-only checks passed");
    }
}


