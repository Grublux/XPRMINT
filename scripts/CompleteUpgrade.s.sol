// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ItemCatalog} from "../contracts/stabilization/items/ItemCatalog.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";

/**
 * @title CompleteUpgrade
 * @notice Complete upgrade script - upgrades both contracts and deploys images
 * @dev Run this AFTER ownership has been transferred manually
 */
contract CompleteUpgrade is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deployer:", deployer);

        address catalogProxyAddr = vm.envOr("ITEM_CATALOG_PROXY", vm.envOr("STAB_ITEM_CATALOG", address(0)));
        address itemTokenProxyAddr = vm.envOr("STAB_ITEM_TOKEN", vm.envOr("ITEM_TOKEN_PROXY", address(0)));
        
        require(catalogProxyAddr != address(0), "Catalog proxy address not set");
        require(itemTokenProxyAddr != address(0), "ItemToken proxy address not set");

        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        address catalogProxyAdmin = address(uint160(uint256(vm.load(catalogProxyAddr, adminSlot))));
        address itemTokenProxyAdmin = address(uint160(uint256(vm.load(itemTokenProxyAddr, adminSlot))));
        
        console.log("Catalog ProxyAdmin:", catalogProxyAdmin);
        console.log("ItemToken ProxyAdmin:", itemTokenProxyAdmin);

        // Check ownership
        ProxyAdmin catalogAdmin = ProxyAdmin(catalogProxyAdmin);
        ProxyAdmin itemTokenAdmin = ProxyAdmin(itemTokenProxyAdmin);
        
        address catalogOwner = catalogAdmin.owner();
        address itemTokenOwner = itemTokenAdmin.owner();
        
        console.log("\n=== Ownership Check ===");
        console.log("Catalog ProxyAdmin owner:", catalogOwner);
        console.log("ItemToken ProxyAdmin owner:", itemTokenOwner);
        console.log("Deployer:", deployer);
        
        if (catalogOwner != deployer || itemTokenOwner != deployer) {
            console.log("\nERROR: Ownership not transferred!");
            console.log("You must transfer ownership of ProxyAdmins to deployer first.");
            console.log("See scripts/OWNERSHIP_TRANSFER_GUIDE.md");
            return;
        }

        vm.startBroadcast(deployerPrivateKey);

        // Use already-deployed implementations
        address newCatalogImpl = vm.envOr("NEW_ITEM_CATALOG_IMPL", address(0));
        address newItemTokenImpl = vm.envOr("NEW_ITEM_TOKEN_IMPL", address(0));
        
        if (newCatalogImpl == address(0) || newItemTokenImpl == address(0)) {
            console.log("\n=== Deploying New Implementations ===");
            newCatalogImpl = address(new ItemCatalog());
            newItemTokenImpl = address(new ItemToken1155());
            console.log("ItemCatalog impl:", newCatalogImpl);
            console.log("ItemToken1155 impl:", newItemTokenImpl);
        } else {
            console.log("\n=== Using Already-Deployed Implementations ===");
            console.log("ItemCatalog impl:", newCatalogImpl);
            console.log("ItemToken1155 impl:", newItemTokenImpl);
        }

        // Upgrade contracts
        console.log("\n=== Upgrading Contracts ===");
        ITransparentUpgradeableProxy catalogProxy = ITransparentUpgradeableProxy(catalogProxyAddr);
        ITransparentUpgradeableProxy itemTokenProxy = ITransparentUpgradeableProxy(itemTokenProxyAddr);
        
        catalogAdmin.upgradeAndCall(catalogProxy, newCatalogImpl, "");
        console.log("ItemCatalog upgraded!");
        
        itemTokenAdmin.upgradeAndCall(itemTokenProxy, newItemTokenImpl, "");
        console.log("ItemToken1155 upgraded!");
        
        vm.stopBroadcast();
        
        console.log("\n=== Upgrade Complete ===");
        console.log("Next: Run DeployItemImages.s.sol to deploy images");
    }
}



