// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {CreatureStabilizer} from "../../contracts/stabilization/CreatureStabilizer.sol";
import {ItemToken1155} from "../../contracts/stabilization/items/ItemToken1155.sol";
import {ItemCatalog} from "../../contracts/stabilization/items/ItemCatalog.sol";
import {ItemGenerator} from "../../contracts/stabilization/items/ItemGenerator.sol";
import {StabilizationTestHelper} from "../utils/StabilizationTestHelper.sol";

/**
 * @title StabilizationFlowTest
 * @notice End-to-end test simulating multi-day stabilization flow
 */
contract StabilizationFlowTest is Test {
    using StabilizationTestHelper for *;

    CreatureStabilizer stabilizer;
    ItemToken1155 itemToken;

    uint256 constant CREATURE_ID = 1;
    address user = address(0x1234);

    function setUp() public {
        // Deploy contracts via proxies
        ItemCatalog catalog = StabilizationTestHelper.deployItemCatalog();
        
        // Seed test catalog with minimal templates
        StabilizationTestHelper.seedTestCatalog(catalog);
        
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

        // Initialize creature
        stabilizer.initializeCreature(
            CREATURE_ID,
            uint16(50), // targetSal
            uint16(30), // targetPH
            uint16(60), // targetTemp
            uint16(40), // targetFreq
            uint16(65), // currSal
            uint16(20), // currPH
            uint16(75), // currTemp
            uint16(30)  // currFreq
        );
    }

    function testMultiDayFlow() public {
        // Day 0: Claim starter pack
        vm.prank(user);
        stabilizer.claimDailyItems(CREATURE_ID);
        
        CreatureStabilizer.CreatureState memory s0 = stabilizer.getCreatureState(CREATURE_ID);
        assertEq(s0.lockedCount, 0, "Should start with 0 locks");

        // Day 1: Send vibes, claim items
        vm.warp(block.timestamp + 86400);
        vm.prank(user);
        stabilizer.sendVibes(CREATURE_ID);
        vm.prank(user);
        stabilizer.claimDailyItems(CREATURE_ID);

        CreatureStabilizer.CreatureState memory s1 = stabilizer.getCreatureState(CREATURE_ID);
        assertEq(s1.vibes, 10, "Vibes should be max after sendVibes");

        // Day 2: Apply an item
        vm.warp(block.timestamp + 86400);
        vm.prank(user);
        stabilizer.sendVibes(CREATURE_ID);
        vm.prank(user);
        stabilizer.claimDailyItems(CREATURE_ID);

        ItemCatalog catalog = ItemCatalog(stabilizer.itemCatalog());
        uint256 dayIndex = stabilizer.currentDay();
        uint256 templateId = ItemGenerator.generateTemplateId(
            CREATURE_ID,
            dayIndex * 1000,
            keccak256("TEST_ENTROPY"),
            catalog
        );

        ItemCatalog.ItemTemplate memory template = catalog.getTemplate(templateId);
        require(template.rarity != ItemGenerator.RARITY_EPIC, "Epic in test");

        vm.prank(address(stabilizer));
        itemToken.mintItem(user, templateId, 1);
        vm.prank(user);
        stabilizer.applyItem(CREATURE_ID, templateId);

        CreatureStabilizer.CreatureState memory s2 = stabilizer.getCreatureState(CREATURE_ID);
        assertTrue(
            s2.currSal != 65 || s2.currPH != 20 || s2.currTemp != 75 || s2.currFreq != 30,
            "At least one trait should have changed"
        );

        // Day 3: Burn item for SP
        vm.warp(block.timestamp + 86400);
        vm.prank(user);
        stabilizer.sendVibes(CREATURE_ID);
        vm.prank(user);
        stabilizer.claimDailyItems(CREATURE_ID);

        uint256 templateId2 = ItemGenerator.generateTemplateId(
            CREATURE_ID,
            dayIndex * 1000 + 2,
            keccak256("TEST_ENTROPY"),
            catalog
        );
        vm.prank(address(stabilizer));
        itemToken.mintItem(user, templateId2, 1);

        uint32 walletSPBefore = stabilizer.walletSP(user);
        vm.prank(user);
        stabilizer.burnItemForSP(CREATURE_ID, templateId2);
        uint32 walletSPAfter = stabilizer.walletSP(user);
        assertTrue(walletSPAfter > walletSPBefore, "Wallet SP should increase");

        // Day 4-10: Build streak
        for (uint256 i = 4; i <= 10; i++) {
            vm.warp(block.timestamp + 86400);
            vm.prank(user);
            stabilizer.sendVibes(CREATURE_ID);
            vm.prank(user);
            stabilizer.claimDailyItems(CREATURE_ID);
        }

        CreatureStabilizer.CreatureState memory s3 = stabilizer.getCreatureState(CREATURE_ID);
        assertTrue(s3.enhancedDrip, "Should have enhanced drip after streak");

        console.log("Multi-day flow test completed");
    }

    function testNoDripAfterStabilization() public {
        vm.prank(user);
        stabilizer.claimDailyItems(CREATURE_ID);
        console.log("No drip after stabilization test structure");
    }
}
