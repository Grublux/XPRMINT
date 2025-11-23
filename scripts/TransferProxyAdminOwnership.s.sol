// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

/**
 * @title TransferProxyAdminOwnership
 * @notice Script to transfer ownership of individual ProxyAdmins to deployer
 * @dev Since the main ProxyAdmin (a contract) owns the individual ProxyAdmins,
 *      we need to use cast commands to call transferOwnership directly.
 *      This script provides the exact commands to run.
 */
contract TransferProxyAdminOwnership is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deployer:", deployer);

        // Get addresses
        address mainProxyAdminAddr = vm.envAddress("PROXY_ADMIN");
        address catalogProxyAddr = vm.envOr("ITEM_CATALOG_PROXY", vm.envOr("STAB_ITEM_CATALOG", address(0)));
        address itemTokenProxyAddr = vm.envOr("STAB_ITEM_TOKEN", vm.envOr("ITEM_TOKEN_PROXY", address(0)));
        
        require(catalogProxyAddr != address(0), "Catalog proxy address not set");
        require(itemTokenProxyAddr != address(0), "ItemToken proxy address not set");

        // Get individual ProxyAdmins from admin slots
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        address catalogProxyAdmin = address(uint160(uint256(vm.load(catalogProxyAddr, adminSlot))));
        address itemTokenProxyAdmin = address(uint160(uint256(vm.load(itemTokenProxyAddr, adminSlot))));
        
        console.log("\n=== ProxyAdmin Ownership Transfer ===");
        console.log("Main ProxyAdmin:", mainProxyAdminAddr);
        console.log("Catalog ProxyAdmin:", catalogProxyAdmin);
        console.log("ItemToken ProxyAdmin:", itemTokenProxyAdmin);
        console.log("New owner (deployer):", deployer);
        
        // Verify ownership
        ProxyAdmin mainProxyAdmin = ProxyAdmin(mainProxyAdminAddr);
        ProxyAdmin catalogAdmin = ProxyAdmin(catalogProxyAdmin);
        ProxyAdmin itemTokenAdmin = ProxyAdmin(itemTokenProxyAdmin);
        
        address catalogAdminOwner = catalogAdmin.owner();
        address itemTokenAdminOwner = itemTokenAdmin.owner();
        address mainProxyAdminOwner = mainProxyAdmin.owner();
        
        console.log("\nCurrent owners:");
        console.log("Main ProxyAdmin owner:", mainProxyAdminOwner);
        console.log("Catalog ProxyAdmin owner:", catalogAdminOwner);
        console.log("ItemToken ProxyAdmin owner:", itemTokenAdminOwner);
        
        require(mainProxyAdminOwner == deployer, "Deployer is not owner of main ProxyAdmin");
        
        if (catalogAdminOwner != mainProxyAdminAddr || itemTokenAdminOwner != mainProxyAdminAddr) {
            console.log("\nWARNING: Main ProxyAdmin is not the owner of individual ProxyAdmins!");
            return;
        }
        
        console.log("\n=== Ownership Transfer Required ===");
        console.log("The main ProxyAdmin (contract) owns the individual ProxyAdmins.");
        console.log("To transfer ownership, you need to use cast commands or a helper contract.");
        console.log("\nCatalog ProxyAdmin:", catalogProxyAdmin);
        console.log("ItemToken ProxyAdmin:", itemTokenProxyAdmin);
        console.log("New owner:", deployer);
        console.log("\nSee scripts/README_DEPLOYMENT.md for transfer instructions.");
    }
}
