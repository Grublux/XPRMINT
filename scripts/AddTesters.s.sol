// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CreatureStabilizer} from "../contracts/stabilization/CreatureStabilizer.sol";

/**
 * @title AddTesters
 * @notice Adds tester addresses to the STAB_V3 whitelist
 * @dev Uses batchSetTesters for efficiency
 * 
 * Usage:
 *   export RPC="https://apechain.calderachain.xyz/http"
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export STAB_V3=0xe5fb969eec4985e8EB92334fFE11EA45035467CB
 * 
 *   forge script scripts/AddTesters.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast \
 *     -vvvv
 */
contract AddTesters is Script {
    function run() external {
        address stabV3 = vm.envAddress("STAB_V3");
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console2.log("=== Adding Testers to Whitelist ===");
        console2.log("STAB_V3:", stabV3);
        console2.log("Deployer:", deployer);
        
        CreatureStabilizer stabilizer = CreatureStabilizer(stabV3);
        
        // Verify deployer is owner
        require(stabilizer.owner() == deployer, "AddTesters: deployer is not owner");
        
        // Addresses to whitelist
        address[] memory testers = new address[](2);
        testers[0] = 0xf70e17b5aFdF83899f9f4cB7C7f9d56867D138c7;
        testers[1] = 0xc0D44e845f41dEf6Ac15DEe4A69002A9b5729979;
        
        console2.log("");
        console2.log("Adding testers:");
        for (uint256 i = 0; i < testers.length; i++) {
            console2.log("  -", testers[i]);
        }
        console2.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Add all testers at once
        stabilizer.batchSetTesters(testers, true);
        
        vm.stopBroadcast();
        
        console2.log("");
        console2.log("=== Verification ===");
        for (uint256 i = 0; i < testers.length; i++) {
            bool isTester = stabilizer.isTester(testers[i]);
            console2.log("isTester(", testers[i], "):", isTester);
            require(isTester, "AddTesters: verification failed");
        }
        
        console2.log("");
        console2.log("=== Success ===");
        console2.log("All testers added successfully!");
    }
}

