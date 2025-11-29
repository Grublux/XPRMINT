// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ProxyAdminOwnershipTransfer} from "../contracts/helpers/ProxyAdminOwnershipTransfer.sol";

/**
 * @title TransferOwnershipViaHelper
 * @notice Uses main ProxyAdmin to upgrade catalog proxy to helper contract that transfers ownership
 */
contract TransferOwnershipViaHelper is Script {
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
        
        console.log("Catalog ProxyAdmin:", catalogProxyAdmin);
        console.log("ItemToken ProxyAdmin:", itemTokenProxyAdmin);
        
        // Verify main ProxyAdmin is owned by deployer
        ProxyAdmin mainProxyAdmin = ProxyAdmin(mainProxyAdminAddr);
        address mainOwner = mainProxyAdmin.owner();
        require(mainOwner == deployer, "Deployer is not owner of main ProxyAdmin");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy helper contract
        ProxyAdminOwnershipTransfer helper = new ProxyAdminOwnershipTransfer();
        console.log("Helper contract deployed:", address(helper));
        
        // Prepare data to transfer ownership
        address[] memory proxyAdmins = new address[](2);
        proxyAdmins[0] = catalogProxyAdmin;
        proxyAdmins[1] = itemTokenProxyAdmin;
        
        bytes memory transferData = abi.encodeWithSelector(
            ProxyAdminOwnershipTransfer.transferOwnerships.selector,
            proxyAdmins,
            deployer
        );
        
        // Use main ProxyAdmin to upgrade catalog proxy to helper contract
        // This will transfer ownership during the upgrade
        ITransparentUpgradeableProxy catalogProxy = ITransparentUpgradeableProxy(catalogProxyAddr);
        
        console.log("Attempting to upgrade catalog proxy via main ProxyAdmin...");
        console.log("NOTE: This will fail if main ProxyAdmin is not the admin of catalog proxy");
        
        mainProxyAdmin.upgradeAndCall(catalogProxy, address(helper), transferData);
        
        console.log("Ownership transferred!");
        
        vm.stopBroadcast();
    }
}



