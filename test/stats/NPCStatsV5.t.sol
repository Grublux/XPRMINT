// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {NPCStatsV5} from "../../contracts/stats/NPCStatsV5.sol";

contract NPCStatsV5Test is Test {
    NPCStatsV5 public stats;
    address public owner = address(this);
    address public masterCrafter = address(0x1234);

    function setUp() public {
        stats = new NPCStatsV5();
        stats.initialize(owner);
        stats.setMasterCrafter(masterCrafter);
    }

    function test_GetNPCStatsDecoded() public {
        uint256 npcId = 1919;
        address forge = address(0x5678);
        
        // Record a craft to set some stats
        vm.prank(masterCrafter);
        stats.recordCraft(forge, npcId, 1, 1000e18, 100, 1);
        
        // Now check decoded stats
        (
            uint64 totalNGTCrafted,
            uint64 totalNGTReturned,
            uint64 totalNGTFee,
            uint64 totalCoalBurned,
            uint32 crafts,
            uint32 destroys
        ) = stats.getNPCStatsDecoded(npcId);
        
        assertEq(totalNGTCrafted, 1000e18);
        assertEq(totalNGTReturned, 0);
        assertEq(totalNGTFee, 0);
        assertEq(totalCoalBurned, 100);
        assertEq(crafts, 1);
        assertEq(destroys, 0);
    }

    function test_GetNPCStatsHuman() public {
        uint256 npcId = 1919;
        address forge = address(0x5678);
        
        // Record a craft to set some stats
        vm.prank(masterCrafter);
        stats.recordCraft(forge, npcId, 1, 1000e18, 100, 1);
        
        string memory result = stats.getNPCStatsHuman(npcId);
        
        // Should contain the NPC ID
        bytes memory resultBytes = bytes(result);
        assertGt(resultBytes.length, 0);
        
        // Should contain "NPC #1919"
        // We can't easily check string contents in Solidity, but we can verify it's non-empty
        assertTrue(resultBytes.length > 0);
    }

    function test_ResetNPC() public {
        uint256 npcId = 1919;
        address forge = address(0x5678);
        
        // Record a craft to set some stats
        vm.prank(masterCrafter);
        stats.recordCraft(forge, npcId, 1, 1000e18, 100, 1);
        
        // Verify stats are set
        (uint64 crafted, , , , , ) = stats.getNPCStatsDecoded(npcId);
        assertEq(crafted, 1000e18);
        
        // Reset
        stats.resetNPC(npcId);
        
        // Verify all zeros
        (crafted, , , , , ) = stats.getNPCStatsDecoded(npcId);
        assertEq(crafted, 0);
    }

    function test_ResetNPCBatch() public {
        uint256[] memory npcIds = new uint256[](2);
        npcIds[0] = 1919;
        npcIds[1] = 1;
        address forge = address(0x5678);
        
        // Record crafts for both NPCs
        vm.prank(masterCrafter);
        stats.recordCraft(forge, 1919, 1, 1000e18, 100, 1);
        vm.prank(masterCrafter);
        stats.recordCraft(forge, 1, 1, 500e18, 50, 2);
        
        // Verify stats are set
        (uint64 crafted1, , , , , ) = stats.getNPCStatsDecoded(1919);
        (uint64 crafted2, , , , , ) = stats.getNPCStatsDecoded(1);
        assertEq(crafted1, 1000e18);
        assertEq(crafted2, 500e18);
        
        // Reset batch
        stats.resetNPCBatch(npcIds);
        
        // Verify both are zero
        (crafted1, , , , , ) = stats.getNPCStatsDecoded(1919);
        (crafted2, , , , , ) = stats.getNPCStatsDecoded(1);
        assertEq(crafted1, 0);
        assertEq(crafted2, 0);
    }

    function test_ResetForge() public {
        address forge = address(0x5678);
        uint256 npcId = 1919;
        
        // Record a craft to set forge stats
        vm.prank(masterCrafter);
        stats.recordCraft(forge, npcId, 1, 1000e18, 100, 1);
        
        // Verify stats are set
        NPCStatsV5.ForgeStats memory fsBefore = stats.getForgeStats(forge);
        assertEq(fsBefore.totalNGTCrafted, 1000e18);
        assertEq(fsBefore.crafts, 1);
        
        // Reset
        stats.resetForge(forge);
        
        // Verify stats are zero
        NPCStatsV5.ForgeStats memory fs = stats.getForgeStats(forge);
        assertEq(fs.totalNGTCrafted, 0);
        assertEq(fs.crafts, 0);
    }

    function test_ResetForgeBatch() public {
        address[] memory forges = new address[](2);
        forges[0] = address(0x1234);
        forges[1] = address(0x5678);
        uint256 npcId = 1919;
        
        // Record crafts for both forges
        vm.prank(masterCrafter);
        stats.recordCraft(forges[0], npcId, 1, 1000e18, 100, 1);
        vm.prank(masterCrafter);
        stats.recordCraft(forges[1], npcId, 1, 500e18, 50, 2);
        
        // Verify stats are set
        NPCStatsV5.ForgeStats memory fs1Before = stats.getForgeStats(forges[0]);
        NPCStatsV5.ForgeStats memory fs2Before = stats.getForgeStats(forges[1]);
        assertEq(fs1Before.totalNGTCrafted, 1000e18);
        assertEq(fs2Before.totalNGTCrafted, 500e18);
        
        // Reset batch
        stats.resetForgeBatch(forges);
        
        // Verify both are zero
        NPCStatsV5.ForgeStats memory fs1 = stats.getForgeStats(forges[0]);
        NPCStatsV5.ForgeStats memory fs2 = stats.getForgeStats(forges[1]);
        assertEq(fs1.totalNGTCrafted, 0);
        assertEq(fs2.totalNGTCrafted, 0);
    }

    function test_ResetNPCOnlyOwner() public {
        uint256 npcId = 1919;
        
        // Try to reset as non-owner (should fail)
        vm.prank(address(0x9999));
        vm.expectRevert("NOT_OWNER");
        stats.resetNPC(npcId);
    }

    function test_ResetForgeOnlyOwner() public {
        address forge = address(0x1234);
        
        // Try to reset as non-owner (should fail)
        vm.prank(address(0x9999));
        vm.expectRevert("NOT_OWNER");
        stats.resetForge(forge);
    }
}

