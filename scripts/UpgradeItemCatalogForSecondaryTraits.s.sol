// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ItemCatalog} from "../contracts/stabilization/items/ItemCatalog.sol";

/**
 * @title UpgradeItemCatalogForSecondaryTraits
 * @notice Upgrades ItemCatalog to include updateTemplateSecondaryTrait() function
 * @dev This upgrade enables item-specific secondary trait mappings
 * 
 * After this upgrade, you can run UpdateSecondaryTraits.s.sol to update all templates
 */
contract UpgradeItemCatalogForSecondaryTraits is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);

        // Get catalog proxy address from environment
        address catalogProxyAddr = vm.envOr("ITEM_CATALOG_PROXY", vm.envOr("STAB_ITEM_CATALOG", vm.envOr("ITEM_CATALOG_PROXY_V1", address(0))));
        require(catalogProxyAddr != address(0), "ItemCatalog proxy address not set");
        console.log("ItemCatalog proxy:", catalogProxyAddr);

        // Read the actual ProxyAdmin from the proxy's admin slot (ERC1967)
        // This is the admin that the proxy recognizes and will accept upgrades from
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        address catalogProxyAdminAddr = address(uint160(uint256(vm.load(catalogProxyAddr, adminSlot))));
        console.log("Catalog ProxyAdmin (from admin slot):", catalogProxyAdminAddr);
        
        // Verify the ProxyAdmin is owned by deployer
        ProxyAdmin catalogAdmin = ProxyAdmin(catalogProxyAdminAddr);
        address adminOwner = catalogAdmin.owner();
        console.log("ProxyAdmin owner:", adminOwner);
        console.log("Deployer:", deployer);
        
        if (adminOwner != deployer) {
            console.log("\n[WARNING] ProxyAdmin owner does not match deployer!");
            console.log("The ProxyAdmin must be owned by the deployer to perform upgrades.");
            console.log("You may need to:");
            console.log("  1. Transfer ownership of the ProxyAdmin to the deployer, OR");
            console.log("  2. Use the ProxyAdmin owner's private key instead");
            revert("ProxyAdmin ownership mismatch");
        }
        
        ITransparentUpgradeableProxy catalogProxy = ITransparentUpgradeableProxy(catalogProxyAddr);

        // Get current implementation address (for verification)
        bytes32 implSlot = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
        address currentImpl = address(uint160(uint256(vm.load(catalogProxyAddr, implSlot))));
        console.log("\n=== Current State ===");
        console.log("Current implementation:", currentImpl);

        // Deploy new implementation
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("\n=== Deploying New Implementation ===");
        ItemCatalog newCatalogImpl = new ItemCatalog();
        console.log("New ItemCatalog implementation deployed at:", address(newCatalogImpl));

        // Verify the new implementation has the updateTemplateSecondaryTrait function
        // We can't directly check function existence, but we can verify it compiles
        console.log("\n=== Upgrading Proxy ===");
        console.log("Upgrading proxy to new implementation...");
        
        catalogAdmin.upgradeAndCall(
            catalogProxy,
            address(newCatalogImpl),
            "" // No initialization needed
        );
        
        console.log("[OK] Proxy upgraded successfully");

        vm.stopBroadcast();

        // Verify the upgrade
        address newImpl = address(uint160(uint256(vm.load(catalogProxyAddr, implSlot))));
        console.log("\n=== Verification ===");
        console.log("New implementation address:", newImpl);
        
        if (newImpl == address(newCatalogImpl)) {
            console.log("[OK] Upgrade verified - implementation address matches");
        } else {
            console.log("[WARNING] Implementation address mismatch");
            console.log("Expected:", address(newCatalogImpl));
            console.log("Actual:", newImpl);
        }

        // Test that we can read the catalog (basic functionality check)
        ItemCatalog catalog = ItemCatalog(catalogProxyAddr);
        uint256 templateCount = catalog.templateCount();
        console.log("Template count:", templateCount);
        
        if (templateCount > 0) {
            console.log("[OK] Catalog is accessible after upgrade");
        } else {
            console.log("[WARNING] Template count is 0 - catalog may not be initialized");
        }

        console.log("\n=== UPGRADE COMPLETE ===");
        console.log("ItemCatalog proxy upgraded to:", address(newCatalogImpl));
        console.log("\nNext steps:");
        console.log("1. Verify the upgrade on ApeScan");
        console.log("2. Run UpdateSecondaryTraits.s.sol to update all templates");
        console.log("3. Run VerifySecondaryTraits.s.sol to confirm all updates");
    }
}

