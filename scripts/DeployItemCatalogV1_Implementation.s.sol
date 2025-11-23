// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ItemCatalog} from "../contracts/stabilization/items/ItemCatalog.sol";

/**
 * @title DeployItemCatalogV1_Implementation
 * @notice Deploy new ItemCatalog implementation for V1 proxy upgrade
 * @dev This deploys only the implementation; proxy upgrade is separate
 */
contract DeployItemCatalogV1_Implementation is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new ItemCatalog implementation
        ItemCatalog catalogImpl = new ItemCatalog();
        address implAddr = address(catalogImpl);
        console2.log("ItemCatalog implementation V1.2:", implAddr);

        vm.stopBroadcast();

        console2.log("\n=== DEPLOYMENT COMPLETE ===");
        console2.log("export ITEM_CATALOG_IMPL_V1_2=", implAddr);
    }
}


