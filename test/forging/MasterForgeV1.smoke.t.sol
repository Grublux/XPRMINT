// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {MockERC20} from "../../contracts/mocks/MockERC20.sol";
import {MockERC721} from "../../contracts/mocks/MockERC721.sol";
import {MockERC1155} from "../../contracts/mocks/MockERC1155.sol";
import {MasterForgeV1} from "../../contracts/forging/MasterForgeV1.sol";
import {MasterForgeV1Storage} from "../../contracts/forging/MasterForgeV1Storage.sol";
import {ForgePosition721} from "../../contracts/forging/ForgePosition721.sol";

/**
 * @title MasterForgeV1SmokeTest
 * @notice End-to-end smoke tests for MasterForgeV1 and ForgePosition721
 * @dev Tests NPC gating, forging, royalties, and collection config
 */
contract MasterForgeV1SmokeTest is Test {
    // Contracts
    MockERC20 ngt;
    MockERC721 npc;
    MockERC1155 coal;
    MasterForgeV1 masterForge;
    ForgePosition721 forgePosition;

    // Test addresses
    address deployer = address(this);
    address user = address(0x1234);
    address user2 = address(0x5678);
    address feeReceiver = address(0x9999);

    // Constants
    uint256 constant INPUT_PER_UNIT = 1000 ether; // 1000 NGT
    uint64 constant LOCK_DURATION = 7 days;
    uint256 constant NPC_ID = 1;
    uint256 constant NPC_ID_2 = 2;

    function setUp() public {
        // Deploy mock tokens
        ngt = new MockERC20("NGT Token", "NGT", 18);
        npc = new MockERC721("NPCs", "NPC");
        coal = new MockERC1155("https://coal.test/{id}.json");

        // Deploy ForgePosition721 implementation (we'll set masterForge later)
        ForgePosition721 forgePositionImpl = new ForgePosition721();
        
        // Use a placeholder address for masterForge during ForgePosition721 init
        // We'll use address(1) as temporary and update later
        bytes memory forgePositionInitData = abi.encodeWithSelector(
            ForgePosition721.initialize.selector,
            "Forge Positions",  // name
            "FORGE",            // symbol
            uint96(690),        // royaltyBps (6.9%)
            address(1)          // Temporary masterForge placeholder
        );
        
        ProxyAdmin positionAdmin = new ProxyAdmin(deployer);
        TransparentUpgradeableProxy forgePositionProxy = new TransparentUpgradeableProxy(
            address(forgePositionImpl),
            address(positionAdmin),
            forgePositionInitData
        );
        forgePosition = ForgePosition721(address(forgePositionProxy));

        // Deploy MasterForgeV1 implementation and proxy with correct positionsToken
        MasterForgeV1 masterForgeImpl = new MasterForgeV1();
        bytes memory masterForgeInitData = abi.encodeWithSelector(
            MasterForgeV1.initialize.selector,
            address(ngt),           // defaultInputToken
            address(ngt),           // feeToken
            feeReceiver,            // feeRouter
            address(forgePosition), // positionsToken
            20                      // maxBatchSize
        );
        
        // Use ERC1967Proxy for UUPS
        ERC1967Proxy masterForgeProxy = new ERC1967Proxy(
            address(masterForgeImpl),
            masterForgeInitData
        );
        masterForge = MasterForgeV1(address(masterForgeProxy));

        // Update ForgePosition721 to point to the real MasterForge
        forgePosition.setMasterForge(address(masterForge));

        // Configure royalty collections
        masterForge.setRoyaltyCollection(address(npc), true);
        masterForge.setDefaultRoyaltyCollection(address(npc));
    }

    // ============ Recipe Creation Tests ============

    function test_createRecipe_basicCoin() public {
        MasterForgeV1.RecipeConfig memory cfg = MasterForgeV1.RecipeConfig({
            itemClass: MasterForgeV1Storage.ItemClass.COIN,
            inputToken: address(0), // Uses defaultInputToken (NGT)
            inputPerUnit: INPUT_PER_UNIT,
            coalToken1155: address(0),
            coalTokenId: 0,
            coalPerUnit: 0,
            imageData: bytes(""),
            lockDuration: LOCK_DURATION,
            craftFeeBps: 0,
            destroyFeeBps: 0,
            feeRecipient: feeReceiver,
            uri: "ipfs://fake-uri"
        });

        uint256 recipeId = masterForge.createRecipe(cfg);

        assertEq(recipeId, 1, "First recipe should have ID 1");

        MasterForgeV1Storage.Recipe memory recipe = masterForge.getRecipe(recipeId);
        assertEq(recipe.inputToken, address(ngt), "Input token should be NGT");
        assertEq(recipe.inputPerUnit, INPUT_PER_UNIT, "Input per unit should match");
        assertTrue(recipe.active, "Recipe should be active");
        assertEq(recipe.imagePointer, address(0), "Image pointer should be zero");
    }

    // ============ NPC Ownership Tests ============

    function test_craft_requiresNpcOwnership() public {
        // Create recipe first
        _createBasicRecipe();

        // Mint NPC to user
        npc.mint(user, NPC_ID);

        // Mint NGT to user and approve
        ngt.mint(user, INPUT_PER_UNIT);
        vm.prank(user);
        ngt.approve(address(masterForge), INPUT_PER_UNIT);

        // Craft from user
        vm.prank(user);
        uint256 positionId = masterForge.craft(1, address(npc), NPC_ID);

        // Verify position
        assertEq(forgePosition.ownerOf(positionId), user, "User should own position");
        
        MasterForgeV1Storage.Position memory position = masterForge.getPosition(positionId);
        assertEq(position.owner, user, "Position owner should be user");
        
        (address collection, uint256 tokenId) = masterForge.positionRoyaltySeat(positionId);
        assertEq(collection, address(npc), "Seat collection should be NPC");
        assertEq(tokenId, NPC_ID, "Seat tokenId should match");
        
        assertEq(masterForge.totalInputLocked(), INPUT_PER_UNIT, "Total input locked should match");
        assertEq(masterForge.userActivePositions(user), 1, "User should have 1 active position");
    }

    function test_craft_revertsIfNotNpcOwner() public {
        _createBasicRecipe();

        // Mint NPC to deployer, NOT to user
        npc.mint(deployer, NPC_ID);

        // Mint NGT to user and approve
        ngt.mint(user, INPUT_PER_UNIT);
        vm.prank(user);
        ngt.approve(address(masterForge), INPUT_PER_UNIT);

        // Attempt craft from user with NPC they don't own
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSignature("NotRoyaltySeatOwner()"));
        masterForge.craft(1, address(npc), NPC_ID);
    }

    // ============ Default Royalty Collection Tests ============

    function test_craft_usesDefaultRoyaltyCollection() public {
        _createBasicRecipe();

        // Mint NPC to user
        npc.mint(user, NPC_ID);

        // Mint NGT to user and approve
        ngt.mint(user, INPUT_PER_UNIT);
        vm.prank(user);
        ngt.approve(address(masterForge), INPUT_PER_UNIT);

        // Craft with seatCollection = address(0), should use defaultRoyaltyCollection
        vm.prank(user);
        uint256 positionId = masterForge.craft(1, address(0), NPC_ID);

        // Verify royalty seat was set using default collection
        (address collection, uint256 tokenId) = masterForge.positionRoyaltySeat(positionId);
        assertEq(collection, address(npc), "Should use default royalty collection (NPC)");
        assertEq(tokenId, NPC_ID, "Seat tokenId should match");
    }

    // ============ Batch Crafting Tests ============

    function test_craftBatch_mintsMultiplePositions() public {
        _createBasicRecipe();

        // Mint NPC to user
        npc.mint(user, NPC_ID);

        // Mint enough NGT for 3 positions
        uint256 totalRequired = INPUT_PER_UNIT * 3;
        ngt.mint(user, totalRequired);
        vm.prank(user);
        ngt.approve(address(masterForge), totalRequired);

        // Batch craft 3 positions
        vm.prank(user);
        uint256[] memory positionIds = masterForge.craftBatch(1, 3, address(0), NPC_ID);

        assertEq(positionIds.length, 3, "Should mint 3 positions");

        for (uint256 i = 0; i < 3; i++) {
            assertEq(forgePosition.ownerOf(positionIds[i]), user, "User should own each position");
            
            (address collection, uint256 tokenId) = masterForge.positionRoyaltySeat(positionIds[i]);
            assertEq(collection, address(npc), "Each position should have NPC seat");
            assertEq(tokenId, NPC_ID, "Each position should reference same NPC");
        }

        (uint256 totalInput, uint256 totalPositions) = masterForge.getRecipeStats(1);
        assertEq(totalPositions, 3, "Recipe should have 3 positions");
        assertEq(totalInput, totalRequired, "Total input should match");
        assertEq(masterForge.totalInputLocked(), totalRequired, "Global total should match");
    }

    // ============ Destroy Tests ============

    function test_destroy_afterLockDuration() public {
        _createBasicRecipe();

        // Setup: mint NPC and NGT, craft position
        npc.mint(user, NPC_ID);
        ngt.mint(user, INPUT_PER_UNIT);
        vm.prank(user);
        ngt.approve(address(masterForge), INPUT_PER_UNIT);
        
        vm.prank(user);
        uint256 positionId = masterForge.craft(1, address(0), NPC_ID);

        // Verify initial state
        assertEq(ngt.balanceOf(user), 0, "User should have 0 NGT after craft");
        assertEq(masterForge.userActivePositions(user), 1, "User should have 1 position");

        // Fast forward past lock duration
        vm.warp(block.timestamp + LOCK_DURATION + 1);

        // Destroy position
        vm.prank(user);
        masterForge.destroy(positionId);

        // Verify position destroyed
        MasterForgeV1Storage.Position memory position = masterForge.getPosition(positionId);
        assertEq(position.owner, address(0), "Position should be deleted");
        
        vm.expectRevert(); // ownerOf should revert for burned token
        forgePosition.ownerOf(positionId);

        // User should get NGT back
        assertEq(ngt.balanceOf(user), INPUT_PER_UNIT, "User should have NGT back");
        assertEq(masterForge.totalInputLocked(), 0, "Total input locked should be 0");
        assertEq(masterForge.userActivePositions(user), 0, "User should have 0 positions");
    }

    function test_destroy_revertsBeforeLockExpiry() public {
        _createBasicRecipe();

        npc.mint(user, NPC_ID);
        ngt.mint(user, INPUT_PER_UNIT);
        vm.prank(user);
        ngt.approve(address(masterForge), INPUT_PER_UNIT);
        
        vm.prank(user);
        uint256 positionId = masterForge.craft(1, address(0), NPC_ID);

        // Try to destroy before lock expires
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSignature("LockNotExpired()"));
        masterForge.destroy(positionId);
    }

    // ============ Royalty Tests ============

    function test_royalties_followSeatNftOwner() public {
        _createBasicRecipe();

        // User owns NPC and crafts position
        npc.mint(user, NPC_ID);
        ngt.mint(user, INPUT_PER_UNIT);
        vm.prank(user);
        ngt.approve(address(masterForge), INPUT_PER_UNIT);
        
        vm.prank(user);
        uint256 positionId = masterForge.craft(1, address(0), NPC_ID);

        // Initially, royalty receiver should be user (NPC owner)
        address receiver = masterForge.royaltyReceiverForPosition(positionId);
        assertEq(receiver, user, "Royalty receiver should be NPC owner (user)");

        // Transfer NPC to user2
        vm.prank(user);
        npc.transferFrom(user, user2, NPC_ID);

        // Now royalty receiver should be user2
        receiver = masterForge.royaltyReceiverForPosition(positionId);
        assertEq(receiver, user2, "Royalty receiver should follow NPC to user2");

        // Verify ForgePosition721.royaltyInfo
        uint256 salePrice = 1 ether;
        (address royaltyReceiver, uint256 royaltyAmount) = forgePosition.royaltyInfo(positionId, salePrice);
        
        assertEq(royaltyReceiver, user2, "ForgePosition721 royalty receiver should be user2");
        // 6.9% = 690 bps = salePrice * 690 / 10000
        uint256 expectedRoyalty = (salePrice * 690) / 10000;
        assertEq(royaltyAmount, expectedRoyalty, "Royalty amount should be 6.9%");
    }

    // ============ Collection Config Tests ============

    function test_collectionConfig_and_defaultSwitching() public {
        // setRoyaltyCollection should be idempotent
        masterForge.setRoyaltyCollection(address(npc), true);
        masterForge.setRoyaltyCollection(address(npc), true);
        assertTrue(masterForge.allowedRoyaltyCollections(address(npc)), "NPC should be allowed");

        // Deploy a second mock ERC721 as ForgeNFT
        MockERC721 forgeNFT = new MockERC721("Forge NFTs", "FORGENFT");

        // Allow ForgeNFT collection
        masterForge.setRoyaltyCollection(address(forgeNFT), true);
        assertTrue(masterForge.allowedRoyaltyCollections(address(forgeNFT)), "ForgeNFT should be allowed");

        // Switch default to ForgeNFT
        masterForge.setDefaultRoyaltyCollection(address(forgeNFT));
        assertEq(masterForge.defaultRoyaltyCollection(), address(forgeNFT), "Default should be ForgeNFT");

        // Try to set default to a non-allowed collection
        MockERC721 randomNFT = new MockERC721("Random", "RND");
        vm.expectRevert(abi.encodeWithSignature("UnsupportedRoyaltyCollection()"));
        masterForge.setDefaultRoyaltyCollection(address(randomNFT));
    }

    function test_craft_revertsWithUnsupportedCollection() public {
        _createBasicRecipe();

        // Deploy an unsupported collection
        MockERC721 unsupportedNFT = new MockERC721("Unsupported", "UNS");
        unsupportedNFT.mint(user, 1);

        // Mint NGT
        ngt.mint(user, INPUT_PER_UNIT);
        vm.prank(user);
        ngt.approve(address(masterForge), INPUT_PER_UNIT);

        // Try to craft with unsupported collection
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSignature("UnsupportedRoyaltyCollection()"));
        masterForge.craft(1, address(unsupportedNFT), 1);
    }

    // ============ Helper Functions ============

    function _createBasicRecipe() internal returns (uint256) {
        MasterForgeV1.RecipeConfig memory cfg = MasterForgeV1.RecipeConfig({
            itemClass: MasterForgeV1Storage.ItemClass.COIN,
            inputToken: address(0),
            inputPerUnit: INPUT_PER_UNIT,
            coalToken1155: address(0),
            coalTokenId: 0,
            coalPerUnit: 0,
            imageData: bytes(""),
            lockDuration: LOCK_DURATION,
            craftFeeBps: 0,
            destroyFeeBps: 0,
            feeRecipient: feeReceiver,
            uri: "ipfs://fake-uri"
        });
        return masterForge.createRecipe(cfg);
    }
}

