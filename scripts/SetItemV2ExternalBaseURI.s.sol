// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";

/**
 * @title SetItemV2ExternalBaseURI
 * @notice Set the externalImageBaseURI on ItemToken1155 V2
 * @dev 
 * This sets the base URL for marketplace-friendly image URLs.
 * The full URL will be: externalImageBaseURI + tokenId + ".png"
 * 
 * Example: If baseURI is "https://xprmint.com/items_full/", then
 * token 0 will have image: "https://xprmint.com/items_full/0.png"
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export ITEM_TOKEN_PROXY_V2=<item_v2_proxy_address>
 *   export EXTERNAL_IMAGE_BASE_URI="https://xprmint.com/items_full/"
 * 
 *   forge script scripts/SetItemV2ExternalBaseURI.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast
 */
contract SetItemV2ExternalBaseURI is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        address itemV2 = vm.envAddress("ITEM_TOKEN_PROXY_V2");
        string memory baseURI = vm.envString("EXTERNAL_IMAGE_BASE_URI");

        console2.log("=== Set External Image Base URI for ItemToken1155 V2 ===");
        console2.log("Deployer:", deployer);
        console2.log("ItemToken1155 V2 proxy:", itemV2);
        console2.log("External Image Base URI:", baseURI);
        console2.log("");

        // Attach to ItemToken1155
        ItemToken1155 itemToken = ItemToken1155(itemV2);
        
        // Check current value
        string memory currentBaseURI = itemToken.externalImageBaseURI();
        console2.log("Current externalImageBaseURI:", currentBaseURI);
        console2.log("");

        // Verify deployer is owner
        address owner = itemToken.owner();
        console2.log("ItemToken1155 owner:", owner);
        
        if (owner != deployer) {
            console2.log("[ERROR] Deployer is not the owner of ItemToken1155 V2!");
            revert("Not authorized");
        }

        vm.startBroadcast(deployerPrivateKey);

        // Set external image base URI
        console2.log("Setting externalImageBaseURI...");
        itemToken.setExternalImageBaseURI(baseURI);
        
        vm.stopBroadcast();

        // Verify
        string memory newBaseURI = itemToken.externalImageBaseURI();
        console2.log("");
        console2.log("[OK] externalImageBaseURI set!");
        console2.log("Verification:");
        console2.log("  externalImageBaseURI:", newBaseURI);
        console2.log("");
        console2.log("Token URIs will now include:");
        console2.log("  - image: HTTP URL (", newBaseURI, "<tokenId>.png)");
        console2.log("  - image_data: On-chain data URI (for backward compatibility)");
    }
}




