// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {CreatureStabilizer} from "../contracts/stabilization/CreatureStabilizer.sol";

/**
 * @title WireStabilizerToItemV3
 * @notice Wires CreatureStabilizerV3 to use ItemToken1155V3
 * @dev 
 * This script calls setItemToken() on CreatureStabilizerV3 to point it to ITEM_V3.
 * Only the owner (deployer EOA) can call this function.
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export CREATURE_STABILIZER_PROXY_V3=<stabilizer_v3_proxy_address>
 *   export ITEM_TOKEN_PROXY_V3=<item_token_v3_proxy_address>
 * 
 *   forge script scripts/WireStabilizerToItemV3.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast
 */
contract WireStabilizerToItemV3 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        address stabilizerV3 = vm.envAddress("CREATURE_STABILIZER_PROXY_V3");
        address itemV3 = vm.envAddress("ITEM_TOKEN_PROXY_V3");

        console2.log("=== Wire CreatureStabilizerV3 to ItemToken1155V3 ===");
        console2.log("Deployer:", deployer);
        console2.log("CreatureStabilizer V3:", stabilizerV3);
        console2.log("ItemToken1155 V3:", itemV3);
        console2.log("");

        CreatureStabilizer stab = CreatureStabilizer(stabilizerV3);
        
        // Verify deployer is owner
        require(stab.owner() == deployer, "Deployer is not the owner of CreatureStabilizerV3");
        
        // Check current itemToken
        address currentItemToken = stab.itemToken();
        console2.log("Current itemToken:", currentItemToken);
        console2.log("New itemToken (V3):", itemV3);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Wire CreatureStabilizerV3 to ItemToken1155V3
        console2.log("Setting CreatureStabilizer.itemToken to ITEM_V3...");
        stab.setItemToken(itemV3);
        
        vm.stopBroadcast();

        // Verify wiring
        address newItemToken = stab.itemToken();
        require(newItemToken == itemV3, "Failed to wire CreatureStabilizerV3 to ITEM_V3");

        console2.log("");
        console2.log("[OK] CreatureStabilizerV3 now points to ItemToken1155V3!");
        console2.log("Verification:");
        console2.log("  CreatureStabilizer.itemToken():", newItemToken);
        console2.log("  Expected:", itemV3);
        console2.log("");
        console2.log("Next: Set externalImageBaseURI on ITEM_V3");
    }
}



