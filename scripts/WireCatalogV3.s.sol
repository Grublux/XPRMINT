// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";
import {CreatureStabilizer} from "../contracts/stabilization/CreatureStabilizer.sol";

/**
 * @title WireCatalogV3
 * @notice Wires ITEM_V3 and STAB_V3 to use CATALOG_V3
 * @dev Calls setCatalog() on both contracts to point them to the new catalog
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export ITEM_V3=0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8
 *   export STAB_V3=0xe5fb969eec4985e8EB92334fFE11EA45035467CB
 *   export CATALOG_V3=<deployed_catalog_v3_address>
 * 
 *   forge script scripts/WireCatalogV3.s.sol --rpc-url $RPC --broadcast
 */
contract WireCatalogV3 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        address itemV3 = vm.envAddress("ITEM_V3");
        address stabV3 = vm.envAddress("STAB_V3");
        address catalogV3 = vm.envAddress("CATALOG_V3");
        
        console2.log("=== Wire CATALOG_V3 to ITEM_V3 and STAB_V3 ===");
        console2.log("Deployer:", deployer);
        console2.log("ITEM_V3:", itemV3);
        console2.log("STAB_V3:", stabV3);
        console2.log("CATALOG_V3:", catalogV3);
        console2.log("");
        
        require(catalogV3 != address(0), "CATALOG_V3 address not set");
        
        ItemToken1155 itemToken = ItemToken1155(itemV3);
        CreatureStabilizer stabilizer = CreatureStabilizer(stabV3);
        
        // Verify ownership
        require(itemToken.owner() == deployer, "ITEM_V3 owner is not deployer");
        require(stabilizer.owner() == deployer, "STAB_V3 owner is not deployer");
        
        // Check current catalog addresses
        address currentItemCatalog = itemToken.itemCatalog();
        address currentStabCatalog = stabilizer.itemCatalog();
        
        console2.log("Current ITEM_V3 catalog:", currentItemCatalog);
        console2.log("Current STAB_V3 catalog:", currentStabCatalog);
        console2.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Wire ITEM_V3 to CATALOG_V3
        if (currentItemCatalog != catalogV3) {
            console2.log("Setting ITEM_V3 catalog to CATALOG_V3...");
            itemToken.setCatalog(catalogV3);
            console2.log("[OK] ITEM_V3 catalog updated");
        } else {
            console2.log("[SKIP] ITEM_V3 already points to CATALOG_V3");
        }
        
        // Wire STAB_V3 to CATALOG_V3
        if (currentStabCatalog != catalogV3) {
            console2.log("Setting STAB_V3 catalog to CATALOG_V3...");
            stabilizer.setCatalog(catalogV3);
            console2.log("[OK] STAB_V3 catalog updated");
        } else {
            console2.log("[SKIP] STAB_V3 already points to CATALOG_V3");
        }
        
        vm.stopBroadcast();
        
        // Verify wiring
        address newItemCatalog = itemToken.itemCatalog();
        address newStabCatalog = stabilizer.itemCatalog();
        
        require(newItemCatalog == catalogV3, "ITEM_V3 catalog not updated");
        require(newStabCatalog == catalogV3, "STAB_V3 catalog not updated");
        
        console2.log("");
        console2.log("=== Wiring Complete ===");
        console2.log("[OK] ITEM_V3 catalog:", newItemCatalog);
        console2.log("[OK] STAB_V3 catalog:", newStabCatalog);
        console2.log("");
        console2.log("Next steps:");
        console2.log("1. Run VerifyCatalogV3Wiring.s.sol to verify templates");
        console2.log("2. Test item minting and metadata to confirm new secondary traits");
    }
}

