// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseDeployer} from "./BaseDeployer.s.sol";
import {NPCStatsV5} from "../contracts/stats/NPCStatsV5.sol";
import {console} from "forge-std/console.sol";

/// @notice One-time Genesis reset script for NPCStats
/// @dev Assumes NPCStats proxy is already upgraded to V5
contract ResetNPCStatsGenesis is BaseDeployer {
    function run() external {
        (uint256 pk, address deployer) = _loadDeployer();

        // Read NPCStats proxy address from env
        address npcStatsProxy = vm.envAddress("NPC_STATS_PROXY");

        console.log("Deployer:", deployer);
        console.log("NPCStats proxy:", npcStatsProxy);

        // Define NPCs and forges to reset
        uint256[] memory npcIds = new uint256[](1);
        npcIds[0] = 1919;

        address[] memory forges = new address[](1);
        forges[0] = 0x634989990acb7F95d07Ac09a6c35491Ac8dFa3Cf; // Deployer forge

        NPCStatsV5 stats = NPCStatsV5(npcStatsProxy);

        // Log before stats
        console.log("\n=== BEFORE RESET ===");
        (
            uint64 crafted,
            uint64 returned,
            uint64 fee,
            uint64 coal,
            uint32 crafts,
            uint32 destroys
        ) = stats.getNPCStatsDecoded(1919);
        console.log("NPC 1919 stats:");
        console.log("  Crafted:", crafted);
        console.log("  Returned:", returned);
        console.log("  Fee:", fee);
        console.log("  Coal:", coal);
        console.log("  Crafts:", crafts);
        console.log("  Destroys:", destroys);

        NPCStatsV5.ForgeStats memory forgeStatsBefore = stats.getForgeStats(forges[0]);
        console.log("Forge stats:");
        console.log("  Crafted:", forgeStatsBefore.totalNGTCrafted);
        console.log("  Crafts:", forgeStatsBefore.crafts);

        vm.startBroadcast(pk);

        // Reset NPCs
        stats.resetNPCBatch(npcIds);
        console.log("\nReset NPC batch");

        // Reset forges
        stats.resetForgeBatch(forges);
        console.log("Reset forge batch");

        vm.stopBroadcast();

        // Log after stats
        console.log("\n=== AFTER RESET ===");
        (crafted, returned, fee, coal, crafts, destroys) = stats.getNPCStatsDecoded(1919);
        console.log("NPC 1919 stats:");
        console.log("  Crafted:", crafted);
        console.log("  Returned:", returned);
        console.log("  Fee:", fee);
        console.log("  Coal:", coal);
        console.log("  Crafts:", crafts);
        console.log("  Destroys:", destroys);

        NPCStatsV5.ForgeStats memory forgeStatsAfter = stats.getForgeStats(forges[0]);
        console.log("Forge stats:");
        console.log("  Crafted:", forgeStatsAfter.totalNGTCrafted);
        console.log("  Crafts:", forgeStatsAfter.crafts);

        // Verify all zeros
        require(crafted == 0 && returned == 0 && fee == 0 && coal == 0 && crafts == 0 && destroys == 0, "NPC_NOT_ZERO");
        require(forgeStatsAfter.totalNGTCrafted == 0 && forgeStatsAfter.crafts == 0, "FORGE_NOT_ZERO");

        console.log("\n=== RESET COMPLETE ===");
        console.log("All stats verified as zero");
    }
}

