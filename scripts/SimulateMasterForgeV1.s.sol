// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {MockERC20} from "../contracts/mocks/MockERC20.sol";
import {MockERC721} from "../contracts/mocks/MockERC721.sol";
import {MockERC1155} from "../contracts/mocks/MockERC1155.sol";
import {MasterForgeV1} from "../contracts/forging/MasterForgeV1.sol";
import {MasterForgeV1Storage} from "../contracts/forging/MasterForgeV1Storage.sol";
import {ForgePosition721} from "../contracts/forging/ForgePosition721.sol";

/**
 * @title SimulateMasterForgeV1
 * @notice Local simulation script for MasterForgeV1 and ForgePosition721
 * @dev Run with: forge script scripts/SimulateMasterForgeV1.s.sol --fork-url http://127.0.0.1:8545 -vvvv
 *      Or:       forge script scripts/SimulateMasterForgeV1.s.sol -vvvv
 */
contract SimulateMasterForgeV1 is Script {
    // Test constants
    uint256 constant INPUT_PER_UNIT = 1000 ether;
    uint64 constant LOCK_DURATION = 7 days;
    uint256 constant NPC_ID = 1;

    function run() external {
        // Get signers
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)); // Default Anvil key
        address deployer = vm.addr(deployerPrivateKey);
        address user = address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8); // Second Anvil account
        address feeReceiver = address(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC); // Third Anvil account

        console.log("==========================================");
        console.log("    MasterForgeV1 Local Simulation");
        console.log("==========================================");
        console.log("Deployer:", deployer);
        console.log("User:", user);
        console.log("Fee Receiver:", feeReceiver);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // ============ Deploy Mock Tokens ============
        console.log("--- Deploying Mock Tokens ---");
        
        MockERC20 ngt = new MockERC20("NGT Token", "NGT", 18);
        console.log("NGT deployed at:", address(ngt));

        MockERC721 npc = new MockERC721("NPCs", "NPC");
        console.log("NPC deployed at:", address(npc));

        MockERC1155 coal = new MockERC1155("https://coal.test/{id}.json");
        console.log("COAL deployed at:", address(coal));
        console.log("");

        // ============ Deploy ForgePosition721 First ============
        console.log("--- Deploying ForgePosition721 ---");
        
        ForgePosition721 forgePositionImpl = new ForgePosition721();
        console.log("ForgePosition721 implementation:", address(forgePositionImpl));

        // Use temporary masterForge address (will update after MasterForge deploy)
        bytes memory forgePositionInitData = abi.encodeWithSelector(
            ForgePosition721.initialize.selector,
            "Forge Positions",
            "FORGE",
            uint96(690), // 6.9% royalty
            address(1)   // Temporary placeholder
        );

        ProxyAdmin positionAdmin = new ProxyAdmin(deployer);
        TransparentUpgradeableProxy forgePositionProxy = new TransparentUpgradeableProxy(
            address(forgePositionImpl),
            address(positionAdmin),
            forgePositionInitData
        );
        ForgePosition721 forgePosition = ForgePosition721(address(forgePositionProxy));
        console.log("ForgePosition721 proxy:", address(forgePosition));
        console.log("");

        // ============ Deploy MasterForgeV1 ============
        console.log("--- Deploying MasterForgeV1 ---");
        
        MasterForgeV1 masterForgeImpl = new MasterForgeV1();
        console.log("MasterForgeV1 implementation:", address(masterForgeImpl));

        bytes memory masterForgeInitData = abi.encodeWithSelector(
            MasterForgeV1.initialize.selector,
            address(ngt),
            address(ngt),
            feeReceiver,
            address(forgePosition), // positionsToken
            20
        );

        ERC1967Proxy masterForgeProxy = new ERC1967Proxy(
            address(masterForgeImpl),
            masterForgeInitData
        );
        MasterForgeV1 masterForge = MasterForgeV1(address(masterForgeProxy));
        console.log("MasterForgeV1 proxy:", address(masterForge));
        console.log("");

        // ============ Wire Up Contracts ============
        console.log("--- Wiring Contracts ---");
        
        forgePosition.setMasterForge(address(masterForge));
        console.log("Set masterForge in ForgePosition721");

        masterForge.setRoyaltyCollection(address(npc), true);
        console.log("Allowed NPC as royalty collection");

        masterForge.setDefaultRoyaltyCollection(address(npc));
        console.log("Set NPC as default royalty collection");
        console.log("");

        // ============ Mint Tokens to User ============
        console.log("--- Minting Tokens to User ---");
        
        npc.mint(user, NPC_ID);
        console.log("Minted NPC #1 to user");

        ngt.mint(user, INPUT_PER_UNIT * 5);
        console.log("Minted 5000 NGT to user");
        
        uint256 userNgtBefore = ngt.balanceOf(user);
        console.log("User NGT balance:", userNgtBefore / 1e18, "NGT");
        console.log("");

        // ============ Create Recipe ============
        console.log("--- Creating Recipe ---");
        
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
            uri: "ipfs://test-coin-uri"
        });

        uint256 recipeId = masterForge.createRecipe(cfg);
        console.log("Created recipe ID:", recipeId);
        
        MasterForgeV1Storage.Recipe memory recipe = masterForge.getRecipe(recipeId);
        console.log("  Input token:", recipe.inputToken);
        console.log("  Input per unit:", recipe.inputPerUnit / 1e18, "NGT");
        console.log("  Lock duration:", recipe.lockDuration / 1 days, "days");
        console.log("");

        vm.stopBroadcast();

        // ============ User Actions (separate broadcast) ============
        uint256 userPrivateKey = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d; // Second Anvil key
        
        vm.startBroadcast(userPrivateKey);

        console.log("--- User Approving NGT ---");
        ngt.approve(address(masterForge), INPUT_PER_UNIT * 5);
        console.log("User approved MasterForge to spend NGT");
        console.log("");

        console.log("--- User Crafting Position ---");
        uint256 positionId = masterForge.craft(recipeId, address(0), NPC_ID);
        console.log("Crafted position ID:", positionId);

        vm.stopBroadcast();

        // ============ Read State ============
        console.log("");
        console.log("--- Final State ---");
        
        uint256 userNgtAfter = ngt.balanceOf(user);
        console.log("User NGT balance after craft:", userNgtAfter / 1e18, "NGT");
        console.log("NGT spent:", (userNgtBefore - userNgtAfter) / 1e18, "NGT");

        console.log("Position owner:", forgePosition.ownerOf(positionId));
        
        MasterForgeV1Storage.Position memory position = masterForge.getPosition(positionId);
        console.log("Position recipeId:", position.recipeId);
        console.log("Position inputAmountLocked:", position.inputAmountLocked / 1e18, "NGT");
        console.log("Position unlockAt:", position.unlockAt);

        (address seatCollection, uint256 seatTokenId) = masterForge.positionRoyaltySeat(positionId);
        console.log("Royalty seat collection:", seatCollection);
        console.log("Royalty seat tokenId:", seatTokenId);

        address royaltyReceiver = masterForge.royaltyReceiverForPosition(positionId);
        console.log("Royalty receiver:", royaltyReceiver);

        (address receiver, uint256 royaltyAmount) = forgePosition.royaltyInfo(positionId, 1 ether);
        console.log("ForgePosition721.royaltyInfo(positionId, 1 ETH):");
        console.log("  Receiver:", receiver);
        console.log("  Amount:", royaltyAmount, "wei (6.9% of 1 ETH)");

        console.log("");
        console.log("==========================================");
        console.log("    Simulation Complete!");
        console.log("==========================================");
    }
}

