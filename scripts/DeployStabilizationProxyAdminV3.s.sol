// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

/**
 * @title DeployStabilizationProxyAdminV3
 * @notice Deploys the single ProxyAdminV3 for all V3 stabilization contracts
 * @dev 
 * V3 RULE: This is the ONLY ProxyAdmin used for V3 stabilization contracts.
 * All V3 proxies (CreatureStabilizerV3, ItemToken1155V3) use ProxyAdminV3 as their admin.
 * 
 * IMPORTANT: TransparentUpgradeableProxy does NOT deploy ProxyAdmins.
 * We pass ProxyAdminV3 directly as the admin parameter to each proxy.
 * ProxyAdminV3 is owned by deployer EOA, allowing direct upgrades.
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 * 
 *   forge script scripts/DeployStabilizationProxyAdminV3.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast
 */
contract DeployStabilizationProxyAdminV3 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        
        console2.log("=== Deploy ProxyAdminV3 ===");
        console2.log("Deployer:", deployer);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy exactly one ProxyAdminV3, owned by deployer EOA
        ProxyAdmin proxyAdminV3 = new ProxyAdmin(deployer);
        address proxyAdminV3Addr = address(proxyAdminV3);
        
        vm.stopBroadcast();

        // Assert that owner is deployer EOA
        require(proxyAdminV3.owner() == deployer, "ProxyAdminV3 owner is not deployer EOA");
        
        console2.log("");
        console2.log("=== ProxyAdminV3 Deployment Summary ===");
        console2.log("ProxyAdminV3 deployed at:", proxyAdminV3Addr);
        console2.log("ProxyAdminV3 owner:", proxyAdminV3.owner());
        console2.log("");
        console2.log("export PROXY_ADMIN_V3=", proxyAdminV3Addr);
        console2.log("");
        console2.log("[OK] ProxyAdminV3 is owned by deployer EOA");
        console2.log("[OK] This is the ONLY ProxyAdmin for V3 (no per-proxy admins)");
    }
}

