// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {MasterForgeV1Storage} from "./MasterForgeV1Storage.sol";
import {MasterForgeV1Events} from "./MasterForgeV1Events.sol";
import {ForgePosition721} from "./ForgePosition721.sol";

/**
 * @title MasterForgeV1
 * @notice Upgradeable forge contract for NGT-backed coins and future relics / artifacts / tools.
 * @dev Skeleton only — core crafting logic (including COAL burn) is left for implementation.
 */
contract MasterForgeV1 is
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuard,
    MasterForgeV1Storage,
    MasterForgeV1Events
{
    /// @notice Default ERC20 typed helper for defaultInputToken (typically NGT).
    IERC20 public defaultInputErc20;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize MasterForgeV1.
     * @param defaultInputToken_ Default ERC20 token used for recipes (typically NGT).
     * @param feeToken_ Token used for protocol fees (may match input token or differ, e.g., APE).
     * @param feeRouter_ Address that receives or routes protocol fees.
     * @param positionsToken_ Address of the ForgePosition721 contract that will mint position NFTs.
     * @param maxBatchSize_ Maximum allowed batch size for crafting.
     */
    function initialize(
        address defaultInputToken_,
        address feeToken_,
        address feeRouter_,
        address positionsToken_,
        uint256 maxBatchSize_
    ) external initializer {
        __Ownable_init(msg.sender);

        if (defaultInputToken_ == address(0)) {
            revert InvalidInputAmount();
        }
        if (positionsToken_ == address(0)) {
            revert InvalidPosition();
        }

        defaultInputToken = defaultInputToken_;
        defaultInputErc20 = IERC20(defaultInputToken_);
        feeToken = feeToken_;
        feeRouter = feeRouter_;
        positionsToken = positionsToken_;
        maxBatchSize = maxBatchSize_;

        // set deployer as upgrader and admin
        _upgrader = msg.sender;
        _admins[msg.sender] = true;
    }

    // ============ Modifiers & access control ============

    modifier onlyUpgrader() {
        if (!_isUpgrader(_msgSender())) revert UnauthorizedUpgrader();
        _;
    }

    modifier onlyOwnerOrUpgrader() {
        address sender = _msgSender();
        if (sender != owner() && !_isUpgrader(sender)) {
            revert UnauthorizedUpgrader();
        }
        _;
    }

    modifier onlyAdmin() {
        if (!_isAdmin(_msgSender())) revert InvalidAdminAddress();
        _;
    }

    // ============ Admin helpers ============

    function isAdmin(address account) public view returns (bool) {
        return _isAdmin(account);
    }

    function getUpgrader() public view returns (address) {
        return _upgrader;
    }

    function setAdmin(address admin, bool enabled) external onlyOwnerOrUpgrader {
        if (admin == address(0)) revert InvalidAdminAddress();
        _admins[admin] = enabled;
        // TODO: consider emitting an AdminUpdated event for off-chain indexers.
    }

    function setUpgrader(address newUpgrader) external onlyOwnerOrUpgrader {
        if (newUpgrader == address(0)) revert UpgraderZeroAddress();
        _upgrader = newUpgrader;
        // TODO: consider emitting an UpgraderUpdated event.
    }

    function _isAdmin(address account) internal view returns (bool) {
        return account == owner() || _admins[account];
    }

    function _isUpgrader(address account) internal view returns (bool) {
        return account != address(0) && account == _upgrader;
    }

    function _authorizeUpgrade(address) internal view override {
        address sender = _msgSender();
        if (sender != owner() && !_isUpgrader(sender)) {
            revert UnauthorizedUpgrader();
        }
    }

    // ============ Config setters ============

    function setForgeName(string calldata name) external {
        if (bytes(name).length == 0) revert InvalidForgeName();
        forgeName[msg.sender] = name;
        emit ForgeNameUpdated(msg.sender, name);
    }

    function setDefaultInputToken(address token) external onlyOwnerOrUpgrader {
        if (token == address(0)) revert InvalidInputAmount();
        defaultInputToken = token;
        defaultInputErc20 = IERC20(token);
    }

    function setFeeToken(address token) external onlyOwnerOrUpgrader {
        feeToken = token;
    }

    function setFeeRouter(address router) external onlyOwnerOrUpgrader {
        feeRouter = router;
    }

    function setPositionsToken(address token) external onlyOwnerOrUpgrader {
        positionsToken = token;
    }

    function setMaxBatchSize(uint256 newMax) external onlyOwnerOrUpgrader {
        if (newMax == 0) revert InvalidInputAmount();
        maxBatchSize = newMax;
    }

    /// @notice Allow or disallow a collection to act as a royalty seat.
    function setRoyaltyCollection(address collection, bool allowed) external onlyOwnerOrUpgrader {
        if (collection == address(0)) revert InvalidAdminAddress();
        allowedRoyaltyCollections[collection] = allowed;
    }

    /// @notice Set the default royalty collection used when caller does not explicitly specify one.
    /// @dev For V1 this should be set to the NPC collection.
    function setDefaultRoyaltyCollection(address collection) external onlyOwnerOrUpgrader {
        if (collection != address(0) && !allowedRoyaltyCollections[collection]) {
            revert UnsupportedRoyaltyCollection();
        }
        defaultRoyaltyCollection = collection;
    }

    // ============ Recipe management ============

    struct RecipeConfig {
        ItemClass itemClass;

        // ERC20 side (e.g., NGT)
        address inputToken;
        uint256 inputPerUnit;

        // ERC1155 COAL side (optional)
        address coalToken1155;
        uint256 coalTokenId;
        uint256 coalPerUnit;

        // On-chain art config
        // If imageData is non-empty, the contract should write it to SSTORE2 and store the pointer + hash.
        // If imageData is empty, imagePointer/imageHash remain zeroed.
        bytes imageData;           // raw PNG or JSON bytes to be written via SSTORE2 (optional)

        uint64  lockDuration;
        uint16  craftFeeBps;
        uint16  destroyFeeBps;
        address feeRecipient;
        string  uri;
    }

    /**
     * @notice Create a new forge recipe.
     */
    function createRecipe(RecipeConfig calldata cfg) external onlyAdmin returns (uint256 recipeId) {
        if (cfg.inputPerUnit == 0) revert InvalidInputAmount();
        if (cfg.craftFeeBps > 10_000 || cfg.destroyFeeBps > 10_000) {
            revert InvalidFeeConfig();
        }

        if (cfg.coalPerUnit > 0 && cfg.coalToken1155 == address(0)) {
            revert InvalidFeeConfig();
        }

        address inputToken_ = cfg.inputToken == address(0)
            ? defaultInputToken
            : cfg.inputToken;

        if (inputToken_ == address(0)) revert InvalidInputAmount();

        // Optional on-chain art
        address imagePointer_ = address(0);
        bytes32 imageHash_ = bytes32(0);

        if (cfg.imageData.length > 0) {
            // Store raw bytes on-chain via SSTORE2
            imagePointer_ = _writeSSTORE2(cfg.imageData);
            imageHash_ = keccak256(cfg.imageData);
        }

        recipeId = ++nextRecipeId;

        recipes[recipeId] = Recipe({
            active: true,
            itemClass: cfg.itemClass,
            inputToken: inputToken_,
            inputPerUnit: cfg.inputPerUnit,
            coalToken1155: cfg.coalToken1155,
            coalTokenId: cfg.coalTokenId,
            coalPerUnit: cfg.coalPerUnit,
            imagePointer: imagePointer_,
            imageHash: imageHash_,
            lockDuration: cfg.lockDuration,
            craftFeeBps: cfg.craftFeeBps,
            destroyFeeBps: cfg.destroyFeeBps,
            feeRecipient: cfg.feeRecipient,
            forgeCreator: msg.sender,
            uri: cfg.uri
        });

        emit RecipeCreated(recipeId, msg.sender, uint8(cfg.itemClass));
    }

    /**
     * @notice Update an existing recipe.
     * @dev Conservative update: core economics cannot change after creation to protect existing positions.
     */
    function updateRecipe(uint256 recipeId, RecipeConfig calldata cfg) external onlyAdmin {
        if (recipeId == 0 || recipeId > nextRecipeId) revert InvalidRecipe();

        Recipe storage r = recipes[recipeId];

        if (!r.active) revert RecipeNotActive();

        address expectedInputToken = cfg.inputToken == address(0)
            ? r.inputToken
            : cfg.inputToken;

        if (
            cfg.inputPerUnit != r.inputPerUnit ||
            expectedInputToken != r.inputToken ||
            cfg.itemClass != r.itemClass ||
            cfg.coalToken1155 != r.coalToken1155 ||
            cfg.coalTokenId   != r.coalTokenId   ||
            cfg.coalPerUnit   != r.coalPerUnit
        ) {
            revert InvalidFeeConfig();
        }

        if (cfg.craftFeeBps > 10_000 || cfg.destroyFeeBps > 10_000) {
            revert InvalidFeeConfig();
        }

        // Art update rules
        if (r.imagePointer == address(0)) {
            // Allow one-time art set
            if (cfg.imageData.length > 0) {
                address imagePointer_ = _writeSSTORE2(cfg.imageData);
                r.imagePointer = imagePointer_;
                r.imageHash = keccak256(cfg.imageData);
            }
        } else {
            // Art already set; optionally allow a no-op if hash matches, otherwise block changes
            if (cfg.imageData.length > 0) {
                if (keccak256(cfg.imageData) != r.imageHash) {
                    revert InvalidFeeConfig(); // Art already set and hash doesn't match
                }
            }
        }

        r.lockDuration  = cfg.lockDuration;
        r.craftFeeBps   = cfg.craftFeeBps;
        r.destroyFeeBps = cfg.destroyFeeBps;
        r.feeRecipient  = cfg.feeRecipient;
        r.uri           = cfg.uri;

        emit RecipeUpdated(recipeId);
    }

    // ============ Crafting ============

    /**
     * @notice Craft a single position from a recipe.
     * @param recipeId The recipe to craft from.
     * @param seatCollection The NFT collection acting as the royalty seat (0 => use defaultRoyaltyCollection).
     * @param seatTokenId The tokenId within the seat collection that the caller owns.
     */
    function craft(
        uint256 recipeId,
        address seatCollection,
        uint256 seatTokenId
    ) external nonReentrant returns (uint256 positionId) {
        Recipe memory r = recipes[recipeId];
        if (!r.active) revert RecipeNotActive();
        if (r.inputPerUnit == 0) revert InvalidInputAmount();

        // Resolve royalty seat collection: if none specified, use defaultRoyaltyCollection.
        address collection = seatCollection;
        if (collection == address(0)) {
            collection = defaultRoyaltyCollection;
        }

        if (collection != address(0)) {
            // Must be an allowed collection (for V1, NPC contract).
            if (!allowedRoyaltyCollections[collection]) {
                revert UnsupportedRoyaltyCollection();
            }
            // Require the caller to own the seat NFT.
            if (IERC721(collection).ownerOf(seatTokenId) != msg.sender) {
                revert NotRoyaltySeatOwner();
            }
        }

        address token = r.inputToken == address(0)
            ? defaultInputToken
            : r.inputToken;
        if (token == address(0)) revert InvalidInputAmount();

        uint256 inputAmount = r.inputPerUnit;

        IERC20(token).transferFrom(msg.sender, address(this), inputAmount);

        uint256 craftFee;
        uint256 lockedAmount = inputAmount;
        if (r.craftFeeBps > 0) {
            craftFee = (inputAmount * r.craftFeeBps) / 10_000;
            lockedAmount = inputAmount - craftFee;
            _routeFee(token, craftFee, r.feeRecipient);
        }

        if (r.coalPerUnit > 0) {
            IERC1155(r.coalToken1155).safeTransferFrom(
                msg.sender,
                address(0x000000000000000000000000000000000000dEaD),
                r.coalTokenId,
                r.coalPerUnit,
                ""
            );
        }

        uint64 createdAt = uint64(block.timestamp);
        uint64 unlockAt = createdAt + r.lockDuration;

        positionId = ForgePosition721(positionsToken).mintPosition(msg.sender);

        positions[positionId] = Position({
            recipeId: recipeId,
            createdAt: createdAt,
            unlockAt: unlockAt,
            inputAmountLocked: lockedAmount,
            owner: msg.sender
        });

        // Assign royalty seat if a valid collection was resolved
        if (collection != address(0)) {
            positionRoyaltySeat[positionId] = RoyaltySeat({
                collection: collection,
                tokenId: seatTokenId
            });
        }

        totalInputLocked += lockedAmount;
        totalInputByRecipe[recipeId] += lockedAmount;
        totalPositionsByRecipe[recipeId] += 1;
        userActivePositions[msg.sender] += 1;

        emit Crafted(msg.sender, positionId, recipeId, lockedAmount, unlockAt);
    }

    /**
     * @notice Craft multiple positions of the same recipe in a single transaction.
     * @param recipeId The recipe to craft from.
     * @param count Number of positions to craft.
     * @param seatCollection The NFT collection acting as the royalty seat (0 => use defaultRoyaltyCollection).
     * @param seatTokenId The tokenId within the seat collection that the caller owns.
     */
    function craftBatch(
        uint256 recipeId,
        uint256 count,
        address seatCollection,
        uint256 seatTokenId
    ) external nonReentrant returns (uint256[] memory positionIds) {
        if (count == 0 || count > maxBatchSize) revert BatchTooLarge();

        Recipe memory r = recipes[recipeId];
        if (!r.active) revert RecipeNotActive();
        if (r.inputPerUnit == 0) revert InvalidInputAmount();

        // Resolve royalty seat collection: if none specified, use defaultRoyaltyCollection.
        address collection = seatCollection;
        if (collection == address(0)) {
            collection = defaultRoyaltyCollection;
        }

        if (collection != address(0)) {
            // Must be an allowed collection (for V1, NPC contract).
            if (!allowedRoyaltyCollections[collection]) {
                revert UnsupportedRoyaltyCollection();
            }
            // Require the caller to own the seat NFT.
            if (IERC721(collection).ownerOf(seatTokenId) != msg.sender) {
                revert NotRoyaltySeatOwner();
            }
        }

        address token = r.inputToken == address(0)
            ? defaultInputToken
            : r.inputToken;
        if (token == address(0)) revert InvalidInputAmount();

        uint256 totalInput = r.inputPerUnit * count;

        IERC20(token).transferFrom(msg.sender, address(this), totalInput);

        uint256 totalCraftFee;
        uint256 totalLocked = totalInput;
        if (r.craftFeeBps > 0) {
            totalCraftFee = (totalInput * r.craftFeeBps) / 10_000;
            totalLocked = totalInput - totalCraftFee;
            _routeFee(token, totalCraftFee, r.feeRecipient);
        }

        if (r.coalPerUnit > 0) {
            uint256 totalCoal = r.coalPerUnit * count;
            IERC1155(r.coalToken1155).safeTransferFrom(
                msg.sender,
                address(0x000000000000000000000000000000000000dEaD),
                r.coalTokenId,
                totalCoal,
                ""
            );
        }

        uint256 lockedPerPosition = totalLocked / count;
        require(lockedPerPosition * count == totalLocked, "Forge: dust");

        uint64 createdAt = uint64(block.timestamp);
        uint64 unlockAt = createdAt + r.lockDuration;

        positionIds = new uint256[](count);

        for (uint256 i = 0; i < count; ++i) {
            uint256 positionId = ForgePosition721(positionsToken).mintPosition(msg.sender);

            positions[positionId] = Position({
                recipeId: recipeId,
                createdAt: createdAt,
                unlockAt: unlockAt,
                inputAmountLocked: lockedPerPosition,
                owner: msg.sender
            });

            // Assign royalty seat if a valid collection was resolved
            if (collection != address(0)) {
                positionRoyaltySeat[positionId] = RoyaltySeat({
                    collection: collection,
                    tokenId: seatTokenId
                });
            }

            positionIds[i] = positionId;
        }

        totalInputLocked += totalLocked;
        totalInputByRecipe[recipeId] += totalLocked;
        totalPositionsByRecipe[recipeId] += count;
        userActivePositions[msg.sender] += count;

        emit CraftedBatch(msg.sender, recipeId, positionIds, totalLocked);
    }

    // ============ Destroy / redeem ============

    /**
     * @notice Destroy a position and redeem underlying input tokens.
     */
    function destroy(uint256 positionId) external nonReentrant {
        Position memory p = positions[positionId];
        if (p.owner == address(0)) revert InvalidPosition();
        if (p.owner != msg.sender) revert UnauthorizedPositionOwner();
        if (block.timestamp < p.unlockAt) revert LockNotExpired();

        Recipe memory r = recipes[p.recipeId];
        address token = r.inputToken == address(0)
            ? defaultInputToken
            : r.inputToken;
        if (token == address(0)) revert InvalidInputAmount();

        uint256 base = p.inputAmountLocked;

        ForgePosition721(positionsToken).burnPosition(msg.sender, positionId);

        delete positions[positionId];

        userActivePositions[msg.sender] -= 1;
        totalInputLocked -= base;
        totalInputByRecipe[p.recipeId] -= base;

        uint256 destroyFee;
        uint256 payout = base;
        if (r.destroyFeeBps > 0) {
            destroyFee = (base * r.destroyFeeBps) / 10_000;
            payout = base - destroyFee;
            _routeFee(token, destroyFee, r.feeRecipient);
        }

        IERC20(token).transfer(msg.sender, payout);

        emit Destroyed(msg.sender, positionId, p.recipeId, payout, destroyFee);
    }

    // ============ Views ============

    function getRecipe(uint256 recipeId) external view returns (Recipe memory) {
        return recipes[recipeId];
    }

    function getPosition(uint256 positionId) external view returns (Position memory) {
        return positions[positionId];
    }

    function getGlobalStats()
        external
        view
        returns (uint256 _totalInputLocked, uint256 _nextRecipeId)
    {
        _totalInputLocked = totalInputLocked;
        _nextRecipeId = nextRecipeId;
    }

    function getRecipeStats(
        uint256 recipeId
    ) external view returns (uint256 totalInput, uint256 totalPositions) {
        totalInput = totalInputByRecipe[recipeId];
        totalPositions = totalPositionsByRecipe[recipeId];
    }

    /// @notice Returns the address that should receive royalties for a given position.
    /// @dev If no royalty seat is recorded, falls back to the recipe's forgeCreator.
    function royaltyReceiverForPosition(uint256 positionId) external view returns (address) {
        Position memory p = positions[positionId];
        if (p.owner == address(0)) revert InvalidPosition();

        RoyaltySeat memory seat = positionRoyaltySeat[positionId];
        if (seat.collection != address(0)) {
            return IERC721(seat.collection).ownerOf(seat.tokenId);
        }

        Recipe memory r = recipes[p.recipeId];
        return r.forgeCreator;
    }

    // ============ Internal helpers ============

    /**
     * @notice Route fees to feeRouter (if set) or explicit recipient.
     */
    function _routeFee(
        address token,
        uint256 amount,
        address explicitRecipient
    ) internal {
        if (amount == 0) return;

        address recipient = feeRouter != address(0) ? feeRouter : explicitRecipient;
        if (recipient == address(0)) revert InvalidFeeConfig();

        IERC20(token).transfer(recipient, amount);
    }

    /**
     * @notice Write bytes to SSTORE2 and return pointer address.
     * @dev Uses SSTORE2 pattern: deploy a minimal contract with the bytes as code.
     */
    function _writeSSTORE2(bytes memory data) internal returns (address pointer) {
        // SSTORE2 pattern: deploy a minimal contract with the bytes as code
        // Bytecode structure:
        //   PUSH2 <length> (3 bytes: 0x61 + 2-byte length)
        //   DUP1 (1 byte: 0x80)
        //   PUSH1 0c (2 bytes: 0x60 0x0c) - offset to data (12 bytes)
        //   PUSH1 00 (2 bytes: 0x60 0x00) - destination offset
        //   CODECOPY (1 byte: 0x39)
        //   PUSH1 00 (2 bytes: 0x60 0x00) - return offset
        //   RETURN (1 byte: 0xf3)
        //   <data>
        // Total header: 12 bytes
        bytes memory bytecode = abi.encodePacked(
            hex"61", // PUSH2
            uint16(data.length), // Length of data
            hex"80", // DUP1
            hex"60", // PUSH1
            hex"0c", // offset to data (12 bytes)
            hex"60", // PUSH1
            hex"00", // offset
            hex"39", // CODECOPY
            hex"60", // PUSH1
            hex"00", // offset
            hex"f3", // RETURN
            data
        );

        assembly {
            pointer := create(0, add(bytecode, 0x20), mload(bytecode))
        }

        if (pointer == address(0)) revert InvalidFeeConfig(); // Deployment failed
    }

    // ============ TokenURI support ============

    /**
     * @notice Get tokenURI for a position, delegating to recipe's on-chain art if available.
     * @dev Can be called by ForgePosition721.tokenURI() or external viewers.
     */
    function positionTokenURI(uint256 positionId) external view returns (string memory) {
        Position memory p = positions[positionId];
        if (p.owner == address(0)) revert InvalidPosition();
        Recipe memory r = recipes[p.recipeId];
        return r.uri; // placeholder until full on-chain JSON+Base64 is implemented
    }
}
