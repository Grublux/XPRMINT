pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {MasterCrafterV1} from "../../contracts/crafted/MasterCrafterV1.sol";
import {MasterCrafterV1Storage} from "../../contracts/crafted/MasterCrafterV1Storage.sol";
import {CraftedV1Positions} from "../../contracts/crafted/CraftedV1Positions.sol";
import {MockERC20} from "../../contracts/mocks/MockERC20.sol";
import {MockERC721} from "../../contracts/mocks/MockERC721.sol";

contract MasterCrafterV1SmokeTest is Test {
    uint256 constant INPUT_PER_UNIT = 1000 ether;
    uint16 constant DESTROY_FEE_BPS = 1000;
    uint64 constant LOCK_DURATION = 60;

    struct System {
        MasterCrafterV1 crafter;
        CraftedV1Positions positions;
        MockERC20 ngt;
        MockERC721 npc;
        address user;
        address npcOwner2;
    }

    function _deploySystem() internal returns (System memory s) {
        s.user = makeAddr("user");
        s.npcOwner2 = makeAddr("npcOwner2");

        s.ngt = new MockERC20("NGT", "NGT", 18);
        s.npc = new MockERC721("NPC", "NPC");
        s.positions = new CraftedV1Positions();
        s.crafter = new MasterCrafterV1();

        s.crafter.initialize(
            address(s.ngt),
            address(s.ngt),
            address(0xFEE),
            address(s.positions),
            address(s.npc),
            20
        );

        s.positions.setMasterCrafter(address(s.crafter));
    }

    function _createRecipe(System memory s) internal returns (uint256 recipeId) {
        MasterCrafterV1.RecipeConfig memory cfg;
        cfg.itemClass = MasterCrafterV1Storage.ItemClass.COIN;
        cfg.inputToken = address(0); // default to NGT
        cfg.inputPerUnit = INPUT_PER_UNIT;
        cfg.coalToken1155 = address(0);
        cfg.coalTokenId = 0;
        cfg.coalPerUnit = 0;
        cfg.imageData = hex"";
        cfg.lockDuration = uint64(LOCK_DURATION);
        cfg.craftFeeBps = 0;
        cfg.destroyFeeBps = DESTROY_FEE_BPS;
        cfg.feeRecipient = address(0xFEE);
        cfg.uri = "https://www.xprmint.com/coins/coin1a.json";
        recipeId = s.crafter.createRecipe(cfg);
    }

    function test_createRecipe_basicCoin() public {
        System memory s = _deploySystem();
        uint256 recipeId = _createRecipe(s);

        MasterCrafterV1Storage.Recipe memory r = s.crafter.getRecipe(recipeId);
        assertEq(r.inputToken, address(s.ngt));
        assertEq(r.inputPerUnit, INPUT_PER_UNIT);
        assertEq(r.lockDuration, LOCK_DURATION);
        assertEq(r.craftFeeBps, 0);
        assertEq(r.destroyFeeBps, DESTROY_FEE_BPS);
        assertEq(r.uri, "https://www.xprmint.com/coins/coin1a.json");
    }

    function test_craft_requiresNpcOwnership() public {
        System memory s = _deploySystem();
        _createRecipe(s);

        // Mint NPC #1 to user
        s.npc.mint(s.user, 1);
        // Mint NGT to user and approve
        s.ngt.mint(s.user, INPUT_PER_UNIT);
        vm.prank(s.user);
        s.ngt.approve(address(s.crafter), INPUT_PER_UNIT);

        // Wrong seat (not owned) should revert
        vm.prank(s.user);
        vm.expectRevert(); // seat 2 does not exist -> should revert
        s.crafter.craft(1, address(0), 2);

        // Correct seat
        vm.prank(s.user);
        uint256 positionId = s.crafter.craft(1, address(0), 1);

        assertEq(s.positions.ownerOf(positionId), s.user);
        MasterCrafterV1Storage.Position memory p = s.crafter.getPosition(positionId);
        assertEq(p.owner, s.user);

        MasterCrafterV1Storage.NPCForgeStats memory stats = s.crafter.getNPCForgeStats(address(s.npc), 1);
        assertEq(stats.positionsForged, 1);
    }

    function test_destroy_afterLockDuration() public {
        System memory s = _deploySystem();
        _createRecipe(s);
        s.npc.mint(s.user, 1);
        s.ngt.mint(s.user, INPUT_PER_UNIT);
        vm.prank(s.user);
        s.ngt.approve(address(s.crafter), INPUT_PER_UNIT);

        vm.prank(s.user);
        uint256 positionId = s.crafter.craft(1, address(0), 1);

        vm.warp(block.timestamp + LOCK_DURATION);

        uint256 userBefore = s.ngt.balanceOf(s.user);

        vm.prank(s.user);
        s.crafter.destroy(positionId);

        // Token burned
        vm.expectRevert();
        s.positions.ownerOf(positionId);

        uint256 userAfter = s.ngt.balanceOf(s.user);

        uint256 expectedFee = (INPUT_PER_UNIT * DESTROY_FEE_BPS) / 10000; // 10%
        uint256 expectedBearer = INPUT_PER_UNIT - expectedFee;

        // user is both bearer and npc here, so receives both pieces
        assertEq(userAfter - userBefore, expectedBearer + expectedFee);

        MasterCrafterV1Storage.NPCForgeStats memory stats = s.crafter.getNPCForgeStats(address(s.npc), 1);
        assertEq(stats.positionsDestroyed, 1);
        assertEq(stats.totalNGTFeeEarned, uint128(expectedFee));
    }

    function test_royalties_followNpcSeatOwner() public {
        System memory s = _deploySystem();
        _createRecipe(s);
        s.npc.mint(s.user, 1);
        s.ngt.mint(s.user, INPUT_PER_UNIT);
        vm.prank(s.user);
        s.ngt.approve(address(s.crafter), INPUT_PER_UNIT);

        vm.prank(s.user);
        uint256 positionId = s.crafter.craft(1, address(0), 1);

        (address recv1, uint256 amt1) = s.positions.royaltyInfo(positionId, 100 ether);
        assertEq(recv1, s.user);
        assertEq(amt1, (100 ether * 690) / 10_000);

        // Transfer NPC seat to npcOwner2
        vm.prank(s.user);
        s.npc.transferFrom(s.user, s.npcOwner2, 1);

        (address recv2, uint256 amt2) = s.positions.royaltyInfo(positionId, 100 ether);
        assertEq(recv2, s.npcOwner2);
        assertEq(amt2, (100 ether * 690) / 10_000);
    }

    function test_npcXPDerivedFromStats() public {
        System memory s = _deploySystem();
        _createRecipe(s);
        s.npc.mint(s.user, 1);
        s.ngt.mint(s.user, INPUT_PER_UNIT);
        vm.prank(s.user);
        s.ngt.approve(address(s.crafter), INPUT_PER_UNIT);

        vm.prank(s.user);
        uint256 positionId = s.crafter.craft(1, address(0), 1);

        vm.warp(block.timestamp + LOCK_DURATION);
        vm.prank(s.user);
        s.crafter.destroy(positionId);

        // XP formula:
        // totalNGTLocked = 1000 NGT => 1000/100 = 10
        // positionsDestroyed = 1 => 5
        // totalCoalBurned = 0 => 0
        // totalNGTFeeEarned = 100 NGT => 100 * 2 = 200
        uint256 expectedXp = 10 + 5 + 0 + 200;
        uint256 xp = s.crafter.npcXP(address(s.npc), 1);
        assertEq(xp, expectedXp);
    }
}
