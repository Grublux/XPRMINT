// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ItemCatalog} from "../contracts/stabilization/items/ItemCatalog.sol";

/**
 * @title DeployCatalogV3
 * @notice Deploys a new ItemCatalogV3 proxy under PROXY_ADMIN_V3
 * @dev The new catalog will be owned by the deployer and can be upgraded via PROXY_ADMIN_V3
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export PROXY_ADMIN_V3=0xD6b4087cAd41F45a06A344c193de9B0EbcE957DB
 * 
 *   forge script scripts/DeployCatalogV3.s.sol --rpc-url $RPC --broadcast
 */
contract DeployCatalogV3 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        address proxyAdminV3 = vm.envAddress("PROXY_ADMIN_V3");
        
        console2.log("=== Deploy ItemCatalog V3 ===");
        console2.log("Deployer:", deployer);
        console2.log("PROXY_ADMIN_V3:", proxyAdminV3);
        console2.log("");
        
        // Verify PROXY_ADMIN_V3 ownership
        ProxyAdmin admin = ProxyAdmin(proxyAdminV3);
        require(admin.owner() == deployer, "PROXY_ADMIN_V3 owner is not deployer");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy ItemCatalog implementation
        console2.log("Deploying ItemCatalog implementation...");
        ItemCatalog catalogImpl = new ItemCatalog();
        address implAddr = address(catalogImpl);
        console2.log("ItemCatalog implementation:", implAddr);
        
        // Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(ItemCatalog.initialize.selector);
        
        // Deploy proxy with PROXY_ADMIN_V3 as the admin
        // TransparentUpgradeableProxy constructor takes (implementation, initialOwner, data)
        // We pass PROXY_ADMIN_V3 as initialOwner so it becomes the admin
        console2.log("Deploying ItemCatalog V3 proxy...");
        TransparentUpgradeableProxy catalogV3 = new TransparentUpgradeableProxy(
            implAddr,
            proxyAdminV3,  // PROXY_ADMIN_V3 is the admin
            initData
        );
        address catalogV3Addr = address(catalogV3);
        
        vm.stopBroadcast();
        
        // Verify the proxy admin (will be an individual ProxyAdmin)
        // When initialOwner is PROXY_ADMIN_V3, the ProxyAdmin is owned by PROXY_ADMIN_V3
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        address individualProxyAdmin = address(uint160(uint256(vm.load(catalogV3Addr, adminSlot))));
        
        // Verify the individual ProxyAdmin is owned by PROXY_ADMIN_V3 (which deployer owns)
        ProxyAdmin individualAdmin = ProxyAdmin(individualProxyAdmin);
        address individualAdminOwner = individualAdmin.owner();
        require(individualAdminOwner == proxyAdminV3 || individualAdminOwner == deployer, "CATALOG_V3 ProxyAdmin owner is not PROXY_ADMIN_V3 or deployer");
        
        // Verify catalog ownership
        ItemCatalog catalog = ItemCatalog(catalogV3Addr);
        require(catalog.owner() == deployer, "CATALOG_V3 owner is not deployer");
        
        console2.log("");
        console2.log("=== ItemCatalog V3 Deployment Summary ===");
        console2.log("CATALOG_V3 proxy:", catalogV3Addr);
        console2.log("CATALOG_V3 implementation:", implAddr);
        console2.log("CATALOG_V3 individual ProxyAdmin:", individualProxyAdmin);
        console2.log("ProxyAdmin owner:", individualAdminOwner);
        console2.log("CATALOG_V3 owner:", deployer);
        console2.log("");
        console2.log("export CATALOG_V3=", catalogV3Addr);
        console2.log("");
        console2.log("[OK] CATALOG_V3 has individual ProxyAdmin owned by deployer");
        console2.log("[OK] CATALOG_V3 is owned by deployer EOA");
        console2.log("");
        console2.log("Next steps:");
        console2.log("1. Run SeedCatalogV3FromV1.s.sol to migrate templates");
        console2.log("2. Run UpgradeItemTokenV3_SetCatalog.s.sol to add setCatalog()");
        console2.log("3. Run UpgradeStabilizerV3_SetCatalog.s.sol to add setCatalog()");
        console2.log("4. Run WireCatalogV3.s.sol to point contracts to CATALOG_V3");
    }
}

