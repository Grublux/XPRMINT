// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ItemCatalog} from "../../contracts/stabilization/items/ItemCatalog.sol";
import {ItemToken1155} from "../../contracts/stabilization/items/ItemToken1155.sol";
import {CreatureStabilizer} from "../../contracts/stabilization/CreatureStabilizer.sol";
import {ItemGenerator} from "../../contracts/stabilization/items/ItemGenerator.sol";

/**
 * @title StabilizationTestHelper
 * @notice Helper functions for deploying stabilization contracts in tests using proxies
 */
library StabilizationTestHelper {
    /**
     * @notice Deploy and initialize ItemCatalog via proxy
     */
    function deployItemCatalog() internal returns (ItemCatalog) {
        ItemCatalog impl = new ItemCatalog();
        bytes memory initData = abi.encodeWithSelector(ItemCatalog.initialize.selector);
        // Use msg.sender as ProxyAdmin owner (in tests, this is the test contract)
        ProxyAdmin admin = new ProxyAdmin(msg.sender);
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(impl),
            address(admin),
            initData
        );
        return ItemCatalog(address(proxy));
    }

    /**
     * @notice Deploy and initialize ItemToken1155 via proxy
     */
    function deployItemToken1155(
        ItemCatalog catalog,
        string memory baseURI
    ) internal returns (ItemToken1155) {
        ItemToken1155 impl = new ItemToken1155();
        bytes memory initData = abi.encodeWithSelector(
            ItemToken1155.initialize.selector,
            baseURI,
            address(catalog)
        );
        ProxyAdmin admin = new ProxyAdmin(msg.sender);
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(impl),
            address(admin),
            initData
        );
        return ItemToken1155(address(proxy));
    }

    /**
     * @notice Deploy and initialize CreatureStabilizer via proxy
     */
    function deployCreatureStabilizer(
        ItemToken1155 itemToken,
        ItemCatalog catalog,
        uint256 daySeconds,
        bytes32 entropySeed
    ) internal returns (CreatureStabilizer) {
        CreatureStabilizer impl = new CreatureStabilizer();
        bytes memory initData = abi.encodeWithSelector(
            CreatureStabilizer.initialize.selector,
            address(itemToken),
            address(catalog),
            daySeconds,
            entropySeed
        );
        ProxyAdmin admin = new ProxyAdmin(msg.sender);
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(impl),
            address(admin),
            initData
        );
        return CreatureStabilizer(address(proxy));
    }

    /**
     * @notice Seed a minimal test catalog with templates for all rarities
     * @param catalog The ItemCatalog instance to seed
     */
    function seedTestCatalog(ItemCatalog catalog) internal {
        // Common item: Salinity +2, Temperature +1
        catalog.addTemplate(
            ItemCatalog.ItemTemplate({
                rarity: ItemGenerator.RARITY_COMMON,
                primaryTrait: ItemGenerator.TRAIT_SALINITY,
                primaryDelta: 2,
                secondaryTrait: ItemGenerator.TRAIT_TEMPERATURE,
                secondaryDelta: 1,
                imagePtr: address(0),
                name: "Test Common Item",
                description: "A common test item"
            })
        );

        // Uncommon item: pH +3, Salinity +1
        catalog.addTemplate(
            ItemCatalog.ItemTemplate({
                rarity: ItemGenerator.RARITY_UNCOMMON,
                primaryTrait: ItemGenerator.TRAIT_PH,
                primaryDelta: 3,
                secondaryTrait: ItemGenerator.TRAIT_SALINITY,
                secondaryDelta: 1,
                imagePtr: address(0),
                name: "Test Uncommon Item",
                description: "An uncommon test item"
            })
        );

        // Rare item: Temperature +4, Frequency +1
        catalog.addTemplate(
            ItemCatalog.ItemTemplate({
                rarity: ItemGenerator.RARITY_RARE,
                primaryTrait: ItemGenerator.TRAIT_TEMPERATURE,
                primaryDelta: 4,
                secondaryTrait: ItemGenerator.TRAIT_FREQUENCY,
                secondaryDelta: 1,
                imagePtr: address(0),
                name: "Test Rare Item",
                description: "A rare test item"
            })
        );

        // Epic items: No deltas (Epic logic is special)
        // Add multiple Epic templates for Day 7 generation tests
        catalog.addTemplate(
            ItemCatalog.ItemTemplate({
                rarity: ItemGenerator.RARITY_EPIC,
                primaryTrait: ItemGenerator.TRAIT_NONE,
                primaryDelta: 0,
                secondaryTrait: ItemGenerator.TRAIT_NONE,
                secondaryDelta: 0,
                imagePtr: address(0),
                name: "Test Epic Item 1",
                description: "An epic test item 1"
            })
        );
        
        catalog.addTemplate(
            ItemCatalog.ItemTemplate({
                rarity: ItemGenerator.RARITY_EPIC,
                primaryTrait: ItemGenerator.TRAIT_NONE,
                primaryDelta: 0,
                secondaryTrait: ItemGenerator.TRAIT_NONE,
                secondaryDelta: 0,
                imagePtr: address(0),
                name: "Test Epic Item 2",
                description: "An epic test item 2"
            })
        );
        
        catalog.addTemplate(
            ItemCatalog.ItemTemplate({
                rarity: ItemGenerator.RARITY_EPIC,
                primaryTrait: ItemGenerator.TRAIT_NONE,
                primaryDelta: 0,
                secondaryTrait: ItemGenerator.TRAIT_NONE,
                secondaryDelta: 0,
                imagePtr: address(0),
                name: "Test Epic Item 3",
                description: "An epic test item 3"
            })
        );
    }
}

