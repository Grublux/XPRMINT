// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

/**
 * @title DevBypassCreatureInitV3
 * @notice Owner-only dev tool to temporarily disable Goobs gating, initialize a creature, then restore gating
 * @dev This script is for development/testing only. It bypasses Goobs ownership checks for initialization.
 * 
 * WARNING: This script temporarily disables Goobs enforcement. It will restore the previous state after initialization.
 * 
 * Usage:
 *   export RPC="https://apechain.calderachain.xyz/http"
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export STAB_V3=0xe5fb969eec4985e8EB92334fFE11EA45035467CB
 *   export DEV_CREATURE_ID=<creature_id_to_initialize>
 * 
 *   forge script scripts/DevBypassCreatureInitV3.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast \
 *     -vvvv
 */
contract DevBypassCreatureInitV3 is Script {
    // Minimal interface
    interface ICreatureStabilizer {
        function owner() external view returns (address);
        function enforceGoobsOwnership() external view returns (bool);
        function setEnforceGoobsOwnership(bool _enforce) external;
        function initializeCreature(
            uint256 creatureId,
            uint16 targetSal,
            uint16 targetPH,
            uint16 targetTemp,
            uint16 targetFreq,
            uint16 currSal,
            uint16 currPH,
            uint16 currTemp,
            uint16 currFreq
        ) external;
        function getCreatureState(uint256 creatureId) external view returns (
            uint16 targetSal,
            uint16 targetPH,
            uint16 targetTemp,
            uint16 targetFreq,
            uint16 currentSal,
            uint16 currentPH,
            uint16 currentTemp,
            uint16 currentFreq,
            uint8 lockedCount,
            uint8 vibes,
            uint8 streakDays,
            uint32 lastClaimDay,
            uint32 lastVibesDay
        );
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address stabV3 = vm.envAddress("STAB_V3");
        uint256 creatureId = vm.envUint("DEV_CREATURE_ID");

        console2.log("=== Dev Bypass Creature Initializer ===");
        console2.log("Deployer:", deployer);
        console2.log("STAB_V3:", stabV3);
        console2.log("DEV_CREATURE_ID:", creatureId);
        console2.log("");

        ICreatureStabilizer stabilizer = ICreatureStabilizer(stabV3);

        // Verify deployer is owner
        require(stabilizer.owner() == deployer, "DevBypassCreatureInitV3: deployer is not owner");
        console2.log("[OK] Deployer is owner of STAB_V3");
        console2.log("");

        // Check if creature is already initialized
        (uint16 targetSal, uint16 targetPH, uint16 targetTemp, uint16 targetFreq,,,,,,,) = stabilizer.getCreatureState(creatureId);
        bool alreadyInitialized = targetSal != 0 || targetPH != 0 || targetTemp != 0 || targetFreq != 0;

        if (alreadyInitialized) {
            console2.log("[WARN] Creature", creatureId, "is already initialized");
            console2.log("Current targets: Sal=", targetSal, "pH=", targetPH, "Temp=", targetTemp, "Freq=", targetFreq);
            console2.log("Skipping initialization");
            return;
        }

        // Read and store current enforcement state
        bool wasEnforcing = stabilizer.enforceGoobsOwnership();
        console2.log("Current enforceGoobsOwnership:", wasEnforcing);

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Disable enforcement if currently enabled
        if (wasEnforcing) {
            console2.log("Temporarily disabling Goobs enforcement...");
            stabilizer.setEnforceGoobsOwnership(false);
            console2.log("[OK] Enforcement disabled");
        } else {
            console2.log("[SKIP] Enforcement already disabled");
        }

        // Step 2: Initialize creature
        console2.log("");
        console2.log("Initializing creature", creatureId, "with:");
        console2.log("  Targets: 50, 50, 50, 50");
        console2.log("  Currents: 70, 70, 70, 70");

        try stabilizer.initializeCreature(creatureId, 50, 50, 50, 50, 70, 70, 70, 70) {
            console2.log("[OK] Creature initialized successfully");
        } catch Error(string memory reason) {
            console2.log("[ERROR] Initialization failed:", reason);
            // Still restore enforcement even if init failed
            if (wasEnforcing) {
                console2.log("Restoring enforcement state...");
                stabilizer.setEnforceGoobsOwnership(true);
                console2.log("[OK] Enforcement restored");
            }
            vm.stopBroadcast();
            return;
        } catch {
            console2.log("[ERROR] Initialization failed with unknown error");
            // Still restore enforcement even if init failed
            if (wasEnforcing) {
                console2.log("Restoring enforcement state...");
                stabilizer.setEnforceGoobsOwnership(true);
                console2.log("[OK] Enforcement restored");
            }
            vm.stopBroadcast();
            return;
        }

        // Step 3: Restore enforcement to previous state
        console2.log("");
        if (wasEnforcing) {
            console2.log("Restoring Goobs enforcement to previous state...");
            stabilizer.setEnforceGoobsOwnership(true);
            console2.log("[OK] Enforcement restored");
        } else {
            console2.log("[SKIP] Enforcement was already disabled, no restore needed");
        }

        vm.stopBroadcast();

        // Verify final state
        console2.log("");
        console2.log("=== Verification ===");
        (uint16 finalTSal, uint16 finalTPH, uint16 finalTTemp, uint16 finalTFreq,,,,,,,) = stabilizer.getCreatureState(creatureId);
        bool finalEnforcement = stabilizer.enforceGoobsOwnership();

        console2.log("Creature initialized:");
        console2.log("  Targets: Sal=", finalTSal, "pH=", finalTPH, "Temp=", finalTTemp, "Freq=", finalTFreq);
        console2.log("Enforcement restored:", finalEnforcement == wasEnforcing ? "YES" : "NO");

        if (finalEnforcement != wasEnforcing) {
            console2.log("[WARN] Enforcement state mismatch! Expected:", wasEnforcing, "Got:", finalEnforcement);
        }

        console2.log("");
        console2.log("=== Dev Bypass Complete ===");
    }
}




