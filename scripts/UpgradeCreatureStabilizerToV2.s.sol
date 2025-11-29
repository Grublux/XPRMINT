// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {CreatureStabilizer} from "../contracts/stabilization/CreatureStabilizer.sol";

/**
 * @title UpgradeCreatureStabilizerToV2
 * @notice Upgrade CreatureStabilizer proxy to V2 implementation (with setItemToken)
 * @dev Uses the individual ProxyAdmin (owned by deployer) to upgrade
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export CREATURE_STABILIZER_PROXY=<stabilizer_proxy_address>
 *   export CREATURE_STABILIZER_IMPL_V2=<new_implementation_address>
 * 
 *   forge script scripts/UpgradeCreatureStabilizerToV2.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast
 */
contract UpgradeCreatureStabilizerToV2 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        address stabilizerProxy = vm.envAddress("CREATURE_STABILIZER_PROXY");
        address newImpl = vm.envAddress("CREATURE_STABILIZER_IMPL_V2");

        console2.log("=== Upgrade CreatureStabilizer to V2 ===");
        console2.log("Deployer:", deployer);
        console2.log("CreatureStabilizer proxy:", stabilizerProxy);
        console2.log("New implementation (V2):", newImpl);
        console2.log("");

        // Get the individual ProxyAdmin from the proxy's admin slot
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        address individualProxyAdmin = address(uint160(uint256(vm.load(stabilizerProxy, adminSlot))));
        console2.log("Individual ProxyAdmin:", individualProxyAdmin);
        
        // Verify ownership
        address adminOwner = ProxyAdmin(individualProxyAdmin).owner();
        console2.log("Individual ProxyAdmin owner:", adminOwner);
        
        if (adminOwner != deployer) {
            console2.log("[ERROR] Deployer is not the owner of individual ProxyAdmin!");
            revert("Not authorized");
        }

        // Check current implementation
        CreatureStabilizer stabilizer = CreatureStabilizer(stabilizerProxy);
        address currentItemToken = stabilizer.itemToken();
        console2.log("Current itemToken:", currentItemToken);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Upgrade proxy
        console2.log("Upgrading CreatureStabilizer proxy to V2...");
        ProxyAdmin(individualProxyAdmin).upgradeAndCall(
            ITransparentUpgradeableProxy(stabilizerProxy),
            newImpl,
            ""
        );
        
        vm.stopBroadcast();

        // Verify upgrade
        address newItemToken = stabilizer.itemToken();
        console2.log("");
        console2.log("[OK] Upgrade complete!");
        console2.log("Verification:");
        console2.log("  itemToken:", newItemToken);
        console2.log("  (should still be ITEM_V1 until we call setItemToken)");
    }
}



