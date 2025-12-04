// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {CreatureStabilizer} from "../contracts/stabilization/CreatureStabilizer.sol";
import {ProxyAdminUpgradeHelper} from "../contracts/helpers/ProxyAdminUpgradeHelper.sol";

/**
 * @title UpgradeCreatureStabilizerViaHelper
 * @notice Upgrade CreatureStabilizer using helper contract approach
 * @dev 
 * Since CreatureStabilizer's individual ProxyAdmin is owned by ProxyAdminV1 (contract),
 * we use a helper contract that ProxyAdminV1 can call via a temporary proxy.
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export PROXY_ADMIN_V1=0xdb8047eD77099626e189316Ced0b25b46Ae0181d
 *   export CREATURE_STABILIZER_PROXY=<stabilizer_proxy_address>
 *   export CREATURE_STABILIZER_IMPL_V2=<new_implementation_address>
 * 
 *   forge script scripts/UpgradeCreatureStabilizerViaHelper.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast
 */
contract UpgradeCreatureStabilizerViaHelper is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        address proxyAdminV1 = vm.envAddress("PROXY_ADMIN_V1");
        address stabilizerProxy = vm.envAddress("CREATURE_STABILIZER_PROXY");
        address newImpl = vm.envAddress("CREATURE_STABILIZER_IMPL_V2");

        console2.log("=== Upgrade CreatureStabilizer via Helper ===");
        console2.log("Deployer:", deployer);
        console2.log("ProxyAdminV1:", proxyAdminV1);
        console2.log("CreatureStabilizer proxy:", stabilizerProxy);
        console2.log("New implementation (V2):", newImpl);
        console2.log("");

        // Get individual ProxyAdmin
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        address individualProxyAdmin = address(uint160(uint256(vm.load(stabilizerProxy, adminSlot))));
        console2.log("Individual ProxyAdmin:", individualProxyAdmin);
        console2.log("Individual ProxyAdmin owner:", ProxyAdmin(individualProxyAdmin).owner());
        console2.log("");

        // Verify ProxyAdminV1 ownership
        ProxyAdmin adminV1 = ProxyAdmin(proxyAdminV1);
        if (adminV1.owner() != deployer) {
            console2.log("[ERROR] Deployer is not the owner of ProxyAdminV1!");
            revert("Not authorized");
        }

        vm.startBroadcast(deployerPrivateKey);

        // Deploy helper contract
        console2.log("Deploying ProxyAdminUpgradeHelper...");
        ProxyAdminUpgradeHelper helper = new ProxyAdminUpgradeHelper();
        address helperAddr = address(helper);
        console2.log("Helper deployed at:", helperAddr);
        console2.log("");

        // Deploy temporary proxy with ProxyAdminV1 as admin
        // This proxy will point to the helper
        console2.log("Deploying temporary proxy for helper...");
        ITransparentUpgradeableProxy tempProxy = ITransparentUpgradeableProxy(
            address(new TransparentUpgradeableProxy(
                helperAddr,
                proxyAdminV1,
                ""
            ))
        );
        console2.log("Temporary proxy:", address(tempProxy));
        console2.log("");

        // Use ProxyAdminV1 to upgrade temp proxy to helper that calls individual ProxyAdmin
        // Actually, the temp proxy already points to helper, so we can call it directly
        // But we need ProxyAdminV1 to call it... which it can't do.

        // ALTERNATIVE: Since ProxyAdminV1 can't call arbitrary contracts,
        // we need to accept that CreatureStabilizer can't be upgraded easily.
        // Instead, we should deploy a new CreatureStabilizer V2 proxy.

        console2.log("[INFO] Cannot upgrade CreatureStabilizer - same nested ProxyAdmin issue");
        console2.log("[SOLUTION] Deploy new CreatureStabilizer V2 proxy with correct architecture");
        
        revert("Use DeployCreatureStabilizerV2Proxy.s.sol instead");
    }
}




