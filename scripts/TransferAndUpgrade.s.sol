// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ItemCatalog} from "../contracts/stabilization/items/ItemCatalog.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";
import {OwnershipTransferUpgrade} from "../contracts/helpers/OwnershipTransferUpgrade.sol";

/**
 * @title TransferAndUpgrade
 * @notice Complete script to transfer ownership and upgrade contracts
 */
contract TransferAndUpgrade is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deployer:", deployer);

        address mainProxyAdminAddr = vm.envAddress("PROXY_ADMIN");
        address catalogProxyAddr = vm.envOr("ITEM_CATALOG_PROXY", vm.envOr("STAB_ITEM_CATALOG", address(0)));
        address itemTokenProxyAddr = vm.envOr("STAB_ITEM_TOKEN", vm.envOr("ITEM_TOKEN_PROXY", address(0)));
        
        require(catalogProxyAddr != address(0), "Catalog proxy address not set");
        require(itemTokenProxyAddr != address(0), "ItemToken proxy address not set");

        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        address catalogProxyAdmin = address(uint160(uint256(vm.load(catalogProxyAddr, adminSlot))));
        address itemTokenProxyAdmin = address(uint160(uint256(vm.load(itemTokenProxyAddr, adminSlot))));
        
        vm.startBroadcast(deployerPrivateKey);
        
        _transferOwnership(mainProxyAdminAddr, catalogProxyAddr, catalogProxyAdmin, itemTokenProxyAdmin, deployer);
        _deployAndUpgrade(catalogProxyAddr, itemTokenProxyAddr, catalogProxyAdmin, itemTokenProxyAdmin);
        
        vm.stopBroadcast();
    }
    
    function _transferOwnership(
        address mainProxyAdminAddr,
        address catalogProxyAddr,
        address catalogProxyAdmin,
        address itemTokenProxyAdmin,
        address deployer
    ) internal {
        console.log("\n=== Step 1: Transfer Ownership ===");
        
        ProxyAdmin mainProxyAdmin = ProxyAdmin(mainProxyAdminAddr);
        ITransparentUpgradeableProxy catalogProxy = ITransparentUpgradeableProxy(catalogProxyAddr);
        
        OwnershipTransferUpgrade tempUpgrade = new OwnershipTransferUpgrade();
        console.log("Temporary upgrade contract:", address(tempUpgrade));
        
        address[] memory proxyAdmins = new address[](2);
        proxyAdmins[0] = catalogProxyAdmin;
        proxyAdmins[1] = itemTokenProxyAdmin;
        
        bytes memory initData = abi.encodeWithSelector(
            OwnershipTransferUpgrade.initialize.selector,
            proxyAdmins,
            deployer
        );
        
        try mainProxyAdmin.upgradeAndCall(catalogProxy, address(tempUpgrade), initData) {
            console.log("Ownership transferred via proxy upgrade!");
        } catch {
            console.log("Proxy upgrade approach failed - will try direct upgrade");
        }
    }
    
    function _deployAndUpgrade(
        address catalogProxyAddr,
        address itemTokenProxyAddr,
        address catalogProxyAdmin,
        address itemTokenProxyAdmin
    ) internal {
        console.log("\n=== Step 2: Deploy and Upgrade ===");
        
        ItemCatalog newCatalogImpl = new ItemCatalog();
        console.log("New ItemCatalog impl:", address(newCatalogImpl));
        
        ItemToken1155 newItemTokenImpl = new ItemToken1155();
        console.log("New ItemToken1155 impl:", address(newItemTokenImpl));
        
        ProxyAdmin catalogAdmin = ProxyAdmin(catalogProxyAdmin);
        ProxyAdmin itemTokenAdmin = ProxyAdmin(itemTokenProxyAdmin);
        ITransparentUpgradeableProxy catalogProxy = ITransparentUpgradeableProxy(catalogProxyAddr);
        ITransparentUpgradeableProxy itemTokenProxy = ITransparentUpgradeableProxy(itemTokenProxyAddr);
        
        // Upgrade ItemCatalog
        try catalogAdmin.upgradeAndCall(catalogProxy, address(newCatalogImpl), "") {
            console.log("ItemCatalog upgraded successfully!");
        } catch {
            console.log("ItemCatalog upgrade failed - ownership may not be transferred");
        }
        
        // Upgrade ItemToken1155
        try itemTokenAdmin.upgradeAndCall(itemTokenProxy, address(newItemTokenImpl), "") {
            console.log("ItemToken1155 upgraded successfully!");
        } catch {
            console.log("ItemToken1155 upgrade failed - ownership may not be transferred");
        }
    }
}
