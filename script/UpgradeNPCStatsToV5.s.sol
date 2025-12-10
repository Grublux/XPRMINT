// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseDeployer} from "./BaseDeployer.s.sol";
import {NPCStatsV5} from "../contracts/stats/NPCStatsV5.sol";
import {NPCStats} from "../contracts/stats/NPCStats.sol";
import {console} from "forge-std/console.sol";

/// @notice Upgrade existing NPCStats proxy to V5 using UUPS pattern (no ProxyAdmin)
/// @dev Calls upgradeTo() directly on the proxy, which delegates to implementation's upgradeTo()
contract UpgradeNPCStatsToV5 is BaseDeployer {
    function run() external {
        (uint256 pk, address deployer) = _loadDeployer();

        // Read NPCStats proxy address from env
        address npcStatsProxy = vm.envAddress("NPC_STATS_PROXY");

        console.log("Deployer:", deployer);
        console.log("NPCStats proxy:", npcStatsProxy);

        vm.startBroadcast(pk);

        // 1. Deploy new NPCStatsV5 implementation
        NPCStatsV5 impl = new NPCStatsV5();
        console.log("NPCStatsV5 implementation:", address(impl));

        // 2. Upgrade using UUPS pattern - call upgradeTo() directly on proxy
        // This delegates to the implementation's upgradeTo() which checks onlyOwner
        NPCStats proxy = NPCStats(npcStatsProxy);
        proxy.upgradeTo(address(impl));
        console.log("Upgraded NPCStats proxy to V5");

        vm.stopBroadcast();

        // 3. Verify owner is still correct
        NPCStatsV5 upgraded = NPCStatsV5(npcStatsProxy);
        address currentOwner = upgraded.owner();
        console.log("Current owner:", currentOwner);
        require(currentOwner == deployer, "OWNER_MISMATCH");

        console.log("\n=== UPGRADE SUMMARY ===");
        console.log("NPCStats proxy upgraded to V5");
        console.log("New implementation:", address(impl));
        console.log("Proxy address:", npcStatsProxy);
        console.log("Owner verified:", currentOwner);
    }
}

