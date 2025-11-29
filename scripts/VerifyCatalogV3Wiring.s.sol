// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";
import {CreatureStabilizer} from "../contracts/stabilization/CreatureStabilizer.sol";
import {ItemCatalog} from "../contracts/stabilization/items/ItemCatalog.sol";

/**
 * @title VerifyCatalogV3Wiring
 * @notice Verifies that ITEM_V3 and STAB_V3 are correctly wired to CATALOG_V3
 * @dev Checks catalog addresses and verifies template access
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export ITEM_V3=0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8
 *   export STAB_V3=0xe5fb969eec4985e8EB92334fFE11EA45035467CB
 *   export CATALOG_V3=<deployed_catalog_v3_address>
 * 
 *   forge script scripts/VerifyCatalogV3Wiring.s.sol --rpc-url $RPC
 */
contract VerifyCatalogV3Wiring is Script {
    function run() external {
        address itemV3 = vm.envAddress("ITEM_V3");
        address stabV3 = vm.envAddress("STAB_V3");
        address catalogV3 = vm.envAddress("CATALOG_V3");
        
        console2.log("=== Verify CATALOG_V3 Wiring ===");
        console2.log("ITEM_V3:", itemV3);
        console2.log("STAB_V3:", stabV3);
        console2.log("CATALOG_V3:", catalogV3);
        console2.log("");
        
        ItemToken1155 itemToken = ItemToken1155(itemV3);
        CreatureStabilizer stabilizer = CreatureStabilizer(stabV3);
        ItemCatalog catalog = ItemCatalog(catalogV3);
        
        // Check catalog addresses
        address itemCatalog = itemToken.itemCatalog();
        address stabCatalog = stabilizer.itemCatalog();
        
        console2.log("ITEM_V3 catalog:", itemCatalog);
        console2.log("STAB_V3 catalog:", stabCatalog);
        console2.log("");
        
        require(itemCatalog == catalogV3, "ITEM_V3 is not wired to CATALOG_V3");
        require(stabCatalog == catalogV3, "STAB_V3 is not wired to CATALOG_V3");
        
        // Verify template access
        console2.log("Verifying template access...");
        ItemCatalog.ItemTemplate memory template0 = itemToken.getItemData(0);
        console2.log("Template 0 name:", template0.name);
        console2.log("Template 0 secondary trait:", template0.secondaryTrait);
        
        uint256 templateCount = catalog.templateCount();
        require(templateCount == 64, "CATALOG_V3 should have 64 templates");
        
        console2.log("");
        console2.log("=== Verification Summary ===");
        console2.log("[OK] ITEM_V3 is wired to CATALOG_V3");
        console2.log("[OK] STAB_V3 is wired to CATALOG_V3");
        console2.log("[OK] Template count:", templateCount);
        console2.log("[OK] Template access verified");
        console2.log("");
        console2.log("[SUCCESS] All wiring verified!");
    }
}

