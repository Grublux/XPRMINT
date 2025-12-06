// SPDX-License-Identifier: MIT
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
        s.user = vm.addr(1);
        s.npcOwner2 = vm.addr(2);
        vm.label(s.user, "user");
        vm.label(s.npcOwner2, "npcOwner2");

        s.ngt = new MockERC20("NGT", "NGT", 18);
        s.npc = new MockERC721("NPC", "NPC");

        CraftedV1Positions positionsImpl = new CraftedV1Positions();
        ProxyAdmin proxyAdmin = new ProxyAdmin(address(this));
        TransparentUpgradeableProxy proxyPos = new TransparentUpgradeableProxy(
            address(positionsImpl),
            address(proxyAdmin),
            ""
        );
        s.positions = CraftedV1Positions(address(proxyPos));
        s.positions.initialize(address(this));

        MasterCrafterV1 impl = new MasterCrafterV1();
        bytes memory initData = abi.encodeWithSelector(
            MasterCrafterV1.initialize.selector,
            address(s.ngt),
            address(s.ngt),
            address(0xfee),
            address(s.positions),
            address(s.npc),
            20
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        s.crafter = MasterCrafterV1(address(proxy));

        s.positions.setMasterCrafter(address(s.crafter));
        return s;
    }

    function _createRecipe(System memory s) internal returns (uint256 recipeId) {
        MasterCrafterV1.RecipeConfig memory cfg;
        cfg.itemClass = MasterCrafterV1Storage.ItemClass.COIN;
        cfg.inputToken = address(s.ngt);
        cfg.inputPerUnit = INPUT_PER_UNIT;
        cfg.coalToken1155 = address(0);
        cfg.coalTokenId = 0;
        cfg.coalPerUnit = 0;
        cfg.imageData = hex"";
        cfg.lockDuration = uint64(LOCK_DURATION);
        cfg.craftFeeBps = 0;
        cfg.destroyFeeBps = DESTROY_FEE_BPS;
        cfg.feeRecipient = address(0xfee);
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

        s.npc.mint(s.user, 1);
        s.ngt.mint(s.user, INPUT_PER_UNIT);
        vm.prank(s.user);
        s.ngt.approve(address(s.crafter), INPUT_PER_UNIT);

        vm.prank(s.user);
        vm.expectRevert();
        s.crafter.craft(1, address(0), 2);

        vm.prank(s.user);
        uint256 posId = s.crafter.craft(1, address(0), 1);
        assertEq(s.positions.ownerOf(posId), s.user);

        MasterCrafterV1Storage.Position memory p = s.crafter.getPosition(posId);
        assertEq(p.recipeId, 1);

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
        uint256 posId = s.crafter.craft(1, address(0), 1);

        vm.warp(block.timestamp + LOCK_DURATION);

        uint256 balUserBefore = s.ngt.balanceOf(s.user);
        uint256 balNpcBefore = s.ngt.balanceOf(s.user);

        vm.prank(s.user);
        s.crafter.destroy(posId);

        assertEq(s.positions.balanceOf(s.user), 0);
        uint256 fee = (INPUT_PER_UNIT * DESTROY_FEE_BPS) / 10_000;
        assertEq(s.ngt.balanceOf(s.user), balUserBefore + INPUT_PER_UNIT);
        assertEq(s.ngt.balanceOf(s.user), balNpcBefore + INPUT_PER_UNIT);

        MasterCrafterV1Storage.NPCForgeStats memory stats = s.crafter.getNPCForgeStats(address(s.npc), 1);
        assertEq(stats.positionsDestroyed, 1);
        assertEq(stats.totalNGTFeeEarned, uint128(fee));
    }

    function test_royalties_followNpcSeatOwner() public {
        System memory s = _deploySystem();
        _createRecipe(s);
        s.npc.mint(s.user, 1);
        s.ngt.mint(s.user, INPUT_PER_UNIT);
        vm.startPrank(s.user);
        s.ngt.approve(address(s.crafter), INPUT_PER_UNIT);
        uint256 posId = s.crafter.craft(1, address(0), 1);
        vm.stopPrank();

        (address recv1, uint256 amt1) = s.positions.royaltyInfo(posId, 100 ether);
        assertEq(recv1, s.user);
        assertEq(amt1, (100 ether * 690) / 10_000);

        vm.prank(s.user);
        s.npc.transferFrom(s.user, s.npcOwner2, 1);
        (address recv2, ) = s.positions.royaltyInfo(posId, 100 ether);
        assertEq(recv2, s.npcOwner2);
    }

    function test_npcXPDerivedFromStats() public {
        System memory s = _deploySystem();
        _createRecipe(s);
        s.npc.mint(s.user, 1);
        s.ngt.mint(s.user, INPUT_PER_UNIT * 2);
        vm.startPrank(s.user);
        s.ngt.approve(address(s.crafter), INPUT_PER_UNIT * 2);
        uint256 posId = s.crafter.craft(1, address(0), 1);
        vm.stopPrank();

        vm.warp(block.timestamp + LOCK_DURATION);
        vm.prank(s.user);
        s.crafter.destroy(posId);

        uint256 expectedXP = (INPUT_PER_UNIT / (100 ether))
            + 5
            + 0
            + ((INPUT_PER_UNIT * DESTROY_FEE_BPS / 10_000) / 1 ether) * 2;

        assertEq(s.crafter.npcXP(address(s.npc), 1), expectedXP);
    }

    function test_tokenURI_usesBaseMetadataUrl() public {
        System memory s = _deploySystem();
        _createRecipe(s);
        s.npc.mint(s.user, 1);
        s.ngt.mint(s.user, INPUT_PER_UNIT);
        vm.prank(s.user);
        s.ngt.approve(address(s.crafter), INPUT_PER_UNIT);

        vm.prank(s.user);
        uint256 posId = s.crafter.craft(1, address(0), 1);

        string memory expected = string.concat("https://www.xprmint.com/crafted/metadata/", vm.toString(posId));
        assertEq(s.crafter.positionTokenURI(posId), expected, "master tokenURI mismatch");
        assertEq(s.positions.tokenURI(posId), expected, "positions tokenURI mismatch");
    }
}

