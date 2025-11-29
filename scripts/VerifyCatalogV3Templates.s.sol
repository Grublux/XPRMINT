// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ItemCatalog} from "../contracts/stabilization/items/ItemCatalog.sol";
import {ItemGenerator} from "../contracts/stabilization/items/ItemGenerator.sol";

/**
 * @title VerifyCatalogV3Templates
 * @notice Verifies that CATALOG_V3 has the correct templates with updated secondary traits
 * @dev Compares templates against expected secondary trait matrix
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export CATALOG_V3=<deployed_catalog_v3_address>
 * 
 *   forge script scripts/VerifyCatalogV3Templates.s.sol --rpc-url $RPC
 */
contract VerifyCatalogV3Templates is Script {
    function _getExpectedSecondaryTrait(uint256 itemId) internal pure returns (uint8) {
        // Salinity items (0-12)
        if (itemId >= 0 && itemId <= 3) return ItemGenerator.TRAIT_PH;
        if (itemId >= 4 && itemId <= 7) return ItemGenerator.TRAIT_TEMPERATURE;
        if (itemId >= 8 && itemId <= 12) return ItemGenerator.TRAIT_FREQUENCY;
        // pH items (13-25)
        if (itemId >= 13 && itemId <= 16) return ItemGenerator.TRAIT_SALINITY;
        if (itemId >= 17 && itemId <= 20) return ItemGenerator.TRAIT_TEMPERATURE;
        if (itemId >= 21 && itemId <= 25) return ItemGenerator.TRAIT_FREQUENCY;
        // Temperature items (26-39)
        if (itemId >= 26 && itemId <= 30) return ItemGenerator.TRAIT_SALINITY;
        if (itemId >= 31 && itemId <= 34) return ItemGenerator.TRAIT_PH;
        if (itemId >= 35 && itemId <= 39) return ItemGenerator.TRAIT_FREQUENCY;
        // Frequency items (40-53)
        if (itemId >= 40 && itemId <= 44) return ItemGenerator.TRAIT_SALINITY;
        if (itemId >= 45 && itemId <= 48) return ItemGenerator.TRAIT_PH;
        if (itemId >= 49 && itemId <= 53) return ItemGenerator.TRAIT_TEMPERATURE;
        // Epics (54-63)
        return ItemGenerator.TRAIT_NONE;
    }

    function _traitIndexToName(uint8 traitIndex) internal pure returns (string memory) {
        if (traitIndex == ItemGenerator.TRAIT_SALINITY) return "Salinity";
        if (traitIndex == ItemGenerator.TRAIT_PH) return "pH";
        if (traitIndex == ItemGenerator.TRAIT_TEMPERATURE) return "Temperature";
        if (traitIndex == ItemGenerator.TRAIT_FREQUENCY) return "Frequency";
        return "None";
    }

    function run() external {
        address catalogV3 = vm.envAddress("CATALOG_V3");
        
        console2.log("=== Verify CATALOG_V3 Templates ===");
        console2.log("CATALOG_V3:", catalogV3);
        console2.log("");
        
        ItemCatalog catalog = ItemCatalog(catalogV3);
        
        uint256 templateCount = catalog.templateCount();
        console2.log("Template count:", templateCount);
        require(templateCount == 64, "Expected 64 templates");
        
        uint256 correctCount = 0;
        uint256 incorrectCount = 0;
        
        for (uint256 i = 0; i < templateCount; i++) {
            ItemCatalog.ItemTemplate memory template = catalog.getTemplate(i);
            uint8 expectedSecondary = _getExpectedSecondaryTrait(i);
            
            if (template.secondaryTrait == expectedSecondary) {
                correctCount++;
                // Only log incorrect ones to reduce noise
            } else {
                incorrectCount++;
                console2.log("Template", i, ":", template.name);
                console2.log("  Expected secondary:", _traitIndexToName(expectedSecondary));
                console2.log("  Actual secondary:", _traitIndexToName(template.secondaryTrait));
                console2.log("  Status: [ERROR]");
            }
        }
        
        console2.log("");
        console2.log("=== Verification Summary ===");
        console2.log("Total templates:", templateCount);
        console2.log("Correct:", correctCount);
        console2.log("Incorrect:", incorrectCount);
        
        if (incorrectCount == 0) {
            console2.log("");
            console2.log("[SUCCESS] All templates verified!");
        } else {
            revert("Verification failed - some templates have incorrect secondary traits");
        }
    }
}

