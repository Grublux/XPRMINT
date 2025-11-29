// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ItemCatalog} from "../contracts/stabilization/items/ItemCatalog.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";
import {OwnershipTransferViaProxy} from "../contracts/helpers/OwnershipTransferViaProxy.sol";

/**
 * @title TransferOwnershipAndUpgrade
 * @notice Complete script to transfer ownership and upgrade contracts
 * @dev Uses main ProxyAdmin to upgrade catalog proxy to a temp contract that transfers ownership
 */
contract TransferOwnershipAndUpgrade is Script {
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
        
        // Step 1: Deploy temp contract and transfer ownership
        console.log("\n=== Step 1: Transfer Ownership ===");
        OwnershipTransferViaProxy tempContract = new OwnershipTransferViaProxy();
        console.log("Temp contract deployed:", address(tempContract));
        
        address[] memory proxyAdmins = new address[](2);
        proxyAdmins[0] = catalogProxyAdmin;
        proxyAdmins[1] = itemTokenProxyAdmin;
        
        bytes memory initData = abi.encodeWithSelector(
            OwnershipTransferViaProxy.initialize.selector,
            proxyAdmins,
            deployer
        );
        
        ProxyAdmin mainProxyAdmin = ProxyAdmin(mainProxyAdminAddr);
        ITransparentUpgradeableProxy catalogProxy = ITransparentUpgradeableProxy(catalogProxyAddr);
        
        // Use main ProxyAdmin to upgrade catalog proxy to temp contract
        // This will transfer ownership during initialization
        console.log("Upgrading catalog proxy to temp contract...");
        mainProxyAdmin.upgradeAndCall(catalogProxy, address(tempContract), initData);
        console.log("Ownership transferred!");
        
        // Step 2: Upgrade back to real ItemCatalog
        console.log("\n=== Step 2: Upgrade to New ItemCatalog ===");
        ItemCatalog newCatalogImpl = new ItemCatalog();
        console.log("New ItemCatalog impl:", address(newCatalogImpl));
        mainProxyAdmin.upgradeAndCall(catalogProxy, address(newCatalogImpl), "");
        console.log("Catalog upgraded!");
        
        // Step 3: Upgrade ItemToken1155
        console.log("\n=== Step 3: Upgrade ItemToken1155 ===");
        ItemToken1155 newItemTokenImpl = new ItemToken1155();
        console.log("New ItemToken1155 impl:", address(newItemTokenImpl));
        
        ProxyAdmin itemTokenAdmin = ProxyAdmin(itemTokenProxyAdmin);
        ITransparentUpgradeableProxy itemTokenProxy = ITransparentUpgradeableProxy(itemTokenProxyAddr);
        itemTokenAdmin.upgradeAndCall(itemTokenProxy, address(newItemTokenImpl), "");
        console.log("ItemToken1155 upgraded!");
        
        vm.stopBroadcast();
        
        console.log("\n=== Complete ===");
        console.log("All contracts upgraded successfully!");
    }
}



