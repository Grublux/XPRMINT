// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";

/**
 * @title SetItemV3ExternalBaseURI
 * @notice Sets the externalImageBaseURI on ItemToken1155V3
 * @dev 
 * This script calls setExternalImageBaseURI() on ItemToken1155V3.
 * Only the owner (deployer EOA) can call this function.
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export ITEM_TOKEN_PROXY_V3=<item_token_v3_proxy_address>
 *   export EXTERNAL_IMAGE_BASE_URI_V3="https://xprmint.com/items_full/"
 * 
 *   forge script scripts/SetItemV3ExternalBaseURI.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast
 */
contract SetItemV3ExternalBaseURI is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        address itemV3 = vm.envAddress("ITEM_TOKEN_PROXY_V3");
        string memory base = vm.envString("EXTERNAL_IMAGE_BASE_URI_V3");

        console2.log("=== Set externalImageBaseURI on ItemToken1155V3 ===");
        console2.log("Deployer:", deployer);
        console2.log("ItemToken1155 V3:", itemV3);
        console2.log("External Image Base URI:", base);
        console2.log("");

        ItemToken1155 item = ItemToken1155(itemV3);
        
        // Verify deployer is owner
        require(item.owner() == deployer, "Deployer is not the owner of ItemToken1155V3");
        
        // Check current externalImageBaseURI
        string memory currentBase = item.externalImageBaseURI();
        console2.log("Current externalImageBaseURI:", currentBase);
        console2.log("New externalImageBaseURI:", base);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Set external image base URI
        console2.log("Setting externalImageBaseURI...");
        item.setExternalImageBaseURI(base);
        
        vm.stopBroadcast();

        // Verify setting
        string memory newBase = item.externalImageBaseURI();
        console2.log("");
        console2.log("[OK] externalImageBaseURI set successfully on ItemToken1155V3!");
        console2.log("Verification:");
        console2.log("  ItemToken1155.externalImageBaseURI():", newBase);
        console2.log("");
        console2.log("Token URIs will now include:");
        console2.log("  - image: HTTP URL (", base, "<tokenId>.png)");
        console2.log("  - image_data: On-chain data URI (for backward compatibility)");
    }
}



