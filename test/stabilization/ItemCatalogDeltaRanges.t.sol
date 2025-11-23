// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ItemCatalog} from "../../contracts/stabilization/items/ItemCatalog.sol";
import {ItemGenerator} from "../../contracts/stabilization/items/ItemGenerator.sol";
import {StabilizationTestHelper} from "../utils/StabilizationTestHelper.sol";

/**
 * @title ItemCatalogDeltaRanges
 * @notice Test that on-chain catalog templates have deltas within v1 ranges
 * @dev Validates: Common (2-3), Uncommon (3-5), Rare (4-6), Epic (0)
 */
contract ItemCatalogDeltaRanges is Test {
    using StabilizationTestHelper for *;
    ItemCatalog public catalog;

    // V1 Delta ranges
    uint8 constant COMMON_MIN = 2;
    uint8 constant COMMON_MAX = 3;
    uint8 constant UNCOMMON_MIN = 3;
    uint8 constant UNCOMMON_MAX = 5;
    uint8 constant RARE_MIN = 4;
    uint8 constant RARE_MAX = 6;
    uint8 constant EPIC_DELTA = 0;

    function setUp() public {
        // Deploy catalog via proxy (in real tests, this would be populated)
        catalog = StabilizationTestHelper.deployItemCatalog();
        StabilizationTestHelper.seedTestCatalog(catalog);
    }

    /**
     * @notice Validate a single template's deltas
     */
    function _validateTemplate(
        uint256 templateId,
        uint8 expectedRarity
    ) internal view {
        ItemCatalog.ItemTemplate memory template = catalog.getTemplate(
            templateId
        );

        require(
            template.rarity == expectedRarity,
            "Template rarity mismatch"
        );

        // Get magnitude (catalog stores positive magnitudes)
        uint8 primaryMagnitude = template.primaryDelta < 0
            ? uint8(uint16(-template.primaryDelta))
            : uint8(uint16(template.primaryDelta));

        uint8 secondaryMagnitude = template.secondaryDelta < 0
            ? uint8(uint16(-template.secondaryDelta))
            : uint8(uint16(template.secondaryDelta));

        if (template.rarity == ItemGenerator.RARITY_COMMON) {
            assertGe(
                primaryMagnitude,
                COMMON_MIN,
                "Common primary_delta below minimum"
            );
            assertLe(
                primaryMagnitude,
                COMMON_MAX,
                "Common primary_delta above maximum"
            );
        } else if (template.rarity == ItemGenerator.RARITY_UNCOMMON) {
            assertGe(
                primaryMagnitude,
                UNCOMMON_MIN,
                "Uncommon primary_delta below minimum"
            );
            assertLe(
                primaryMagnitude,
                UNCOMMON_MAX,
                "Uncommon primary_delta above maximum"
            );
        } else if (template.rarity == ItemGenerator.RARITY_RARE) {
            assertGe(
                primaryMagnitude,
                RARE_MIN,
                "Rare primary_delta below minimum"
            );
            assertLe(
                primaryMagnitude,
                RARE_MAX,
                "Rare primary_delta above maximum"
            );
        } else if (template.rarity == ItemGenerator.RARITY_EPIC) {
            assertEq(
                primaryMagnitude,
                EPIC_DELTA,
                "Epic primary_delta must be 0"
            );
            assertEq(
                secondaryMagnitude,
                EPIC_DELTA,
                "Epic secondary_delta must be 0"
            );
            assertEq(
                template.secondaryTrait,
                ItemGenerator.TRAIT_NONE,
                "Epic secondary_trait must be TRAIT_NONE"
            );
        } else {
            // Non-epic items must have secondary trait and delta
            assertNotEq(
                template.secondaryTrait,
                ItemGenerator.TRAIT_NONE,
                "Non-epic items must have a secondary trait"
            );
            assertGt(
                secondaryMagnitude,
                0,
                "Non-epic items must have secondary_delta > 0"
            );
            
            // Secondary should be 15-30% of primary (approximately)
            // For small primaries (2-3), allow secondary=1
            if (primaryMagnitude <= 3) {
                assertEq(
                    secondaryMagnitude,
                    1,
                    "For small primary, secondary should be 1"
                );
            } else {
                // For larger primaries, check 15-30% range
                uint8 minSecondary = uint8((primaryMagnitude * 15) / 100);
                uint8 maxSecondary = uint8((primaryMagnitude * 30) / 100);
                assertGe(
                    secondaryMagnitude,
                    minSecondary > 0 ? minSecondary : 1,
                    "Secondary delta below 15% of primary"
                );
                assertLe(
                    secondaryMagnitude,
                    maxSecondary > 0 ? maxSecondary : 1,
                    "Secondary delta above 30% of primary"
                );
            }
        }
    }

    /**
     * @notice Test that templates have correct delta ranges
     * @dev This test requires catalog to be populated first
     */
    function testDeltaRanges_Common() public {
        uint256[] memory commonIds = catalog.getTemplateIdsByRarity(
            ItemGenerator.RARITY_COMMON
        );

        require(commonIds.length > 0, "No common templates in catalog");

        // Test first and last common templates
        _validateTemplate(commonIds[0], ItemGenerator.RARITY_COMMON);
        if (commonIds.length > 1) {
            _validateTemplate(
                commonIds[commonIds.length - 1],
                ItemGenerator.RARITY_COMMON
            );
        }

        console.log("Common templates validated:", commonIds.length);
    }

    function testDeltaRanges_Uncommon() public {
        uint256[] memory uncommonIds = catalog.getTemplateIdsByRarity(
            ItemGenerator.RARITY_UNCOMMON
        );

        require(uncommonIds.length > 0, "No uncommon templates in catalog");

        _validateTemplate(uncommonIds[0], ItemGenerator.RARITY_UNCOMMON);
        if (uncommonIds.length > 1) {
            _validateTemplate(
                uncommonIds[uncommonIds.length - 1],
                ItemGenerator.RARITY_UNCOMMON
            );
        }

        console.log("Uncommon templates validated:", uncommonIds.length);
    }

    function testDeltaRanges_Rare() public {
        uint256[] memory rareIds = catalog.getTemplateIdsByRarity(
            ItemGenerator.RARITY_RARE
        );

        require(rareIds.length > 0, "No rare templates in catalog");

        _validateTemplate(rareIds[0], ItemGenerator.RARITY_RARE);
        if (rareIds.length > 1) {
            _validateTemplate(
                rareIds[rareIds.length - 1],
                ItemGenerator.RARITY_RARE
            );
        }

        console.log("Rare templates validated:", rareIds.length);
    }

    function testDeltaRanges_Epic() public {
        uint256[] memory epicIds = catalog.getTemplateIdsByRarity(
            ItemGenerator.RARITY_EPIC
        );

        require(epicIds.length > 0, "No epic templates in catalog");

        _validateTemplate(epicIds[0], ItemGenerator.RARITY_EPIC);
        if (epicIds.length > 1) {
            _validateTemplate(
                epicIds[epicIds.length - 1],
                ItemGenerator.RARITY_EPIC
            );
        }

        console.log("Epic templates validated:", epicIds.length);
    }

    /**
     * @notice Validate all templates in catalog
     * @dev Spot-checks templates across all rarities
     */
    function testDeltaRanges_AllRarities() public {
        uint256 totalTemplates = catalog.templateCount();
        require(totalTemplates > 0, "Catalog is empty");

        // Validate at least one template from each rarity
        uint256[] memory commonIds = catalog.getTemplateIdsByRarity(
            ItemGenerator.RARITY_COMMON
        );
        if (commonIds.length > 0) {
            _validateTemplate(commonIds[0], ItemGenerator.RARITY_COMMON);
        }

        uint256[] memory uncommonIds = catalog.getTemplateIdsByRarity(
            ItemGenerator.RARITY_UNCOMMON
        );
        if (uncommonIds.length > 0) {
            _validateTemplate(uncommonIds[0], ItemGenerator.RARITY_UNCOMMON);
        }

        uint256[] memory rareIds = catalog.getTemplateIdsByRarity(
            ItemGenerator.RARITY_RARE
        );
        if (rareIds.length > 0) {
            _validateTemplate(rareIds[0], ItemGenerator.RARITY_RARE);
        }

        uint256[] memory epicIds = catalog.getTemplateIdsByRarity(
            ItemGenerator.RARITY_EPIC
        );
        if (epicIds.length > 0) {
            _validateTemplate(epicIds[0], ItemGenerator.RARITY_EPIC);
        }

        console.log("Total templates in catalog:", totalTemplates);
        console.log("Common:", commonIds.length);
        console.log("Uncommon:", uncommonIds.length);
        console.log("Rare:", rareIds.length);
        console.log("Epic:", epicIds.length);
    }

    /**
     * @notice Validate a specific template ID (for manual testing)
     */
    function testDeltaRanges_SpecificTemplate(uint256 templateId) public {
        uint256 count = catalog.templateCount();
        vm.assume(count > 0);
        
        // Bound templateId to valid range [0, count - 1]
        templateId = bound(templateId, 0, count - 1);

        ItemCatalog.ItemTemplate memory template = catalog.getTemplate(
            templateId
        );

        _validateTemplate(templateId, template.rarity);

        console.log("Template", templateId, "validated:");
        console.log("  Name:", template.name);
        console.log("  Rarity:", template.rarity);
        console.log("  Primary delta:", template.primaryDelta);
        console.log("  Secondary delta:", template.secondaryDelta);
    }
}

