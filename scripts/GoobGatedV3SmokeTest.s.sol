// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

/**
 * @title GoobGatedV3SmokeTest
 * @notice Full end-to-end smoke test for V3 Stabilization System with Goobs gating
 * @dev Tests all major functions: initialization, claiming, applying items, burning, vibes, locking
 * 
 * Usage:
 *   export RPC="https://apechain.calderachain.xyz/http"
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export STAB_V3=0xe5fb969eec4985e8EB92334fFE11EA45035467CB
 *   export ITEM_V3=0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8
 *   export GOOBS_721=<goobs_erc721_address>  (or GOOBS_CONTRACT)
 *   export GOOB_ID=<token_id_owned_by_deployer>  (or CREATURE_ID)
 * 
 *   forge script scripts/GoobGatedV3SmokeTest.s.sol \
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
interface IGoobs {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface ICreatureStabilizer {
    function goobs() external view returns (address);
    function enforceGoobsOwnership() external view returns (bool);
    function setGoobs(address _goobs) external;
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
    function lastClaimDay(uint256) external view returns (uint32);
    function lastVibesDay(uint256) external view returns (uint32);
}

interface IItemToken1155 {
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

contract GoobGatedV3SmokeTest is Script {
    function _logCreatureState(ICreatureStabilizer stabilizer, uint256 creatureId) internal view {
        CreatureState memory s = stabilizer.getCreatureState(creatureId);
        console2.log(string(abi.encodePacked("Targets: Sal=", vm.toString(s.targetSal), " pH=", vm.toString(s.targetPH), " Temp=", vm.toString(s.targetTemp), " Freq=", vm.toString(s.targetFreq))));
        console2.log(string(abi.encodePacked("Currents: Sal=", vm.toString(s.currSal), " pH=", vm.toString(s.currPH), " Temp=", vm.toString(s.currTemp), " Freq=", vm.toString(s.currFreq))));
        console2.log("Vibes:", s.vibes);
        console2.log("Locked count:", s.lockedCount);
        console2.log("Streak days:", s.consecutiveVibeMax);
        console2.log(string(abi.encodePacked("Locks: Sal=", s.lockedSal ? "true" : "false", " pH=", s.lockedPH ? "true" : "false", " Temp=", s.lockedTemp ? "true" : "false", " Freq=", s.lockedFreq ? "true" : "false")));
        console2.log("Last claim day:", stabilizer.lastClaimDay(creatureId));
        console2.log("Last vibes day:", stabilizer.lastVibesDay(creatureId));
    }

    function _configureGoobs(ICreatureStabilizer stabilizer, address goobs721, uint256 deployerPrivateKey) internal {
        console2.log("=== Step 1: Goobs Gating Configuration ===");
        address currentGoobs = stabilizer.goobs();
        bool currentEnforcement = stabilizer.enforceGoobsOwnership();
        console2.log("Current goobs address:", currentGoobs);
        console2.log("Current enforcement:", currentEnforcement);

        vm.startBroadcast(deployerPrivateKey);
        if (currentGoobs != goobs721) {
            console2.log("Setting goobs address to:", goobs721);
            stabilizer.setGoobs(goobs721);
            console2.log("[OK] Goobs address set");
        } else {
            console2.log("[SKIP] Goobs address already configured");
        }
        if (!currentEnforcement) {
            console2.log("Enabling Goobs ownership enforcement");
            stabilizer.setEnforceGoobsOwnership(true);
            console2.log("[OK] Enforcement enabled");
        } else {
            console2.log("[SKIP] Enforcement already enabled");
        }
        vm.stopBroadcast();
        console2.log("");
    }

    function _initializeCreature(ICreatureStabilizer stabilizer, uint256 goobId, uint256 deployerPrivateKey) internal {
        console2.log("=== Step 2: Initialize Creature ===");
        CreatureState memory s = stabilizer.getCreatureState(goobId);
        bool alreadyInitialized = s.targetSal != 0 || s.targetPH != 0 || s.targetTemp != 0 || s.targetFreq != 0;
        if (alreadyInitialized) {
            console2.log("[WARN] Creature already initialized, skipping initialization");
        } else {
            console2.log("Initializing creature with:");
            console2.log("  Targets: 50, 50, 50, 50");
            console2.log("  Currents: 70, 70, 70, 70");
            vm.startBroadcast(deployerPrivateKey);
            try stabilizer.initializeCreature(goobId, 50, 50, 50, 50, 70, 70, 70, 70) {
                console2.log("[OK] Creature initialized");
            } catch Error(string memory reason) {
                console2.log("[ERROR] Initialization failed:", reason);
            } catch {
                console2.log("[ERROR] Initialization failed with unknown error");
            }
            vm.stopBroadcast();
        }
        console2.log("");
    }

    function _findOwnedGoob(IGoobs goobs, address deployer, uint256 preferredGoobId) internal view returns (uint256) {
        // First, try the preferred Goob ID if provided
        if (preferredGoobId != 0) {
            try goobs.ownerOf(preferredGoobId) returns (address owner) {
                if (owner == deployer) {
                    console2.log("[OK] Using specified Goob:", preferredGoobId);
                    return preferredGoobId;
                }
            } catch {}
        }
        
        // Try 888 first (user mentioned it's owned)
        try goobs.ownerOf(888) returns (address owner) {
            if (owner == deployer) {
                console2.log("[OK] Found owned Goob: 888");
                return 888;
            }
        } catch {}
        
        // Try a few other common IDs
        uint256[] memory commonIds = new uint256[](5);
        commonIds[0] = 1;
        commonIds[1] = 2;
        commonIds[2] = 3;
        commonIds[3] = 100;
        commonIds[4] = 500;
        
        console2.log("[INFO] Searching common Goob IDs...");
        for (uint256 i = 0; i < commonIds.length; i++) {
            try goobs.ownerOf(commonIds[i]) returns (address owner) {
                if (owner == deployer) {
                    console2.log("[OK] Found owned Goob:", commonIds[i]);
                    return commonIds[i];
                }
            } catch {}
        }
        
        revert("No owned Goob found. Please set CREATURE_ID=888 (or another Goob ID you own).");
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address stabV3 = vm.envAddress("STAB_V3");
        address itemV3 = vm.envAddress("ITEM_V3");
        address goobs721 = vm.envOr("GOOBS_721", vm.envAddress("GOOBS_CONTRACT"));
        uint256 preferredGoobId = vm.envOr("GOOB_ID", vm.envOr("CREATURE_ID", uint256(0)));

        console2.log("=== Goob-Gated V3 Smoke Test ===");
        console2.log("Deployer:", deployer);
        console2.log("STAB_V3:", stabV3);
        console2.log("ITEM_V3:", itemV3);
        console2.log("GOOBS_721:", goobs721);
        console2.log("");

        ICreatureStabilizer stabilizer = ICreatureStabilizer(stabV3);
        IItemToken1155 itemToken = IItemToken1155(itemV3);
        IGoobs goobs = IGoobs(goobs721);

        // Auto-detect owned Goob if not specified, or verify the specified one
        uint256 goobId = _findOwnedGoob(goobs, deployer, preferredGoobId);
        console2.log("[OK] Using Goob ID:", goobId);
        console2.log("");

        _configureGoobs(stabilizer, goobs721, deployerPrivateKey);
        _initializeCreature(stabilizer, goobId, deployerPrivateKey);

        console2.log("=== Step 3: Creature State ===");
        _logCreatureState(stabilizer, goobId);
        console2.log("");

        _claimDailyItems(stabilizer, itemToken, goobId, deployer, deployerPrivateKey);

        _applyItem(stabilizer, itemToken, goobId, deployer, deployerPrivateKey);
        _burnItemForSP(stabilizer, itemToken, goobId, deployer, deployerPrivateKey);
        _sendVibes(stabilizer, goobId, deployerPrivateKey);
        _lockTrait(stabilizer, goobId, deployerPrivateKey);

        console2.log("=== Final Summary ===");
        _logCreatureState(stabilizer, goobId);
        console2.log("Wallet SP:", stabilizer.walletSP(deployer));
        console2.log("");
        console2.log("=== Smoke Test Complete ===");
    }

    function _claimDailyItems(ICreatureStabilizer stabilizer, IItemToken1155 itemToken, uint256 goobId, address deployer, uint256 deployerPrivateKey) internal {
        console2.log("=== Step 4: Claim Daily Items ===");
        uint256[] memory balancesBefore = new uint256[](64);
        for (uint256 i = 0; i < 64; i++) {
            balancesBefore[i] = itemToken.balanceOf(deployer, i);
        }
        vm.startBroadcast(deployerPrivateKey);
        try stabilizer.claimDailyItems(goobId) {
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
                uint256 amount = balanceAfter - balancesBefore[i];
                console2.log(string(abi.encodePacked("  Item ", vm.toString(i), ": +", vm.toString(amount))));
                receivedCount += amount;
            }
        }
        if (receivedCount == 0) {
            console2.log("  [WARN] No new items received (may have already claimed today)");
        } else {
            console2.log("Total items received:", receivedCount);
        }
        console2.log("");
    }

    function _applyItem(ICreatureStabilizer stabilizer, IItemToken1155 itemToken, uint256 goobId, address deployer, uint256 deployerPrivateKey) internal {
        console2.log("=== Step 5: Apply Item ===");
        uint256 itemToApply = type(uint256).max;
        for (uint256 i = 0; i < 64; i++) {
            if (itemToken.balanceOf(deployer, i) > 0) {
                itemToApply = i;
                break;
            }
        }
        if (itemToApply == type(uint256).max) {
            console2.log("[WARN] No items available to apply, skipping");
        } else {
            console2.log("Applying item", itemToApply);
            CreatureState memory sBefore = stabilizer.getCreatureState(goobId);
            vm.startBroadcast(deployerPrivateKey);
            try stabilizer.applyItem(goobId, itemToApply) {
                console2.log("[OK] Item applied");
            } catch Error(string memory reason) {
                console2.log("[ERROR] Apply failed:", reason);
            } catch {
                console2.log("[ERROR] Apply failed with unknown error");
            }
            vm.stopBroadcast();
            CreatureState memory sAfter = stabilizer.getCreatureState(goobId);
            console2.log(string(abi.encodePacked("Currents before: Sal=", vm.toString(sBefore.currSal), " pH=", vm.toString(sBefore.currPH), " Temp=", vm.toString(sBefore.currTemp), " Freq=", vm.toString(sBefore.currFreq))));
            console2.log(string(abi.encodePacked("Currents after:  Sal=", vm.toString(sAfter.currSal), " pH=", vm.toString(sAfter.currPH), " Temp=", vm.toString(sAfter.currTemp), " Freq=", vm.toString(sAfter.currFreq))));
        }
        console2.log("");
    }

    function _burnItemForSP(ICreatureStabilizer stabilizer, IItemToken1155 itemToken, uint256 goobId, address deployer, uint256 deployerPrivateKey) internal {
        console2.log("=== Step 6: Burn Item for SP ===");
        uint256 itemToBurn = type(uint256).max;
        for (uint256 i = 0; i < 64; i++) {
            if (itemToken.balanceOf(deployer, i) > 0) {
                itemToBurn = i;
                break;
            }
        }
        if (itemToBurn == type(uint256).max) {
            console2.log("[WARN] No items available to burn, skipping");
        } else {
            uint32 spBefore = stabilizer.walletSP(deployer);
            console2.log("Burning item", itemToBurn);
            console2.log("SP before:", spBefore);
            vm.startBroadcast(deployerPrivateKey);
            try stabilizer.burnItemForSP(goobId, itemToBurn) {
                console2.log("[OK] Item burned");
            } catch Error(string memory reason) {
                console2.log("[ERROR] Burn failed:", reason);
            } catch {
                console2.log("[ERROR] Burn failed with unknown error");
            }
            vm.stopBroadcast();
            uint32 spAfter = stabilizer.walletSP(deployer);
            console2.log("SP after:", spAfter);
            if (spAfter > spBefore) {
                console2.log("SP gained:", spAfter - spBefore);
            }
        }
        console2.log("");
    }

    function _sendVibes(ICreatureStabilizer stabilizer, uint256 goobId, uint256 deployerPrivateKey) internal {
        console2.log("=== Step 7: Send Vibes ===");
        vm.startBroadcast(deployerPrivateKey);
        try stabilizer.sendVibes(goobId) {
            console2.log("[OK] Vibes sent");
        } catch Error(string memory reason) {
            console2.log("[ERROR] Send vibes failed:", reason);
        } catch {
            console2.log("[ERROR] Send vibes failed with unknown error");
        }
        vm.stopBroadcast();
        CreatureState memory s = stabilizer.getCreatureState(goobId);
        console2.log("Vibes after:", s.vibes);
        console2.log("Streak days after:", s.consecutiveVibeMax);
        console2.log("");
    }

    function _lockTrait(ICreatureStabilizer stabilizer, uint256 goobId, uint256 deployerPrivateKey) internal {
        console2.log("=== Step 8: Lock Trait (Optional) ===");
        vm.startBroadcast(deployerPrivateKey);
        try stabilizer.lockTrait(goobId, 0) {
            console2.log("[OK] Trait locked");
        } catch Error(string memory reason) {
            console2.log("[WARN] Lock trait failed (may not be close enough):", reason);
        } catch {
            console2.log("[WARN] Lock trait failed with unknown error");
        }
        vm.stopBroadcast();
        console2.log("");
    }
}

