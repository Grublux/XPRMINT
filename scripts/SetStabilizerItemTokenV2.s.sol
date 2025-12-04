// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {CreatureStabilizer} from "../contracts/stabilization/CreatureStabilizer.sol";

/**
 * @title SetStabilizerItemTokenV2
 * @notice Wire CreatureStabilizer to use ItemToken1155 V2 instead of V1
 * @dev 
 * This script calls CreatureStabilizer.setItemToken() to point to ITEM_V2.
 * The old ITEM_V1 proxy remains deployed but is no longer used by gameplay.
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export CREATURE_STABILIZER_PROXY=<stabilizer_proxy_address>
 *   export ITEM_TOKEN_PROXY_V2=<item_v2_proxy_address>
 * 
 *   forge script scripts/SetStabilizerItemTokenV2.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast
 */
contract SetStabilizerItemTokenV2 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        address stabilizerProxy = vm.envAddress("CREATURE_STABILIZER_PROXY");
        address itemV2 = vm.envAddress("ITEM_TOKEN_PROXY_V2");

        console2.log("=== Wire CreatureStabilizer to ItemToken1155 V2 ===");
        console2.log("Deployer:", deployer);
        console2.log("CreatureStabilizer proxy:", stabilizerProxy);
        console2.log("ItemToken1155 V2 proxy:", itemV2);
        console2.log("");

        // Attach to stabilizer
        CreatureStabilizer stabilizer = CreatureStabilizer(stabilizerProxy);
        
        // Check current itemToken
        address currentItemToken = stabilizer.itemToken();
        console2.log("Current itemToken:", currentItemToken);
        console2.log("New itemToken (V2):", itemV2);
        console2.log("");

        // Verify deployer is owner
        address owner = stabilizer.owner();
        console2.log("CreatureStabilizer owner:", owner);
        
        if (owner != deployer) {
            console2.log("[ERROR] Deployer is not the owner of CreatureStabilizer!");
            revert("Not authorized");
        }

        vm.startBroadcast(deployerPrivateKey);

        // Set new itemToken
        console2.log("Setting CreatureStabilizer.itemToken to V2...");
        stabilizer.setItemToken(itemV2);
        
        vm.stopBroadcast();

        // Verify
        address newItemToken = stabilizer.itemToken();
        console2.log("");
        console2.log("[OK] CreatureStabilizer wired to ItemToken1155 V2!");
        console2.log("Verification:");
        console2.log("  itemToken:", newItemToken);
        console2.log("  (should match ITEM_TOKEN_PROXY_V2)");
        console2.log("");
        console2.log("Note: ITEM_V1 proxy remains deployed but is no longer used by gameplay.");
    }
}




