// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ItemCatalog} from "../contracts/stabilization/items/ItemCatalog.sol";

/**
 * @title UpdateItemMetadataExample
 * @notice Example script showing how to update item template metadata on mainnet
 * @dev This script is for ops convenience only - it updates name/description only, no gameplay changes
 * 
 * Usage:
 *   export ITEM_CATALOG_PROXY_V1=<catalog-address>
 *   forge script scripts/UpdateItemMetadataExample.s.sol \
 *     --rpc-url $APECHAIN_MAINNET_RPC_URL \
 *     --broadcast
 */
contract UpdateItemMetadataExample is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        console2.log("Deployer:", deployer);

        // Read catalog address from env (supports both V1 and V0)
        address catalogProxy = vm.envOr("ITEM_CATALOG_PROXY_V1", vm.envOr("ITEM_CATALOG_PROXY", address(0)));
        require(catalogProxy != address(0), "ITEM_CATALOG_PROXY_V1 or ITEM_CATALOG_PROXY not set");
        
        console2.log("Catalog proxy:", catalogProxy);
        
        ItemCatalog catalog = ItemCatalog(catalogProxy);

        vm.startBroadcast(deployerPrivateKey);

        // Example: Update metadata for template ID 0
        // Replace with actual template IDs and new names/descriptions as needed
        uint256 templateId = 0;
        string memory newName = "Updated Item Name";
        string memory newDescription = "Updated item description with corrected information";

        console2.log("\nUpdating template", templateId);
        console2.log("New name:", newName);
        console2.log("New description:", newDescription);

        catalog.updateTemplateMetadata(templateId, newName, newDescription);

        // Verify the update
        ItemCatalog.ItemTemplate memory template = catalog.getTemplate(templateId);
        console2.log("\nVerification:");
        console2.log("Template name:", template.name);
        console2.log("Template description:", template.description);

        vm.stopBroadcast();

        console2.log("\n=== Metadata Update Complete ===");
        console2.log("Template", templateId, "metadata updated successfully");
        console2.log("\nNote: This update only affects how the item is displayed in marketplaces.");
        console2.log("Gameplay mechanics (rarity, traits, deltas) are unchanged.");
    }
}


