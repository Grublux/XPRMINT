// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CreatureStabilizer} from "../../contracts/stabilization/CreatureStabilizer.sol";
import {ItemToken1155} from "../../contracts/stabilization/items/ItemToken1155.sol";
import {ItemCatalog} from "../../contracts/stabilization/items/ItemCatalog.sol";
import {StabilizationTestHelper} from "../utils/StabilizationTestHelper.sol";

/**
 * @title InitializeCreatureUnit
 * @notice Minimal unit test to isolate initializeCreature arithmetic underflow
 */
contract InitializeCreatureUnit is Test {
    using StabilizationTestHelper for *;

    function deployFullSystemForTest() internal returns (
        CreatureStabilizer stabilizer,
        ItemToken1155 itemToken,
        ItemCatalog catalog
    ) {
        catalog = StabilizationTestHelper.deployItemCatalog();
        itemToken = StabilizationTestHelper.deployItemToken1155(
            catalog,
            "https://api.test.com/{id}.json"
        );
        stabilizer = StabilizationTestHelper.deployCreatureStabilizer(
            itemToken,
            catalog,
            86400, // 1 day
            keccak256("TEST_ENTROPY")
        );
        itemToken.setStabilizer(address(stabilizer));
    }

    function test_initializeCreature_simple() public {
        // Deploy via helper so proxy + initialize() is correct
        (CreatureStabilizer stabilizer,,) = deployFullSystemForTest();
        
        // Initialize with values that clearly respect the 5% band rule
        // Traits are 0-100, so target = 50, current = 30 = 40% offset, well above 5% minimum
        stabilizer.initializeCreature(
            1,              // creatureId
            uint16(50),     // targetSal (50%)
            uint16(50),     // targetPH (50%)
            uint16(50),     // targetTemp (50%)
            uint16(50),     // targetFreq (50%)
            uint16(30),     // currSal (30% - 40% off)
            uint16(70),     // currPH (70% - 40% off)
            uint16(30),     // currTemp (30% - 40% off)
            uint16(70)      // currFreq (70% - 40% off)
        );
        
        // If we get here, no underflow occurred
        assertTrue(true);
    }
}

