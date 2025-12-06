// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {SSTORE2} from "solmate/utils/SSTORE2.sol";

import {MasterCrafterV1Storage} from "./MasterCrafterV1Storage.sol";
import {MasterCrafterV1Events} from "./MasterCrafterV1Events.sol";

interface ICraftedV1Positions {
    function mintPosition(address to) external returns (uint256 tokenId);
    function burnPosition(uint256 tokenId) external;
}

contract MasterCrafterV1 is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuard,
    MasterCrafterV1Storage,
    MasterCrafterV1Events
{
    IERC20 public defaultInputErc20;

    modifier onlyAdmin() {
        require(_admins[msg.sender] || msg.sender == owner(), "!admin");
        _;
    }

    function initialize(
        address defaultInputToken_,
        address feeToken_,
        address feeRouter_,
        address positionsToken_,
        address npcCollection_,
        uint256 maxBatchSize_
    ) external initializer {
        __Ownable_init(msg.sender);

        defaultInputToken = defaultInputToken_;
        defaultInputErc20 = IERC20(defaultInputToken_);
        feeToken = feeToken_;
        feeRouter = feeRouter_;
        positionsToken = positionsToken_;
        defaultRoyaltyCollection = npcCollection_;
        allowedRoyaltyCollections[npcCollection_] = true;
        maxBatchSize = maxBatchSize_;
        _upgrader = msg.sender;
        _admins[msg.sender] = true;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============ Admin Setters ============
    function setAdmin(address a, bool e) external onlyOwner { _admins[a] = e; }
    function setUpgrader(address u) external onlyOwner { _upgrader = u; }
    function setDefaultInputToken(address t) external onlyOwner { defaultInputToken = t; defaultInputErc20 = IERC20(t); }
    function setFeeToken(address t) external onlyOwner { feeToken = t; }
    function setFeeRouter(address r) external onlyOwner { feeRouter = r; }
    function setPositionsToken(address t) external onlyOwner { positionsToken = t; }
    function setMaxBatchSize(uint256 m) external onlyOwner { maxBatchSize = m; }
    function setRoyaltyCollection(address c, bool a) external onlyOwner { allowedRoyaltyCollections[c] = a; }
    function setDefaultRoyaltyCollection(address c) external onlyOwner { defaultRoyaltyCollection = c; }
    function setCraftName(string calldata n) external { craftName[msg.sender] = n; emit CraftNameUpdated(msg.sender, n); }
    function setBaseImageURI(string calldata uri) external onlyOwner { baseImageURI = uri; }
    function setDefaultForgeName(string calldata name_) external onlyOwner { defaultForgeName = name_; }
    function setDefaultItemClass(string calldata itemClass_) external onlyOwner { defaultItemClass = itemClass_; }
    function setDefaultCrafterPrefix(string calldata prefix) external onlyOwner { defaultCrafterPrefix = prefix; }

    // ============ Recipe Config Struct ============
    struct RecipeConfig {
        ItemClass itemClass;
        address inputToken;
        uint256 inputPerUnit;
        address coalToken1155;
        uint256 coalTokenId;
        uint256 coalPerUnit;
        bytes imageData;
        uint64 lockDuration;
        uint16 craftFeeBps;
        uint16 destroyFeeBps;
        address feeRecipient;
        string uri;
    }

    // ============ Recipe: Create ============
    function createRecipe(RecipeConfig calldata cfg) external onlyAdmin returns (uint256 recipeId) {
        require(cfg.inputPerUnit > 0, "!input");
        recipeId = ++nextRecipeId;
        _populateRecipe(recipeId, cfg);
        _writeArt(recipeId, cfg.imageData);
        emit RecipeCreated(recipeId, msg.sender, uint8(cfg.itemClass));
    }

    function _populateRecipe(uint256 id, RecipeConfig calldata cfg) internal {
        address inputToken_ = cfg.inputToken == address(0) ? defaultInputToken : cfg.inputToken;
        Recipe storage r = recipes[id];
        r.active = true;
        r.itemClass = cfg.itemClass;
        r.inputToken = inputToken_;
        r.inputPerUnit = cfg.inputPerUnit;
        r.coalToken1155 = cfg.coalToken1155;
        r.coalTokenId = cfg.coalTokenId;
        r.coalPerUnit = cfg.coalPerUnit;
        r.lockDuration = cfg.lockDuration;
        r.craftFeeBps = cfg.craftFeeBps;
        r.destroyFeeBps = cfg.destroyFeeBps;
        r.feeRecipient = cfg.feeRecipient;
        r.forgeCreator = msg.sender;
        r.uri = cfg.uri;
    }

    function _writeArt(uint256 recipeId, bytes calldata imageData) internal {
        if (imageData.length == 0) return;
        address ptr = SSTORE2.write(imageData);
        recipes[recipeId].imagePointer = ptr;
        recipes[recipeId].imageHash = keccak256(imageData);
    }

    // ============ Recipe: Update ============
    function updateRecipe(uint256 recipeId, RecipeConfig calldata cfg) external onlyAdmin {
        Recipe storage r = recipes[recipeId];
        require(r.active, "!active");
        r.lockDuration = cfg.lockDuration;
        r.craftFeeBps = cfg.craftFeeBps;
        r.destroyFeeBps = cfg.destroyFeeBps;
        r.feeRecipient = cfg.feeRecipient;
        r.uri = cfg.uri;
        _updateArt(recipeId, cfg.imageData);
        emit RecipeUpdated(recipeId);
    }

    function _updateArt(uint256 recipeId, bytes calldata imageData) internal {
        if (imageData.length == 0) return;
        Recipe storage r = recipes[recipeId];
        if (r.imagePointer == address(0)) {
            address ptr = SSTORE2.write(imageData);
            r.imagePointer = ptr;
            r.imageHash = keccak256(imageData);
        } else {
            require(keccak256(imageData) == r.imageHash, "art immutable");
        }
    }

    // ============ Craft: Single ============
    function craft(
        uint256 recipeId,
        address seatCollection,
        uint256 seatTokenId
    ) external nonReentrant returns (uint256 positionId) {
        address coll = _validateSeat(seatCollection, seatTokenId);
        positionId = _executeCraft(recipeId, coll, seatTokenId);
    }

    function _validateSeat(address seatColl, uint256 seatId) internal view returns (address coll) {
        coll = seatColl == address(0) ? defaultRoyaltyCollection : seatColl;
        if (coll != address(0)) {
            require(allowedRoyaltyCollections[coll], "!coll");
            require(IERC721(coll).ownerOf(seatId) == msg.sender, "!seat");
        }
    }

    function _executeCraft(uint256 recipeId, address coll, uint256 seatId) internal returns (uint256 posId) {
        Recipe storage r = recipes[recipeId];
        require(r.active, "!active");

        uint256 locked = _pullAndFee(r);
        _burnCoal(r);
        posId = _mintPos(recipeId, locked, r.lockDuration, coll, seatId);
        _addStats(recipeId, locked, 1);

        _updateNPCStatsOnCraft(coll, seatId, 1, r.inputPerUnit, r.coalPerUnit);

        emit Crafted(msg.sender, posId, recipeId, locked, positions[posId].unlockAt);
    }

    function _pullAndFee(Recipe storage r) internal returns (uint256 locked) {
        address token = r.inputToken;
        uint256 amt = r.inputPerUnit;
        IERC20(token).transferFrom(msg.sender, address(this), amt);

        locked = amt;
        if (r.craftFeeBps > 0) {
            uint256 fee = (amt * r.craftFeeBps) / 10_000;
            locked = amt - fee;
            _sendCraftFee(token, fee, r.feeRecipient);
        }
    }

    function _sendCraftFee(address token, uint256 fee, address recipient) internal {
        address dest = feeRouter != address(0) ? feeRouter : recipient;
        if (dest != address(0) && fee > 0) {
            IERC20(token).transfer(dest, fee);
        }
    }

    function _burnCoal(Recipe storage r) internal {
        if (r.coalPerUnit > 0 && r.coalToken1155 != address(0)) {
            IERC1155(r.coalToken1155).safeTransferFrom(
                msg.sender,
                address(0xdead),
                r.coalTokenId,
                r.coalPerUnit,
                ""
            );
        }
    }

    function _mintPos(uint256 recipeId, uint256 locked, uint64 lockDur, address coll, uint256 seatId) internal returns (uint256 posId) {
        posId = ICraftedV1Positions(positionsToken).mintPosition(msg.sender);
        Position storage pos = positions[posId];
        pos.recipeId = recipeId;
        pos.createdAt = uint64(block.timestamp);
        pos.unlockAt = pos.createdAt + lockDur;
        pos.inputAmountLocked = locked;
        pos.owner = msg.sender;
        if (coll != address(0)) {
            positionRoyaltySeat[posId] = RoyaltySeat(coll, seatId);
        }
    }

    function _addStats(uint256 recipeId, uint256 locked, uint256 count) internal {
        totalInputLocked += locked;
        totalInputByRecipe[recipeId] += locked;
        totalPositionsByRecipe[recipeId] += count;
        userActivePositions[msg.sender] += count;
    }

    // ============ Craft: Batch ============
    function craftBatch(
        uint256 recipeId,
        uint256 count,
        address seatCollection,
        uint256 seatTokenId
    ) external nonReentrant returns (uint256[] memory positionIds) {
        require(count > 0 && count <= maxBatchSize, "!count");
        address coll = _validateSeat(seatCollection, seatTokenId);
        positionIds = _executeBatch(recipeId, count, coll, seatTokenId);
    }

    function _executeBatch(uint256 recipeId, uint256 count, address coll, uint256 seatId) internal returns (uint256[] memory ids) {
        Recipe storage r = recipes[recipeId];
        require(r.active, "!active");

        uint256 locked = _pullAndFeeBatch(r, count);
        _burnCoalBatch(r, count);
        ids = _mintBatch(recipeId, count, locked, r.lockDuration, coll, seatId);
        _addStats(recipeId, locked, count);

        _updateNPCStatsOnCraft(coll, seatId, count, r.inputPerUnit * count, r.coalPerUnit * count);

        emit CraftedBatch(msg.sender, recipeId, ids, locked, uint64(block.timestamp) + r.lockDuration);
    }

    function _pullAndFeeBatch(Recipe storage r, uint256 count) internal returns (uint256 locked) {
        address token = r.inputToken;
        uint256 total = r.inputPerUnit * count;
        IERC20(token).transferFrom(msg.sender, address(this), total);

        locked = total;
        if (r.craftFeeBps > 0) {
            uint256 fee = (total * r.craftFeeBps) / 10_000;
            locked = total - fee;
            _sendCraftFee(token, fee, r.feeRecipient);
        }
    }

    function _burnCoalBatch(Recipe storage r, uint256 count) internal {
        if (r.coalPerUnit > 0 && r.coalToken1155 != address(0)) {
            IERC1155(r.coalToken1155).safeTransferFrom(
                msg.sender,
                address(0xdead),
                r.coalTokenId,
                r.coalPerUnit * count,
                ""
            );
        }
    }

    function _mintBatch(uint256 recipeId, uint256 count, uint256 totalLocked, uint64 lockDur, address coll, uint256 seatId) internal returns (uint256[] memory ids) {
        uint256 perPos = totalLocked / count;
        ids = new uint256[](count);
        for (uint256 i = 0; i < count; ++i) {
            ids[i] = _mintPos(recipeId, perPos, lockDur, coll, seatId);
        }
    }

    // ============ Destroy ============
    function destroy(uint256 positionId) external nonReentrant {
        Position storage p = positions[positionId];
        require(p.owner != address(0), "!pos");
        require(block.timestamp >= p.unlockAt, "locked");

        address nftOwner = IERC721(positionsToken).ownerOf(positionId);
        require(nftOwner == msg.sender, "!owner");

        _executeDestroy(positionId, p);
    }

    function _executeDestroy(uint256 posId, Position storage p) internal {
        uint256 gross = p.inputAmountLocked;
        uint256 recId = p.recipeId;
        Recipe storage r = recipes[recId];
        address originalForger = p.owner;
        address bearer = msg.sender;

        address npcReceiver = _getRoyaltyReceiver(posId, r.forgeCreator);

        uint256 fee = r.destroyFeeBps > 0 ? (gross * r.destroyFeeBps) / 10_000 : 0;

        _updateNPCStatsOnDestroy(posId, fee);

        ICraftedV1Positions(positionsToken).burnPosition(posId);

        delete positionRoyaltySeat[posId];
        delete positions[posId];

        userActivePositions[originalForger] -= 1;
        totalInputLocked -= gross;
        totalInputByRecipe[recId] -= gross;

        _distributeDestroy(r, gross, fee, bearer, npcReceiver);
    }

    function _distributeDestroy(Recipe storage r, uint256 gross, uint256 fee, address bearer, address npcReceiver) internal {
        uint256 toBearer = gross - fee;

        if (fee > 0) {
            IERC20(r.inputToken).transfer(npcReceiver, fee);
        }

        IERC20(r.inputToken).transfer(bearer, toBearer);

        emit Destroyed(bearer, 0, r.inputPerUnit, toBearer, fee);
    }

    function _getRoyaltyReceiver(uint256 posId, address fallback_) internal view returns (address) {
        RoyaltySeat storage seat = positionRoyaltySeat[posId];
        if (seat.collection != address(0)) {
            return IERC721(seat.collection).ownerOf(seat.tokenId);
        }
        return fallback_;
    }

    // ============ NPC Stats Helpers ============
    function _updateNPCStatsOnCraft(
        address seatCollection,
        uint256 seatTokenId,
        uint256 units,
        uint256 totalInputAmount,
        uint256 totalCoalUsed
    ) internal {
        if (seatCollection == address(0)) {
            return;
        }

        NPCForgeStats storage stats = npcForgeStats[seatCollection][seatTokenId];
        stats.positionsForged += uint64(units);
        stats.totalNGTLocked += uint128(totalInputAmount);
        stats.totalCoalBurned += uint128(totalCoalUsed);
        stats.lastForgeAt = uint64(block.timestamp);
    }

    function _updateNPCStatsOnDestroy(uint256 positionId, uint256 feeAmount) internal {
        RoyaltySeat memory seat = positionRoyaltySeat[positionId];
        if (seat.collection == address(0)) {
            return;
        }

        NPCForgeStats storage stats = npcForgeStats[seat.collection][seat.tokenId];
        stats.positionsDestroyed += 1;
        if (feeAmount > 0) {
            stats.totalNGTFeeEarned += uint128(feeAmount);
        }
    }

    // ============ Views ============
    function getRecipe(uint256 id) external view returns (Recipe memory) { return recipes[id]; }
    function getPosition(uint256 id) external view returns (Position memory) { return positions[id]; }
    function getGlobalStats() external view returns (uint256, uint256) { return (totalInputLocked, nextRecipeId); }
    function getRecipeStats(uint256 id) external view returns (uint256, uint256) { return (totalInputByRecipe[id], totalPositionsByRecipe[id]); }

    function royaltyReceiverForPosition(uint256 posId) external view returns (address) {
        Position storage p = positions[posId];
        require(p.owner != address(0), "!pos");
        return _getRoyaltyReceiver(posId, recipes[p.recipeId].forgeCreator);
    }

    /**
     * @notice UI-friendly enriched position view with formatted strings
     */
    struct PositionView {
        uint256 positionId;
        uint256 recipeId;
        uint256 seatTokenId;
        address bearer;
        uint256 ngtLocked;
        uint64 createdAt;
        uint64 unlockAt;
        string forgeName;
        string crafterName;
        string itemClass;
        string imageURI;
    }

    /**
     * @notice Metadata context for building JSON (memory-only, not stored)
     */
    struct MetadataCtx {
        string name;
        string description;
        string imageURI;
        string externalURL;
        string forgeName;
        string crafterName;
        string itemClass;
        string ngtLockedStr;
        string unlockAtStr;
    }

    function getPositionView(uint256 positionId)
        public
        view
        returns (PositionView memory)
    {
        Position storage p = positions[positionId];
        require(p.recipeId != 0, "InvalidPosition");
        
        uint256 seatTokenId = positionRoyaltySeat[positionId].collection != address(0)
            ? positionRoyaltySeat[positionId].tokenId
            : 0;
        
        return PositionView({
            positionId: positionId,
            recipeId: p.recipeId,
            seatTokenId: seatTokenId,
            bearer: IERC721(positionsToken).ownerOf(positionId),
            ngtLocked: p.inputAmountLocked,
            createdAt: p.createdAt,
            unlockAt: p.unlockAt,
            forgeName: bytes(defaultForgeName).length > 0 ? defaultForgeName : "Crafted Forge",
            crafterName: string.concat(
                bytes(defaultCrafterPrefix).length > 0 ? defaultCrafterPrefix : "Crafter #",
                Strings.toString(seatTokenId)
            ),
            itemClass: bytes(defaultItemClass).length > 0 ? defaultItemClass : "Coin",
            imageURI: baseImageURI
        });
    }

    function positionTokenURI(uint256 /*positionId*/) external view returns (string memory) {
        // Phase 1: Return static JSON URL for testing
        // TODO Phase 2: Return dynamic on-chain JSON with per-token metadata
        return "https://www.xprmint.com/coins/coin1a.json";
    }

    function _buildMetadataJSON(MetadataCtx memory m) internal pure returns (string memory) {
        bytes memory part1 = abi.encodePacked(
            "data:application/json,{",
            "\"name\":\"", m.name, "\",",
            "\"description\":\"", m.description, "\",",
            "\"image\":\"", m.imageURI, "\",",
            "\"external_url\":\"", m.externalURL, "\",",
            "\"attributes\":["
        );
        bytes memory part2 = abi.encodePacked(
            "{\"trait_type\":\"Forge\",\"value\":\"", m.forgeName, "\"},",
            "{\"trait_type\":\"Crafter\",\"value\":\"", m.crafterName, "\"},",
            "{\"trait_type\":\"Item Class\",\"value\":\"", m.itemClass, "\"},",
            "{\"display_type\":\"number\",\"trait_type\":\"NGT Locked\",\"value\":", m.ngtLockedStr, "},",
            "{\"display_type\":\"date\",\"trait_type\":\"Unlock At\",\"value\":", m.unlockAtStr, "}]}"
        );
        return string(abi.encodePacked(part1, part2));
    }

    // ============ Reader Methods for Frontend ============
    
    /**
     * @notice Core position data without string formatting
     * @param positionId The position token ID
     * @return recipeId The recipe ID used to craft this position
     * @return seatTokenId The NPC token ID used as the royalty seat
     * @return bearer The current owner of the position NFT
     * @return ngtLocked The amount of NGT locked in this position
     * @return createdAt Timestamp when the position was created
     * @return unlockAt Timestamp when the position can be destroyed
     */
    function getPositionCore(uint256 positionId)
        external
        view
        returns (
            uint256 recipeId,
            uint256 seatTokenId,
            address bearer,
            uint256 ngtLocked,
            uint64 createdAt,
            uint64 unlockAt
        )
    {
        Position storage p = positions[positionId];
        require(p.recipeId != 0, "InvalidPosition");
        
        uint256 seatId = 0;
        if (positionRoyaltySeat[positionId].collection != address(0)) {
            seatId = positionRoyaltySeat[positionId].tokenId;
        }
        
        // Get current bearer from the NFT contract
        address currentOwner = IERC721(positionsToken).ownerOf(positionId);
        
        return (
            p.recipeId,
            seatId,
            currentOwner,
            p.inputAmountLocked,
            p.createdAt,
            p.unlockAt
        );
    }

    function getRecipeImageData(uint256 recipeId) external view returns (bytes memory) {
        address ptr = recipes[recipeId].imagePointer;
        if (ptr == address(0)) return "";
        return SSTORE2.read(ptr);
    }

    // XP derivation
    function getNPCForgeStats(address collection, uint256 tokenId) external view returns (NPCForgeStats memory) {
        return npcForgeStats[collection][tokenId];
    }

    function npcXP(address collection, uint256 tokenId) public view returns (uint256 xp) {
        NPCForgeStats memory s = npcForgeStats[collection][tokenId];

        uint256 fromNGTLocked = uint256(s.totalNGTLocked) / (100 ether);
        uint256 fromDestroyed = uint256(s.positionsDestroyed) * 5;
        uint256 fromCoal = uint256(s.totalCoalBurned) / 10;
        uint256 fromFees = (uint256(s.totalNGTFeeEarned) / 1 ether) * 2;

        xp = fromNGTLocked + fromDestroyed + fromCoal + fromFees;
    }
}

