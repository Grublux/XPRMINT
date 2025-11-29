// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ItemCatalog} from "../contracts/stabilization/items/ItemCatalog.sol";
import {ItemGenerator} from "../contracts/stabilization/items/ItemGenerator.sol";

/**
 * @title VerifySecondaryTraits
 * @notice Script to verify that all templates have the correct secondary traits
 * @dev Compares on-chain templates against expected mappings
 */
contract VerifySecondaryTraits is Script {
    // Trait constants
    uint8 private constant TRAIT_SALINITY = ItemGenerator.TRAIT_SALINITY;      // 0
    uint8 private constant TRAIT_PH = ItemGenerator.TRAIT_PH;                  // 1
    uint8 private constant TRAIT_TEMPERATURE = ItemGenerator.TRAIT_TEMPERATURE; // 2
    uint8 private constant TRAIT_FREQUENCY = ItemGenerator.TRAIT_FREQUENCY;     // 3
    uint8 private constant TRAIT_NONE = ItemGenerator.TRAIT_NONE;               // 4

    // Expected mapping: templateId -> expected secondary trait
    mapping(uint256 => uint8) private expectedSecondaryTrait;

    function setUp() public {
        // Salinity items (0-12)
        expectedSecondaryTrait[0] = TRAIT_PH;
        expectedSecondaryTrait[1] = TRAIT_PH;
        expectedSecondaryTrait[2] = TRAIT_PH;
        expectedSecondaryTrait[3] = TRAIT_PH;
        expectedSecondaryTrait[4] = TRAIT_TEMPERATURE;
        expectedSecondaryTrait[5] = TRAIT_TEMPERATURE;
        expectedSecondaryTrait[6] = TRAIT_TEMPERATURE;
        expectedSecondaryTrait[7] = TRAIT_TEMPERATURE;
        expectedSecondaryTrait[8] = TRAIT_FREQUENCY;
        expectedSecondaryTrait[9] = TRAIT_FREQUENCY;
        expectedSecondaryTrait[10] = TRAIT_FREQUENCY;
        expectedSecondaryTrait[11] = TRAIT_FREQUENCY;
        expectedSecondaryTrait[12] = TRAIT_FREQUENCY;

        // pH items (13-25)
        expectedSecondaryTrait[13] = TRAIT_SALINITY;
        expectedSecondaryTrait[14] = TRAIT_SALINITY;
        expectedSecondaryTrait[15] = TRAIT_SALINITY;
        expectedSecondaryTrait[16] = TRAIT_SALINITY;
        expectedSecondaryTrait[17] = TRAIT_TEMPERATURE;
        expectedSecondaryTrait[18] = TRAIT_TEMPERATURE;
        expectedSecondaryTrait[19] = TRAIT_TEMPERATURE;
        expectedSecondaryTrait[20] = TRAIT_TEMPERATURE;
        expectedSecondaryTrait[21] = TRAIT_FREQUENCY;
        expectedSecondaryTrait[22] = TRAIT_FREQUENCY;
        expectedSecondaryTrait[23] = TRAIT_FREQUENCY;
        expectedSecondaryTrait[24] = TRAIT_FREQUENCY;
        expectedSecondaryTrait[25] = TRAIT_FREQUENCY;

        // Temperature items (26-39)
        expectedSecondaryTrait[26] = TRAIT_SALINITY;
        expectedSecondaryTrait[27] = TRAIT_SALINITY;
        expectedSecondaryTrait[28] = TRAIT_SALINITY;
        expectedSecondaryTrait[29] = TRAIT_SALINITY;
        expectedSecondaryTrait[30] = TRAIT_SALINITY;
        expectedSecondaryTrait[31] = TRAIT_PH;
        expectedSecondaryTrait[32] = TRAIT_PH;
        expectedSecondaryTrait[33] = TRAIT_PH;
        expectedSecondaryTrait[34] = TRAIT_PH;
        expectedSecondaryTrait[35] = TRAIT_FREQUENCY;
        expectedSecondaryTrait[36] = TRAIT_FREQUENCY;
        expectedSecondaryTrait[37] = TRAIT_FREQUENCY;
        expectedSecondaryTrait[38] = TRAIT_FREQUENCY;
        expectedSecondaryTrait[39] = TRAIT_FREQUENCY;

        // Frequency items (40-53)
        expectedSecondaryTrait[40] = TRAIT_SALINITY;
        expectedSecondaryTrait[41] = TRAIT_SALINITY;
        expectedSecondaryTrait[42] = TRAIT_SALINITY;
        expectedSecondaryTrait[43] = TRAIT_SALINITY;
        expectedSecondaryTrait[44] = TRAIT_SALINITY;
        expectedSecondaryTrait[45] = TRAIT_PH;
        expectedSecondaryTrait[46] = TRAIT_PH;
        expectedSecondaryTrait[47] = TRAIT_PH;
        expectedSecondaryTrait[48] = TRAIT_PH;
        expectedSecondaryTrait[49] = TRAIT_TEMPERATURE;
        expectedSecondaryTrait[50] = TRAIT_TEMPERATURE;
        expectedSecondaryTrait[51] = TRAIT_TEMPERATURE;
        expectedSecondaryTrait[52] = TRAIT_TEMPERATURE;
        expectedSecondaryTrait[53] = TRAIT_TEMPERATURE;

        // Epic items (54-63) should have TRAIT_NONE
        for (uint256 i = 54; i < 64; i++) {
            expectedSecondaryTrait[i] = TRAIT_NONE;
        }
    }

    function getTraitName(uint8 trait) private pure returns (string memory) {
        if (trait == TRAIT_SALINITY) return "Salinity";
        if (trait == TRAIT_PH) return "pH";
        if (trait == TRAIT_TEMPERATURE) return "Temperature";
        if (trait == TRAIT_FREQUENCY) return "Frequency";
        return "None";
    }

    function run() external view {
        // Get ItemCatalog proxy address
        address catalogProxyAddr = vm.envOr("ITEM_CATALOG_PROXY", vm.envOr("STAB_ITEM_CATALOG", address(0)));
        require(catalogProxyAddr != address(0), "ItemCatalog proxy address not set");
        console.log("ItemCatalog proxy:", catalogProxyAddr);

        ItemCatalog catalog = ItemCatalog(catalogProxyAddr);

        // Get template count
        uint256 templateCount = catalog.templateCount();
        console.log("Template count:", templateCount);
        require(templateCount >= 64, "Expected at least 64 templates");

        uint256 correctCount = 0;
        uint256 incorrectCount = 0;
        uint256 epicCount = 0;

        console.log("\n=== Verification Report ===\n");

        // Verify all templates
        for (uint256 templateId = 0; templateId < templateCount; templateId++) {
            ItemCatalog.ItemTemplate memory template = catalog.getTemplate(templateId);
            uint8 expectedTrait = expectedSecondaryTrait[templateId];
            uint8 actualTrait = template.secondaryTrait;

            // Check if this is an epic item
            bool isEpic = template.rarity == ItemGenerator.RARITY_EPIC;
            if (isEpic) {
                epicCount++;
                // Epic items should have TRAIT_NONE
                if (actualTrait == TRAIT_NONE) {
                    correctCount++;
                    console.log("Template", templateId, ":", template.name);
                    console.log("  Rarity: Epic (no secondary trait)");
                    console.log("  Status: [OK] Correct\n");
                } else {
                    incorrectCount++;
                    console.log("Template", templateId, ":", template.name);
                    console.log("  Rarity: Epic");
                    console.log("  Expected: None");
                    console.log("  Actual:", getTraitName(actualTrait));
                    console.log("  Status: [ERROR] INCORRECT\n");
                }
            } else {
                // Non-epic items should match expected mapping
                if (actualTrait == expectedTrait) {
                    correctCount++;
                    console.log("Template", templateId, ":", template.name);
                    console.log("  Primary:", getTraitName(template.primaryTrait));
                    console.log("  Secondary:", getTraitName(actualTrait));
                    console.log("  Status: [OK] Correct\n");
                } else {
                    incorrectCount++;
                    console.log("Template", templateId, ":", template.name);
                    console.log("  Primary:", getTraitName(template.primaryTrait));
                    console.log("  Expected secondary:", getTraitName(expectedTrait));
                    console.log("  Actual secondary:", getTraitName(actualTrait));
                    console.log("  Status: [ERROR] INCORRECT\n");
                }
            }
        }

        console.log("\n=== Summary ===");
        console.log("Total templates:", templateCount);
        console.log("Correct:", correctCount);
        console.log("Incorrect:", incorrectCount);
        console.log("Epic items:", epicCount);
        console.log("Non-epic items:", templateCount - epicCount);

        if (incorrectCount == 0) {
            console.log("\n[SUCCESS] All templates verified successfully!");
        } else {
            console.log("\n[ERROR] Found", incorrectCount, "templates with incorrect secondary traits");
            revert("Verification failed");
        }
    }
}

