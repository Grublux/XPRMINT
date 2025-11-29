// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

/**
 * @title GenericV3SmokeTest
 * @notice Non-Goob-gated V3 smoke test for CreatureStabilizer + ItemToken on any deployed network
 * @dev Tests all major functions: initialization, claiming, applying items, burning, vibes, locking
 * 
 * Usage:
 *   export RPC="https://apechain.calderachain.xyz/http"
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export STAB_V3=0xe5fb969eec4985e8EB92334fFE11EA45035467CB
 *   export ITEM_V3=0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8
 * 
 *   forge script scripts/GenericV3SmokeTest.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast \
 *     -vvvv
 */
// CreatureState struct matching on-chain layout
struct CreatureState {
    uint8 vibes;
    uint8 lockedCount;
    uint16 targetSal;
    uint16 targetPH;
    uint16 targetTemp;
    uint16 targetFreq;
    uint16 currSal;
    uint16 currPH;
    uint16 currTemp;
    uint16 currFreq;
    bool lockedSal;
    bool lockedPH;
    bool lockedTemp;
    bool lockedFreq;
    uint40 stabilizedAt;
    uint16 consecutiveVibeMax;
    bool enhancedDrip;
    uint16 bondedSP;
}

// Minimal interfaces
interface ICreatureStabilizerV3 {
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
    function claimDailyItems(uint256 creatureId) external;
    function applyItem(uint256 creatureId, uint256 itemId) external;
    function burnItemForSP(uint256 creatureId, uint256 itemId) external;
    function sendVibes(uint256 creatureId) external;
    function lockTrait(uint256 creatureId, uint8 traitIndex) external;
    function getCreatureState(uint256 creatureId) external view returns (CreatureState memory);
    function walletSP(address wallet) external view returns (uint32);
}

interface IItem1155V3 {
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

contract GenericV3SmokeTest is Script {
    uint256 constant CREATURE_ID = 999999;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address stabV3 = vm.envAddress("STAB_V3");
        address itemV3 = vm.envAddress("ITEM_V3");

        console2.log("=== Generic V3 Smoke Test ===");
        console2.log("Deployer:", deployer);
        console2.log("STAB_V3:", stabV3);
        console2.log("ITEM_V3:", itemV3);
        console2.log("CREATURE_ID:", CREATURE_ID);
        console2.log("");

        ICreatureStabilizerV3 stabilizer = ICreatureStabilizerV3(stabV3);
        IItem1155V3 itemToken = IItem1155V3(itemV3);

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Disable Goobs enforcement if present
        _disableGoobsEnforcement(stabilizer);

        // Step 2: Initialize creature
        _initializeCreature(stabilizer);

        vm.stopBroadcast();

        // Step 3: Claim daily items
        _claimDailyItems(stabilizer, itemToken, deployer, deployerPrivateKey);

        // Step 4: Apply first item (if any)
        _applyFirstItem(stabilizer, itemToken, deployer, deployerPrivateKey);

        // Step 5: Burn second item for SP (if any)
        _burnItemForSP(stabilizer, itemToken, deployer, deployerPrivateKey);

        // Step 6: Send vibes
        _sendVibes(stabilizer, deployerPrivateKey);

        // Step 7: Attempt to lock trait
        _lockTrait(stabilizer, deployerPrivateKey);

        // Step 8: Final summary
        _finalSummary(stabilizer, deployer);

        console2.log("");
        console2.log("=== Smoke Test Complete ===");
    }

    function _disableGoobsEnforcement(ICreatureStabilizerV3 stabilizer) internal {
        console2.log("=== Step 1: Disable Goobs Enforcement ===");
        try stabilizer.enforceGoobsOwnership() returns (bool isEnforcing) {
            if (isEnforcing) {
                try stabilizer.setEnforceGoobsOwnership(false) {
                    console2.log("[OK] Goobs enforcement disabled");
                } catch Error(string memory reason) {
                    console2.log("[WARN] Failed to disable enforcement:", reason);
                } catch {
                    console2.log("[WARN] Failed to disable enforcement (unknown error)");
                }
            } else {
                console2.log("[SKIP] Goobs enforcement already disabled");
            }
        } catch {
            console2.log("[SKIP] Goobs enforcement not present in contract");
        }
        console2.log("");
    }

    function _initializeCreature(ICreatureStabilizerV3 stabilizer) internal {
        console2.log("=== Step 2: Initialize Creature ===");
        console2.log("Initializing creature", CREATURE_ID, "with:");
        console2.log("  Targets: 50, 50, 50, 50");
        console2.log("  Currents: 70, 70, 70, 70");

        try stabilizer.initializeCreature(CREATURE_ID, 50, 50, 50, 50, 70, 70, 70, 70) {
            console2.log("[OK] Creature initialized");
        } catch Error(string memory reason) {
            if (_contains(reason, "already initialized")) {
                console2.log("[SKIP] Creature already initialized");
            } else {
                console2.log("[ERROR] Initialization failed:", reason);
            }
        } catch {
            console2.log("[ERROR] Initialization failed with unknown error");
        }
        console2.log("");
    }

    function _claimDailyItems(ICreatureStabilizerV3 stabilizer, IItem1155V3 itemToken, address deployer, uint256 deployerPrivateKey) internal {
        console2.log("=== Step 3: Claim Daily Items ===");
        uint256[] memory balancesBefore = new uint256[](64);
        for (uint256 i = 0; i < 64; i++) {
            balancesBefore[i] = itemToken.balanceOf(deployer, i);
        }

        vm.startBroadcast(deployerPrivateKey);
        try stabilizer.claimDailyItems(CREATURE_ID) {
            console2.log("[OK] Daily items claimed");
        } catch Error(string memory reason) {
            console2.log("[ERROR] Claim failed:", reason);
        } catch {
            console2.log("[ERROR] Claim failed with unknown error");
        }
        vm.stopBroadcast();

        uint256 receivedCount = 0;
        console2.log("Items received:");
        for (uint256 i = 0; i < 64; i++) {
            uint256 balanceAfter = itemToken.balanceOf(deployer, i);
            if (balanceAfter > balancesBefore[i]) {
                console2.log("  Item", i, "- balance:", balanceAfter);
                receivedCount++;
            }
        }
        if (receivedCount == 0) {
            console2.log("  [WARN] No new items received (may have already claimed today)");
        }
        console2.log("");
    }

    function _applyFirstItem(ICreatureStabilizerV3 stabilizer, IItem1155V3 itemToken, address deployer, uint256 deployerPrivateKey) internal {
        console2.log("=== Step 4: Apply First Item ===");
        
        // Find first item with balance > 0
        uint256 applyItemId = type(uint256).max;
        for (uint256 i = 0; i < 64; i++) {
            if (itemToken.balanceOf(deployer, i) > 0) {
                applyItemId = i;
                break;
            }
        }

        if (applyItemId == type(uint256).max) {
            console2.log("[SKIP] No items available to apply");
            console2.log("");
            return;
        }

        console2.log("Applying item", applyItemId);

        // Get state before
        CreatureState memory stateBefore = stabilizer.getCreatureState(CREATURE_ID);
        console2.log("Currents before: Sal=", stateBefore.currSal, "pH=", stateBefore.currPH, "Temp=", stateBefore.currTemp, "Freq=", stateBefore.currFreq);

        vm.startBroadcast(deployerPrivateKey);
        try stabilizer.applyItem(CREATURE_ID, applyItemId) {
            console2.log("[OK] Item applied");
        } catch Error(string memory reason) {
            console2.log("[ERROR] Apply failed:", reason);
        } catch {
            console2.log("[ERROR] Apply failed with unknown error");
        }
        vm.stopBroadcast();

        // Get state after
        CreatureState memory stateAfter = stabilizer.getCreatureState(CREATURE_ID);
        console2.log("Currents after:  Sal=", stateAfter.currSal, "pH=", stateAfter.currPH, "Temp=", stateAfter.currTemp, "Freq=", stateAfter.currFreq);
        console2.log("");
    }

    function _burnItemForSP(ICreatureStabilizerV3 stabilizer, IItem1155V3 itemToken, address deployer, uint256 deployerPrivateKey) internal {
        console2.log("=== Step 5: Burn Item for SP ===");
        
        // Find second item with balance > 0 (skip the first one we might have applied)
        uint256 burnItemId = type(uint256).max;
        uint256 foundCount = 0;
        for (uint256 i = 0; i < 64; i++) {
            if (itemToken.balanceOf(deployer, i) > 0) {
                foundCount++;
                if (foundCount == 2) {
                    burnItemId = i;
                    break;
                }
            }
        }

        if (burnItemId == type(uint256).max) {
            console2.log("[SKIP] No second item available to burn");
            console2.log("");
            return;
        }

        console2.log("Burning item", burnItemId, "for SP");
        uint32 spBefore = stabilizer.walletSP(deployer);
        console2.log("SP before:", spBefore);

        vm.startBroadcast(deployerPrivateKey);
        try stabilizer.burnItemForSP(CREATURE_ID, burnItemId) {
            console2.log("[OK] Item burned");
        } catch Error(string memory reason) {
            console2.log("[ERROR] Burn failed:", reason);
        } catch {
            console2.log("[ERROR] Burn failed with unknown error");
        }
        vm.stopBroadcast();

        uint32 spAfter = stabilizer.walletSP(deployer);
        console2.log("SP after:", spAfter);
        console2.log("SP gained:", spAfter - spBefore);
        console2.log("");
    }

    function _sendVibes(ICreatureStabilizerV3 stabilizer, uint256 deployerPrivateKey) internal {
        console2.log("=== Step 6: Send Vibes ===");
        vm.startBroadcast(deployerPrivateKey);
        try stabilizer.sendVibes(CREATURE_ID) {
            console2.log("[OK] Vibes sent");
        } catch Error(string memory reason) {
            console2.log("[WARN] Send vibes failed:", reason);
        } catch {
            console2.log("[WARN] Send vibes failed with unknown error");
        }
        vm.stopBroadcast();

        CreatureState memory state = stabilizer.getCreatureState(CREATURE_ID);
        console2.log("Vibes after:", state.vibes);
        console2.log("Streak days after:", state.consecutiveVibeMax);
        console2.log("");
    }

    function _lockTrait(ICreatureStabilizerV3 stabilizer, uint256 deployerPrivateKey) internal {
        console2.log("=== Step 7: Lock Trait (Optional) ===");
        vm.startBroadcast(deployerPrivateKey);
        try stabilizer.lockTrait(CREATURE_ID, 0) {
            console2.log("[OK] Trait locked (Salinity)");
        } catch Error(string memory reason) {
            console2.log("[WARN] Lock trait failed (may not be close enough):", reason);
        } catch {
            console2.log("[WARN] Lock trait failed with unknown error");
        }
        vm.stopBroadcast();
        console2.log("");
    }

    function _finalSummary(ICreatureStabilizerV3 stabilizer, address deployer) internal {
        console2.log("=== Final Summary ===");
        CreatureState memory state = stabilizer.getCreatureState(CREATURE_ID);
        uint32 walletSP = stabilizer.walletSP(deployer);

        console2.log("Targets: Sal=", state.targetSal, "pH=", state.targetPH, "Temp=", state.targetTemp, "Freq=", state.targetFreq);
        console2.log("Currents: Sal=", state.currSal, "pH=", state.currPH, "Temp=", state.currTemp, "Freq=", state.currFreq);
        console2.log("Vibes:", state.vibes);
        console2.log("Locked count:", state.lockedCount);
        console2.log("Streak days:", state.consecutiveVibeMax);
        console2.log("Locks: Sal=", state.lockedSal ? "true" : "false", "pH=", state.lockedPH ? "true" : "false", "Temp=", state.lockedTemp ? "true" : "false", "Freq=", state.lockedFreq ? "true" : "false");
        console2.log("Wallet SP:", walletSP);
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory haystackBytes = bytes(haystack);
        bytes memory needleBytes = bytes(needle);
        if (needleBytes.length > haystackBytes.length) {
            return false;
        }
        for (uint256 i = 0; i <= haystackBytes.length - needleBytes.length; i++) {
            bool match = true;
            for (uint256 j = 0; j < needleBytes.length; j++) {
                if (haystackBytes[i + j] != needleBytes[j]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                return true;
            }
        }
        return false;
    }
}


