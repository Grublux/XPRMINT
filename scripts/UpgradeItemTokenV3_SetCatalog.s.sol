// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";

/**
 * @title UpgradeItemTokenV3_SetCatalog
 * @notice Upgrades ITEM_V3 to add setCatalog() function
 * @dev This upgrade enables switching the catalog address after deployment
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export ITEM_V3=0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8
 * 
 *   forge script scripts/UpgradeItemTokenV3_SetCatalog.s.sol --rpc-url $RPC --broadcast
 */
contract UpgradeItemTokenV3_SetCatalog is Script {
    // EIP-1967 admin slot: keccak256("eip1967.proxy.admin") - 1
    bytes32 internal constant _ADMIN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1);
    // EIP-1967 implementation slot: keccak256("eip1967.proxy.implementation") - 1
    bytes32 internal constant _IMPLEMENTATION_SLOT = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);

    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        address itemV3 = vm.envAddress("ITEM_V3");
        
        console2.log("=== Upgrade ITEM_V3 to Add setCatalog() ===");
        console2.log("Deployer:", deployer);
        console2.log("ITEM_V3:", itemV3);
        console2.log("");
        
        // Read admin from EIP-1967 admin slot
        bytes32 raw = vm.load(itemV3, _ADMIN_SLOT);
        address proxyAdminAddr = address(uint160(uint256(raw)));
        console2.log("ITEM_V3 ProxyAdmin:", proxyAdminAddr);
        require(proxyAdminAddr != address(0), "ITEM_V3: admin slot is zero");
        
        // Verify ProxyAdmin ownership
        ProxyAdmin proxyAdmin = ProxyAdmin(proxyAdminAddr);
        address adminOwner = proxyAdmin.owner();
        console2.log("ProxyAdmin owner:", adminOwner);
        require(adminOwner == deployer, "ITEM_V3: deployer is not ProxyAdmin owner");
        
        // Get current implementation
        bytes32 rawImpl = vm.load(itemV3, _IMPLEMENTATION_SLOT);
        address oldImpl = address(uint160(uint256(rawImpl)));
        console2.log("Current implementation:", oldImpl);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy new implementation with setCatalog()
        console2.log("Deploying new ItemToken1155 implementation...");
        ItemToken1155 newImpl = new ItemToken1155();
        address newImplAddr = address(newImpl);
        console2.log("New implementation:", newImplAddr);
        
        if (newImplAddr == oldImpl) {
            console2.log("[WARNING] New implementation matches current. No upgrade needed.");
            vm.stopBroadcast();
            return;
        }
        
        // Upgrade via ProxyAdmin
        console2.log("Upgrading ITEM_V3 proxy...");
        ITransparentUpgradeableProxy proxy = ITransparentUpgradeableProxy(itemV3);
        proxyAdmin.upgradeAndCall(proxy, newImplAddr, "");
        
        vm.stopBroadcast();
        
        // Verify upgrade
        bytes32 rawImplAfter = vm.load(itemV3, _IMPLEMENTATION_SLOT);
        address implAfter = address(uint160(uint256(rawImplAfter)));
        console2.log("Implementation after upgrade:", implAfter);
        require(implAfter == newImplAddr, "ITEM_V3: implementation did not update");
        
        console2.log("");
        console2.log("=== Upgrade Complete ===");
        console2.log("[OK] ITEM_V3 upgraded successfully");
        console2.log("[OK] setCatalog() function is now available");
        console2.log("");
        console2.log("Next steps:");
        console2.log("1. Run UpgradeStabilizerV3_SetCatalog.s.sol");
        console2.log("2. Run WireCatalogV3.s.sol to point ITEM_V3 to CATALOG_V3");
    }
}

