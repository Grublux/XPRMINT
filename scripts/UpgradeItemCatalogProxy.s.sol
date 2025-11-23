// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @title UpgradeItemCatalogProxy
 * @notice Upgrade V1 ItemCatalog proxy to new implementation
 * @dev Uses ProxyAdminV1 to upgrade the proxy
 */
contract UpgradeItemCatalogProxy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);

        // Read environment variables
        address proxyAdminV1 = vm.envAddress("PROXY_ADMIN_V1");
        address catalogProxy = vm.envAddress("ITEM_CATALOG_PROXY_V1");
        address newImpl = vm.envAddress("ITEM_CATALOG_IMPL_V1_2");

        console2.log("ProxyAdminV1:", proxyAdminV1);
        console2.log("Catalog Proxy:", catalogProxy);
        console2.log("New Implementation:", newImpl);

        vm.startBroadcast(deployerPrivateKey);

        // Upgrade proxy via ProxyAdmin
        ProxyAdmin admin = ProxyAdmin(proxyAdminV1);
        ITransparentUpgradeableProxy proxy = ITransparentUpgradeableProxy(catalogProxy);
        admin.upgradeAndCall(proxy, newImpl, "");

        console2.log("Proxy upgraded successfully!");

        vm.stopBroadcast();

        console2.log("\n=== UPGRADE COMPLETE ===");
        console2.log("Catalog proxy upgraded to:", newImpl);
        console2.log("Verify on ApeScan:", string.concat("https://apescan.io/address/", vm.toString(catalogProxy), "#readProxyContract"));
    }
}

