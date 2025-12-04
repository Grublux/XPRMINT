// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ItemCatalog} from "../contracts/stabilization/items/ItemCatalog.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";

/**
 * @title DeployNewImplementations
 * @notice Deploys new implementations for ItemCatalog and ItemToken1155
 * @dev Run this first, then transfer ownership, then run UpgradeContracts.s.sol
 */
contract DeployNewImplementations is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        console.log("\n=== Deploying New Implementations ===");
        
        ItemCatalog newCatalogImpl = new ItemCatalog();
        console.log("New ItemCatalog impl:", address(newCatalogImpl));
        
        ItemToken1155 newItemTokenImpl = new ItemToken1155();
        console.log("New ItemToken1155 impl:", address(newItemTokenImpl));
        
        vm.stopBroadcast();
        
        console.log("\n=== Next Steps ===");
        console.log("1. Save these addresses to .env:");
        console.log("   NEW_ITEM_CATALOG_IMPL=", vm.toString(address(newCatalogImpl)));
        console.log("   NEW_ITEM_TOKEN_IMPL=", vm.toString(address(newItemTokenImpl)));
        console.log("2. Transfer ownership of ProxyAdmins (see TransferProxyAdminOwnership.s.sol)");
        console.log("3. Run UpgradeContracts.s.sol to upgrade the proxies");
    }
}




