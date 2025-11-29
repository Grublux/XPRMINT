// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ItemCatalog} from "../contracts/stabilization/items/ItemCatalog.sol";
import {ItemGenerator} from "../contracts/stabilization/items/ItemGenerator.sol";

/**
 * @title SeedCatalogV3FromV1
 * @notice Migrates all 64 templates from CATALOG_V1 to CATALOG_V3 with updated secondary traits
 * @dev Reads templates from CATALOG_V1 (read-only) and writes to CATALOG_V3 with new secondary trait matrix
 * 
 * Secondary Trait Mapping:
 * - Items 0-3: Salinity → pH (1)
 * - Items 4-7: Salinity → Temperature (2)
 * - Items 8-12: Salinity → Frequency (3)
 * - Items 13-16: pH → Salinity (0)
 * - Items 17-20: pH → Temperature (2)
 * - Items 21-25: pH → Frequency (3)
 * - Items 26-30: Temperature → Salinity (0)
 * - Items 31-34: Temperature → pH (1)
 * - Items 35-39: Temperature → Frequency (3)
 * - Items 40-44: Frequency → Salinity (0)
 * - Items 45-48: Frequency → pH (1)
 * - Items 49-53: Frequency → Temperature (2)
 * - Items 54-63: Epics (no secondary trait, unchanged)
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export CATALOG_V1=0x06266255ee081AcA64328dE8fcc939923eE6e8c8
 *   export CATALOG_V3=<deployed_catalog_v3_address>
 * 
 *   forge script scripts/SeedCatalogV3FromV1.s.sol --rpc-url $RPC --broadcast
 */
contract SeedCatalogV3FromV1 is Script {
    // Secondary trait mapping based on item ID ranges
    function _getNewSecondaryTrait(uint256 itemId) internal pure returns (uint8) {
        // Salinity items (0-12)
        if (itemId >= 0 && itemId <= 3) {
            return ItemGenerator.TRAIT_PH; // 1
        } else if (itemId >= 4 && itemId <= 7) {
            return ItemGenerator.TRAIT_TEMPERATURE; // 2
        } else if (itemId >= 8 && itemId <= 12) {
            return ItemGenerator.TRAIT_FREQUENCY; // 3
        }
        // pH items (13-25)
        else if (itemId >= 13 && itemId <= 16) {
            return ItemGenerator.TRAIT_SALINITY; // 0
        } else if (itemId >= 17 && itemId <= 20) {
            return ItemGenerator.TRAIT_TEMPERATURE; // 2
        } else if (itemId >= 21 && itemId <= 25) {
            return ItemGenerator.TRAIT_FREQUENCY; // 3
        }
        // Temperature items (26-39)
        else if (itemId >= 26 && itemId <= 30) {
            return ItemGenerator.TRAIT_SALINITY; // 0
        } else if (itemId >= 31 && itemId <= 34) {
            return ItemGenerator.TRAIT_PH; // 1
        } else if (itemId >= 35 && itemId <= 39) {
            return ItemGenerator.TRAIT_FREQUENCY; // 3
        }
        // Frequency items (40-53)
        else if (itemId >= 40 && itemId <= 44) {
            return ItemGenerator.TRAIT_SALINITY; // 0
        } else if (itemId >= 45 && itemId <= 48) {
            return ItemGenerator.TRAIT_PH; // 1
        } else if (itemId >= 49 && itemId <= 53) {
            return ItemGenerator.TRAIT_TEMPERATURE; // 2
        }
        // Epics (54-63) - no secondary trait
        return ItemGenerator.TRAIT_NONE; // 4
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        address catalogV1 = vm.envAddress("CATALOG_V1");
        address catalogV3 = vm.envAddress("CATALOG_V3");
        
        console2.log("=== Seed CATALOG_V3 from CATALOG_V1 ===");
        console2.log("Deployer:", deployer);
        console2.log("CATALOG_V1 (source):", catalogV1);
        console2.log("CATALOG_V3 (target):", catalogV3);
        console2.log("");
        
        ItemCatalog sourceCatalog = ItemCatalog(catalogV1);
        ItemCatalog targetCatalog = ItemCatalog(catalogV3);
        
        // Verify ownership
        require(targetCatalog.owner() == deployer, "CATALOG_V3 owner is not deployer");
        
        // Get template count from source
        uint256 templateCount = sourceCatalog.templateCount();
        console2.log("Templates to migrate:", templateCount);
        require(templateCount == 64, "Expected 64 templates in CATALOG_V1");
        
        vm.startBroadcast(deployerPrivateKey);
        
        uint256 migratedCount = 0;
        uint256 updatedCount = 0;
        
        // Migrate all 64 templates
        for (uint256 i = 0; i < templateCount; i++) {
            // Read template from CATALOG_V1
            ItemCatalog.ItemTemplate memory sourceTemplate = sourceCatalog.getTemplate(i);
            
            // Determine new secondary trait
            uint8 newSecondaryTrait = _getNewSecondaryTrait(i);
            
            // Preserve existing secondaryDelta (unless it's an epic with no secondary)
            int16 newSecondaryDelta = sourceTemplate.secondaryDelta;
            if (newSecondaryTrait == ItemGenerator.TRAIT_NONE) {
                newSecondaryDelta = 0;
            }
            
            // Create template for CATALOG_V3
            ItemCatalog.ItemTemplate memory newTemplate = ItemCatalog.ItemTemplate({
                rarity: sourceTemplate.rarity,
                primaryTrait: sourceTemplate.primaryTrait,
                primaryDelta: sourceTemplate.primaryDelta,
                secondaryTrait: newSecondaryTrait,
                secondaryDelta: newSecondaryDelta,
                imagePtr: sourceTemplate.imagePtr,
                name: sourceTemplate.name,
                description: sourceTemplate.description
            });
            
            // Add to CATALOG_V3
            uint256 templateId = targetCatalog.addTemplate(newTemplate);
            require(templateId == i, "Template ID mismatch");
            
            // Check if secondary trait changed
            if (sourceTemplate.secondaryTrait != newSecondaryTrait) {
                updatedCount++;
                console2.log("Template", i, ":", sourceTemplate.name);
                console2.log("  Old secondary:", sourceTemplate.secondaryTrait);
                console2.log("  New secondary:", newSecondaryTrait);
            }
            
            migratedCount++;
        }
        
        vm.stopBroadcast();
        
        // Verify migration
        uint256 targetCount = targetCatalog.templateCount();
        require(targetCount == 64, "CATALOG_V3 should have 64 templates");
        
        console2.log("");
        console2.log("=== Migration Summary ===");
        console2.log("Templates migrated:", migratedCount);
        console2.log("Secondary traits updated:", updatedCount);
        console2.log("Epics (unchanged): 10");
        console2.log("");
        console2.log("[OK] All 64 templates migrated to CATALOG_V3");
        console2.log("[OK] Secondary traits updated per new matrix");
        console2.log("");
        console2.log("Next steps:");
        console2.log("1. Run VerifyCatalogV3Templates.s.sol to verify templates");
        console2.log("2. Run UpgradeItemTokenV3_SetCatalog.s.sol");
        console2.log("3. Run UpgradeStabilizerV3_SetCatalog.s.sol");
        console2.log("4. Run WireCatalogV3.s.sol");
    }
}

