// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";

/**
 * @title SetExternalImageBaseURI
 * @notice Script to set the external image base URI on the deployed ItemToken1155 V1 proxy
 * @dev This script should be run after deployment to configure marketplace-friendly image URLs
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export ITEM_TOKEN_PROXY_V1=0x9c4216d7b56a25b4b8a8eddefebaba389e05a01e
 *   export EXTERNAL_IMAGE_BASE_URI="https://xprmint.com/items_full/"
 * 
 *   forge script scripts/SetExternalImageBaseURI.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast
 */
contract SetExternalImageBaseURI is Script {
    function run() external {
        // Read environment variables
        address itemTokenProxy = vm.envAddress("ITEM_TOKEN_PROXY_V1");
        string memory baseURI = vm.envString("EXTERNAL_IMAGE_BASE_URI");
        
        console2.log("=== Set External Image Base URI ===");
        console2.log("ItemToken1155 Proxy:", itemTokenProxy);
        console2.log("Base URI:", baseURI);
        console2.log("");
        
        // Attach to the proxy
        ItemToken1155 itemToken = ItemToken1155(itemTokenProxy);
        
        // Verify current value
        string memory currentBaseURI = itemToken.externalImageBaseURI();
        console2.log("Current base URI:", currentBaseURI);
        console2.log("");
        
        // Broadcast transaction
        vm.startBroadcast();
        
        // Set the new base URI
        itemToken.setExternalImageBaseURI(baseURI);
        
        vm.stopBroadcast();
        
        // Verify the update
        string memory newBaseURI = itemToken.externalImageBaseURI();
        console2.log("✅ Base URI updated successfully!");
        console2.log("New base URI:", newBaseURI);
        console2.log("");
        console2.log("Next steps:");
        console2.log("1. Verify on ApeScan that the transaction succeeded");
        console2.log("2. Call uri(0) on the contract to verify metadata includes the new image URL");
        console2.log("3. Wait for Magic Eden / explorers to refresh metadata");
    }
}



