// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ItemImageDeployer} from "../contracts/stabilization/items/ItemImageDeployer.sol";

/**
 * @title DeployItemImageDeployerV1_2
 * @notice Deploy fixed ItemImageDeployer with correct SSTORE2 bytecode
 */
contract DeployItemImageDeployerV1_2 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy fixed ItemImageDeployer
        ItemImageDeployer imageDeployer = new ItemImageDeployer();
        address deployerAddr = address(imageDeployer);
        console2.log("ItemImageDeployerV1_2:", deployerAddr);

        vm.stopBroadcast();

        console2.log("\n=== DEPLOYMENT COMPLETE ===");
        console2.log("export ITEM_IMAGE_DEPLOYER_V1_2=", deployerAddr);
    }
}



