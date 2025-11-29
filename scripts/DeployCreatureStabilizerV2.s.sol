// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {CreatureStabilizer} from "../contracts/stabilization/CreatureStabilizer.sol";

/**
 * @title DeployCreatureStabilizerV2
 * @notice Deploy new CreatureStabilizer implementation with setItemToken function
 * @dev This is just the implementation - the proxy upgrade happens separately
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 * 
 *   forge script scripts/DeployCreatureStabilizerV2.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast
 */
contract DeployCreatureStabilizerV2 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("=== Deploy CreatureStabilizer V2 Implementation ===");
        console2.log("Deployer:", deployer);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        CreatureStabilizer stabilizerImplV2 = new CreatureStabilizer();
        address implAddr = address(stabilizerImplV2);
        
        vm.stopBroadcast();

        console2.log("");
        console2.log("=== Deployment Summary ===");
        console2.log("CREATURE_STABILIZER_IMPL_V2=", implAddr);
        console2.log("");
        console2.log("Next: Upgrade CreatureStabilizer proxy to this implementation");
    }
}



