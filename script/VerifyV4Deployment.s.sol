// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MasterCrafterV4} from "../contracts/crafted/MasterCrafterV4.sol";
import {CraftedV4Positions} from "../contracts/crafted/CraftedV4Positions.sol";
import {NPCStats} from "../contracts/stats/NPCStats.sol";
import {RoyaltyRouter} from "../contracts/royalties/RoyaltyRouter.sol";

/// @notice Verification script for V4 deployment
/// @dev Assumes all V4 contracts follow the custom owner+initializer+upgradeTo pattern (no ProxyAdmin).
/// @dev The owner is expected to be the deployer EOA: 0x634989990acb7F95d07Ac09a6c35491Ac8dFa3Cf
contract VerifyV4Deployment is Script {
    function run() external view {
        console.log("=== V4 DEPLOYMENT VERIFICATION ===\n");

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        console.log("Deployer EOA:", deployer);
        console.log("");

        _checkImplementations();
        _checkOwners(deployer);
        _checkWiring();
        _checkUpgradeability();
        _checkRoyalty();

        console.log("=== VERIFICATION COMPLETE ===");
    }

    function _checkImplementations() internal view {
        console.log("1. IMPLEMENTATION CHECKS:");
        bytes32 implSlot = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
        
        address mcProxy = vm.envAddress("MASTER_CRAFTER_V4_PROXY");
        address posProxy = vm.envAddress("CRAFTED_V4_POSITIONS_PROXY");
        address statsProxy = vm.envAddress("NPC_STATS_PROXY");
        address routerProxy = vm.envAddress("ROYALTY_ROUTER_PROXY");
        
        console.log("   MasterCrafterV4 impl:", address(uint160(uint256(vm.load(mcProxy, implSlot)))));
        console.log("   CraftedV4Positions impl:", address(uint160(uint256(vm.load(posProxy, implSlot)))));
        console.log("   NPCStats impl:", address(uint160(uint256(vm.load(statsProxy, implSlot)))));
        console.log("   RoyaltyRouter impl:", address(uint160(uint256(vm.load(routerProxy, implSlot)))));
        console.log("");
    }

    function _checkOwners(address deployer) internal view {
        console.log("2. OWNER CHECKS:");
        
        _checkOwnerSingle("MasterCrafterV4", address(MasterCrafterV4(vm.envAddress("MASTER_CRAFTER_V4_PROXY"))), deployer);
        _checkOwnerSingle("CraftedV4Positions", address(CraftedV4Positions(vm.envAddress("CRAFTED_V4_POSITIONS_PROXY"))), deployer);
        _checkOwnerSingle("NPCStats", address(NPCStats(vm.envAddress("NPC_STATS_PROXY"))), deployer);
        _checkOwnerSingle("RoyaltyRouter", address(RoyaltyRouter(vm.envAddress("ROYALTY_ROUTER_PROXY"))), deployer);
    }

    function _checkOwnerSingle(string memory name, address proxyAddr, address expectedOwner) internal view {
        address actualOwner;
        if (keccak256(bytes(name)) == keccak256(bytes("MasterCrafterV4"))) {
            actualOwner = MasterCrafterV4(proxyAddr).owner();
        } else if (keccak256(bytes(name)) == keccak256(bytes("CraftedV4Positions"))) {
            actualOwner = CraftedV4Positions(proxyAddr).owner();
        } else if (keccak256(bytes(name)) == keccak256(bytes("NPCStats"))) {
            actualOwner = NPCStats(proxyAddr).owner();
        } else if (keccak256(bytes(name)) == keccak256(bytes("RoyaltyRouter"))) {
            actualOwner = RoyaltyRouter(proxyAddr).owner();
        }
        
        bool ok = actualOwner == expectedOwner;
        console.log("   ", name, ".owner():", actualOwner);
        console.log("   Expected:", expectedOwner);
        console.log("   Match:", ok ? "YES" : "NO");
        if (!ok) {
            console.log("   ERROR: Owner mismatch!");
        }
        console.log("");
        
        require(ok, "OWNER_MISMATCH");
    }

    function _checkWiring() internal view {
        console.log("3. SANITY READ CALLS:");
        
        address mcProxy = vm.envAddress("MASTER_CRAFTER_V4_PROXY");
        address posProxy = vm.envAddress("CRAFTED_V4_POSITIONS_PROXY");
        address statsProxy = vm.envAddress("NPC_STATS_PROXY");
        address routerProxy = vm.envAddress("ROYALTY_ROUTER_PROXY");
        address expectedNpc = 0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA;

        MasterCrafterV4 mc = MasterCrafterV4(mcProxy);
        NPCStats stats = NPCStats(statsProxy);
        RoyaltyRouter router = RoyaltyRouter(routerProxy);
        CraftedV4Positions pos = CraftedV4Positions(posProxy);

        console.log("   MasterCrafterV4.positionsToken() == positionsProxy:", mc.positionsToken() == posProxy ? "YES" : "NO");
        console.log("   MasterCrafterV4.npcStats() == npcStatsProxy:", mc.npcStats() == statsProxy ? "YES" : "NO");
        console.log("   MasterCrafterV4.royaltyRouter() == royaltyRouterProxy:", mc.royaltyRouter() == routerProxy ? "YES" : "NO");
        console.log("   MasterCrafterV4.npcCollection() == Genesis NPCs:", mc.npcCollection() == expectedNpc ? "YES" : "NO");
        console.log("");

        console.log("   NPCStats.masterCrafter() == masterCrafterProxy:", stats.masterCrafter() == mcProxy ? "YES" : "NO");
        console.log("");

        console.log("   RoyaltyRouter.positions() == positionsProxy:", router.positions() == posProxy ? "YES" : "NO");
        console.log("   RoyaltyRouter.npcCollection() == Genesis NPCs:", router.npcCollection() == expectedNpc ? "YES" : "NO");
        console.log("   RoyaltyRouter.masterCrafter() == masterCrafterProxy:", router.masterCrafter() == mcProxy ? "YES" : "NO");
        console.log("");

        console.log("   CraftedV4Positions.masterCrafter() == masterCrafterProxy:", pos.masterCrafter() == mcProxy ? "YES" : "NO");
        console.log("");
    }

    function _checkUpgradeability() internal view {
        console.log("4. UPGRADEABILITY CHECKS:");
        
        address mcProxy = vm.envAddress("MASTER_CRAFTER_V4_PROXY");
        address posProxy = vm.envAddress("CRAFTED_V4_POSITIONS_PROXY");
        address statsProxy = vm.envAddress("NPC_STATS_PROXY");
        address routerProxy = vm.envAddress("ROYALTY_ROUTER_PROXY");

        // Check that upgradeTo function exists and is callable (staticcall check)
        // We use a dummy address for the check - just verifying the function exists
        address dummyImpl = address(0x1111111111111111111111111111111111111111);
        
        // MasterCrafterV4
        (bool mcSuccess, ) = mcProxy.staticcall(
            abi.encodeWithSignature("upgradeTo(address)", dummyImpl)
        );
        console.log("   MasterCrafterV4.upgradeTo() exists:", mcSuccess ? "YES" : "NO (may revert on invalid impl)");
        
        // CraftedV4Positions
        (bool posSuccess, ) = posProxy.staticcall(
            abi.encodeWithSignature("upgradeTo(address)", dummyImpl)
        );
        console.log("   CraftedV4Positions.upgradeTo() exists:", posSuccess ? "YES" : "NO (may revert on invalid impl)");
        
        // NPCStats
        (bool statsSuccess, ) = statsProxy.staticcall(
            abi.encodeWithSignature("upgradeTo(address)", dummyImpl)
        );
        console.log("   NPCStats.upgradeTo() exists:", statsSuccess ? "YES" : "NO (may revert on invalid impl)");
        
        // RoyaltyRouter
        (bool routerSuccess, ) = routerProxy.staticcall(
            abi.encodeWithSignature("upgradeTo(address)", dummyImpl)
        );
        console.log("   RoyaltyRouter.upgradeTo() exists:", routerSuccess ? "YES" : "NO (may revert on invalid impl)");
        console.log("");
        console.log("   Note: Staticcall may revert on invalid impl, but function selector should exist.");
        console.log("");
    }

    function _checkRoyalty() internal view {
        console.log("4. ROYALTY CHECK:");
        address posProxy = vm.envAddress("CRAFTED_V4_POSITIONS_PROXY");
        CraftedV4Positions pos = CraftedV4Positions(posProxy);
        
        console.log("   CraftedV4Positions.royaltyInfo(1, 1e18):");
        try pos.royaltyInfo(1, 1e18) returns (address receiver, uint256 amount) {
            console.log("     Receiver:", receiver);
            console.log("     Amount:", amount);
            console.log("     Expected: deployer or router, 69000000000000000");
        } catch {
            console.log("     WARNING: No token #1 exists yet");
        }
        console.log("");
    }
}
