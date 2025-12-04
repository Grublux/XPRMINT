// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title MasterForgeV1Storage
 * @notice Storage layout for the upgradeable MasterForgeV1 contract.
 * @dev This contract defines the storage layout to ensure proper storage slots in upgrades.
 */
abstract contract MasterForgeV1Storage {
    /// @notice High-level classification for crafted items.
    enum ItemClass {
        COIN,
        RELIC,
        ARTIFACT,
        TOOL,
        COMPONENT
    }

    /// @notice Configuration for a single forge recipe.
    /// @dev Designed to be V2-ready: supports both ERC20 input (e.g., NGT) and optional ERC1155 COAL input.
    struct Recipe {
        bool active;
        ItemClass itemClass;

        // Primary ERC20 input (e.g., NGT)
        address inputToken;        // ERC20 used for this recipe (0 => defaultInputToken)
        uint256 inputPerUnit;      // amount of inputToken required per unit crafted

        // Optional ERC1155 input (e.g., COAL) – can be ignored in V1 but must be present for V2.
        address coalToken1155;     // ERC1155 contract for COAL (0 => no COAL required)
        uint256 coalTokenId;       // COAL id required per unit
        uint256 coalPerUnit;       // amount of COAL per unit (burned)

        // On-chain art (optional). Typically a SSTORE2 pointer with PNG or full JSON.
        address imagePointer;      // address of SSTORE2 pointer contract (0 => no image stored)
        bytes32 imageHash;         // keccak256 hash of the raw image bytes for integrity

        uint64 lockDuration;       // per-unit lock duration (seconds)
        uint16 craftFeeBps;        // fee taken at craft time (in basis points)
        uint16 destroyFeeBps;      // fee taken at destroy / redeem time (in basis points)
        address feeRecipient;      // where protocol fees are sent (or a router)
        address forgeCreator;      // address that created the recipe / forge
        string uri;                // base metadata URI for items crafted from this recipe
    }

    /// @notice Position data keyed by ForgePosition721 tokenId.
    struct Position {
        uint256 recipeId;
        uint64 createdAt;
        uint64 unlockAt;
        uint256 inputAmountLocked; // net of craft fee
        address owner;             // mirrors ERC721 owner but kept for convenience
    }

    /// @notice Royalty seat for a position: which NFT collection and tokenId forged it.
    struct RoyaltySeat {
        address collection; // ERC721 collection (e.g. NPCs, future Forge NFTs)
        uint256 tokenId;    // tokenId within that collection
    }

    // -------- Access control --------

    /// @dev Address authorized to approve upgrades.
    address internal _upgrader;

    /// @dev Mapping tracking admin permissions.
    mapping(address => bool) internal _admins;

    // -------- Recipes --------

    /// @notice Next recipe id to use (starts at 0, first recipe is 1).
    uint256 public nextRecipeId;

    /// @notice Recipe configuration by id.
    mapping(uint256 => Recipe) public recipes;

    // -------- Positions --------

    /// @notice Position metadata keyed by ForgePosition721 tokenId.
    mapping(uint256 => Position) public positions;

    // -------- Aggregates --------

    /// @notice Total amount of input tokens locked across all positions.
    uint256 public totalInputLocked;

    /// @notice Number of active positions per user.
    mapping(address => uint256) public userActivePositions;

    /// @notice Aggregate input locked per recipe id.
    mapping(uint256 => uint256) public totalInputByRecipe;

    /// @notice Aggregate positions created per recipe id.
    mapping(uint256 => uint256) public totalPositionsByRecipe;

    // -------- Forge names --------

    /// @notice Optional human-readable names for creator forges.
    mapping(address => string) public forgeName;

    // -------- Global config --------

    /// @notice Default ERC20 address used when a recipe's inputToken is zero (typically NGT).
    address public defaultInputToken;

    /// @notice ERC20 used for protocol fees (may match inputToken or differ, e.g., APE).
    address public feeToken;

    /// @notice Address that receives or routes protocol fees.
    address public feeRouter;

    /// @notice Address of the ForgePosition721 contract used for position ownership.
    address public positionsToken;

    /// @notice Maximum allowed batch size for craftBatch.
    uint256 public maxBatchSize;

    // -------- Royalty seats --------

    /// @notice Royalty seat per Forge position (positionId => NFT collection + tokenId).
    mapping(uint256 => RoyaltySeat) public positionRoyaltySeat;

    /// @notice Collections allowed to act as royalty seats (NPCs now, optional Forge NFTs later).
    mapping(address => bool) public allowedRoyaltyCollections;

    /// @notice Default royalty collection used when caller does not explicitly specify one.
    /// @dev For now this will be set to the NPC collection; can be updated to other collections later.
    address public defaultRoyaltyCollection;

    // -------- Storage gap for upgrades --------

    uint256[37] private __gap;
}
