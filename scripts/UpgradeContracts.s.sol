// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ItemCatalog} from "../contracts/stabilization/items/ItemCatalog.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";

/**
 * @title UpgradeContracts
 * @notice Script to upgrade ItemCatalog and ItemToken1155 to new implementations
 */
contract UpgradeContracts is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deployer:", deployer);

        // Get existing addresses
        // Each proxy has its own ProxyAdmin created during deployment
        // We need to get the actual admin of each proxy from the ERC1967 admin slot
        address catalogProxyAddr = vm.envOr("ITEM_CATALOG_PROXY", vm.envOr("STAB_ITEM_CATALOG", address(0)));
        address itemTokenProxyAddr = vm.envOr("STAB_ITEM_TOKEN", vm.envOr("ITEM_TOKEN_PROXY", address(0)));
        
        require(catalogProxyAddr != address(0), "Catalog proxy address not set");
        require(itemTokenProxyAddr != address(0), "ItemToken proxy address not set");

        // Get the actual ProxyAdmin for each proxy from the admin slot
        // ERC1967 admin slot: 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        address catalogProxyAdmin = address(uint160(uint256(vm.load(catalogProxyAddr, adminSlot))));
        address itemTokenProxyAdmin = address(uint160(uint256(vm.load(itemTokenProxyAddr, adminSlot))));
        
        console.log("Catalog proxy:", catalogProxyAddr);
        console.log("Catalog ProxyAdmin:", catalogProxyAdmin);
        console.log("ItemToken proxy:", itemTokenProxyAddr);
        console.log("ItemToken ProxyAdmin:", itemTokenProxyAdmin);

        ProxyAdmin catalogAdmin = ProxyAdmin(catalogProxyAdmin);
        ProxyAdmin itemTokenAdmin = ProxyAdmin(itemTokenProxyAdmin);
        ITransparentUpgradeableProxy catalogProxy = ITransparentUpgradeableProxy(catalogProxyAddr);
        ITransparentUpgradeableProxy itemTokenProxy = ITransparentUpgradeableProxy(itemTokenProxyAddr);

        vm.startBroadcast(deployerPrivateKey);

        // Check ownership - reduce stack depth by checking one at a time
        address catalogAdminOwner = catalogAdmin.owner();
        console.log("\n=== Checking Ownership ===");
        console.log("Catalog ProxyAdmin owner:", catalogAdminOwner);
        
        if (catalogAdminOwner != deployer) {
            console.log("ERROR: Catalog ProxyAdmin not owned by deployer");
            console.log("Owner is:", catalogAdminOwner);
            console.log("You must transfer ownership first.");
            return;
        }
        
        address itemTokenAdminOwner = itemTokenAdmin.owner();
        console.log("ItemToken ProxyAdmin owner:", itemTokenAdminOwner);
        console.log("Deployer:", deployer);
        
        if (itemTokenAdminOwner != deployer) {
            console.log("ERROR: ItemToken ProxyAdmin not owned by deployer");
            console.log("Owner is:", itemTokenAdminOwner);
            console.log("You must transfer ownership first.");
            return;
        }
        
        console.log("Ownership verified - proceeding with upgrade");

        // Use already-deployed implementations or deploy new ones
        address newCatalogImplAddr = vm.envOr("NEW_ITEM_CATALOG_IMPL", address(0));
        address newItemTokenImplAddr = vm.envOr("NEW_ITEM_TOKEN_IMPL", address(0));
        
        ItemCatalog newCatalogImpl;
        ItemToken1155 newItemTokenImpl;
        
        if (newCatalogImplAddr != address(0) && newItemTokenImplAddr != address(0)) {
            console.log("\n=== Using Already-Deployed Implementations ===");
            newCatalogImpl = ItemCatalog(newCatalogImplAddr);
            newItemTokenImpl = ItemToken1155(newItemTokenImplAddr);
            console.log("ItemCatalog impl:", newCatalogImplAddr);
            console.log("ItemToken1155 impl:", newItemTokenImplAddr);
        } else {
            console.log("\n=== Deploying New Implementations ===");
            newCatalogImpl = new ItemCatalog();
            newItemTokenImpl = new ItemToken1155();
            console.log("New ItemCatalog impl:", address(newCatalogImpl));
            console.log("New ItemToken1155 impl:", address(newItemTokenImpl));
        }

        // Upgrade ItemCatalog
        console.log("\n=== Upgrading ItemCatalog ===");
        catalogAdmin.upgradeAndCall(
            catalogProxy,
            address(newCatalogImpl),
            "" // No initialization needed
        );
        console.log("ItemCatalog upgraded successfully");

        // Upgrade ItemToken1155
        console.log("\n=== Upgrading ItemToken1155 ===");
        itemTokenAdmin.upgradeAndCall(
            itemTokenProxy,
            address(newItemTokenImpl),
            "" // No initialization needed
        );
        console.log("ItemToken1155 upgraded successfully");

        vm.stopBroadcast();

        console.log("\n=== Upgrade Complete ===");
        console.log("New ItemCatalog impl:", address(newCatalogImpl));
        console.log("New ItemToken1155 impl:", address(newItemTokenImpl));
    }
}

