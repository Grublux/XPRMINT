// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ============================================================
//  MASTERCRAFTER V5 (DESTRUCTION FIXES + TEAM FEE HOOKS)
//  Extends V4 with fixed destruction logic, team fee support,
//  rich destroy event, and quote helper.
//  Matches V4 storage layout exactly, appends new storage only.
//  via_ir = false compatible.
//  Proxy-safe.
//
//  UPGRADE MECHANISM:
//  Uses UUPS pattern - upgrade logic in implementation.
//  Owner (EOA) can upgrade directly via proxy.upgradeTo(newImpl).
//  No ProxyAdmin needed.
// ============================================================

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IMasterCrafterV1 } from "../interfaces/IMasterCrafterV1.sol";
import { ICraftedV1Positions } from "../interfaces/ICraftedV1Positions.sol";

interface IERC721Minimal {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface INPCStatsMinimal {
    function recordCraft(
        address forge,
        uint256 npcId,
        uint256 recipeId,
        uint256 ngtAmount,
        uint256 coalAmount,
        uint256 posId
    ) external;

    function recordDestroy(
        address forge,
        uint256 npcId,
        uint256 ngtReturned,
        uint256 feeAmount,
        uint256 posId
    ) external;
}

interface IMasterCrafterNpcPosition {
    function positionNpcIdView(uint256 posId) external view returns (uint256);
}

contract MasterCrafterV5 is IMasterCrafterV1, IMasterCrafterNpcPosition {

    // ------------------------------------------------------------
    //  STORAGE — MUST MATCH MASTERCRAFTER V1/V2 EXACTLY
    // ------------------------------------------------------------

    address public positionsToken;     // slot 0
    address public ngtToken;           // slot 1
    address public coalToken;          // slot 2

    mapping(uint256 => Recipe) public recipes;   // slot 3
    uint256 public nextRecipeId;                 // slot 4

    mapping(uint256 => Position) public positions;   // slot 5
    uint256 public nextPositionId;                   // slot 6

    mapping(uint256 => address) public positionRoyaltySeat; // slot 7

    // ------------------------------------------------------------
    //                INITIALIZER / ADMIN
    // ------------------------------------------------------------

    address public owner; // slot 8
    bool private _initialized;

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    modifier initializer() {
        require(!_initialized, "ALREADY_INIT");
        _;
        _initialized = true;
    }

    function initialize(address _positions, address _ngt, address _coal) external initializer {
        owner = msg.sender;
        positionsToken = _positions;
        ngtToken = _ngt;
        coalToken = _coal;
    }

    function setPositionsToken(address a) external onlyOwner {
        positionsToken = a;
    }

    function setTokenURIBase(string calldata s) external onlyOwner {
        baseURI = s;
    }

    // ------------------------------------------------------------
    //                     TOKEN URI
    // ------------------------------------------------------------

    string public baseURI = "https://xprmint-metadata-oych.vercel.app/api/crafted/metadata/";

    function positionTokenURI(uint256 id) external view override returns (string memory) {
        require(positions[id].recipeId != 0, "InvalidPosition");
        return string(abi.encodePacked(baseURI, _toString(id)));
    }

    function royaltyReceiverForPosition(uint256 posId) external view override returns (address) {
        Position storage p = positions[posId];
        require(p.owner != address(0), "!pos");
        address seat = positionRoyaltySeat[posId];
        if (seat != address(0)) {
            return IERC721(seat).ownerOf(0); // Simplified - may need adjustment
        }
        return address(0);
    }

    function getRecipe(uint256 id) external view override returns (IMasterCrafterV1.Recipe memory) {
        Recipe storage r = recipes[id];
        return IMasterCrafterV1.Recipe({
            active: r.active,
            inputPerUnit: r.inputPerUnit,
            coalPerUnit: r.coalPerUnit,
            lockDuration: r.lockDuration
        });
    }

    function getPosition(uint256 id) external view override returns (IMasterCrafterV1.Position memory) {
        Position storage p = positions[id];
        return IMasterCrafterV1.Position({
            recipeId: p.recipeId,
            inputAmountLocked: p.inputAmountLocked,
            createdAt: p.createdAt,
            unlockAt: p.unlockAt,
            owner: p.owner
        });
    }

    function _toString(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 temp = v;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (v != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(v % 10)));
            v /= 10;
        }
        return string(buffer);
    }

    // ------------------------------------------------------------
    //                     RECIPE MGMT
    // ------------------------------------------------------------

    function createRecipe(IMasterCrafterV1.Recipe calldata r) external onlyOwner returns (uint256 id) {
        id = ++nextRecipeId;
        recipes[id] = r;
    }

    // ------------------------------------------------------------
    //                     CORE CRAFT LOGIC
    // ------------------------------------------------------------

    event Crafted(address indexed user, uint256 indexed positionId, uint256 indexed recipeId, uint256 inputAmountLocked, uint64 unlockAt);
    event Destroyed(address indexed user, uint256 indexed positionId, uint256 indexed recipeId, uint256 amountReturned, uint256 feeTaken);
    
    // V5: Rich destroy event with all details
    event PositionDestroyed(
        uint256 indexed positionId,
        uint256 indexed npcId,
        address indexed destroyer,
        uint256 totalLocked,
        uint256 npcFee,
        uint256 teamFee,
        uint256 refundToDestroyer
    );

    // Legacy craft() is disabled - NPC-only crafting is enforced.
    // All callers must use craftWithNPC(uint256 recipeId, uint256 npcId) instead.
    function craft(uint256 recipeId) external returns (uint256 posId) {
        revert("NPC_REQUIRED");
    }

    // ------------------------------------------------------------
    //  V5: DESTRUCTION LOGIC (FIXED)
    // ------------------------------------------------------------

    /// @notice Destroy a position and route fees correctly
    /// @dev Always records stats consistently: feeAmount=10%, returnAmount=90% for NPCStats
    ///      If destroyer is crafter: transfers 100% but records 90% return + 10% fee for stats
    ///      If destroyer is not crafter: transfers 90% to destroyer, 10% to NPC owner
    ///      Team fee (if set) is applied on top of NPC fee
    function destroyPosition(uint256 posId) external {
        require(!destructionPaused, "DESTRUCTION_PAUSED");
        Position storage p = positions[posId];
        require(p.owner == msg.sender, "NOT_OWNER");
        require(block.timestamp >= p.unlockAt, "LOCKED");

        uint256 totalLocked = p.inputAmountLocked;
        address forge = positionForge[posId];
        uint256 npcId = positionNpcId[posId];
        
        // Calculate fees
        uint256 npcFee = (totalLocked * 10) / 100; // 10% to NPC
        uint256 teamFee = (totalLocked * teamDestroyFeeBps) / 10000; // Team fee in basis points

        // Transfer logic
        bool isCrafter = (forge != address(0) && forge == msg.sender);
        
        if (isCrafter && npcId != 0) {
            // Crafter destroying their own coin: transfer team fee (if any), then 100% - teamFee to destroyer
            // NPC fee is paid to themselves (no transfer needed)
            if (teamFee > 0 && teamDestroyFeeRecipient != address(0)) {
                IERC20(ngtToken).transfer(teamDestroyFeeRecipient, teamFee);
            }
            IERC20(ngtToken).transfer(msg.sender, totalLocked - teamFee);
        } else {
            // Non-crafter destroying: split transfers
            _transferDestroyFees(npcId, npcFee, teamFee);
            IERC20(ngtToken).transfer(msg.sender, totalLocked - npcFee - teamFee);
        }

        // Clean up storage
        delete positions[posId];
        delete positionNpcId[posId];
        delete positionForge[posId];

        ICraftedV1Positions(positionsToken).burnPosition(posId);

        // Always record stats with consistent values (90% return, 10% fee)
        if (npcStats != address(0) && npcId != 0 && forge != address(0)) {
            INPCStatsMinimal(npcStats).recordDestroy(forge, npcId, totalLocked - npcFee, npcFee, posId);
        }

        // Emit both events for backward compatibility and rich data
        uint256 refund = isCrafter ? (totalLocked - teamFee) : (totalLocked - npcFee - teamFee);
        emit Destroyed(msg.sender, posId, p.recipeId, refund, npcFee + teamFee);
        emit PositionDestroyed(posId, npcId, msg.sender, totalLocked, npcFee, teamFee, refund);
    }

    /// @notice Internal helper to transfer destruction fees
    function _transferDestroyFees(uint256 npcId, uint256 npcFee, uint256 teamFee) internal {
        if (npcId != 0 && npcFee > 0) {
            address npcOwner = IERC721Minimal(npcCollection).ownerOf(npcId);
            if (npcOwner != address(0)) {
                IERC20(ngtToken).transfer(npcOwner, npcFee);
            }
        }
        
        if (teamFee > 0 && teamDestroyFeeRecipient != address(0)) {
            IERC20(ngtToken).transfer(teamDestroyFeeRecipient, teamFee);
        }
    }


    // ------------------------------------------------------------
    //  V5: QUOTE HELPER
    // ------------------------------------------------------------

    /// @notice Preview destruction outcome without executing
    /// @param posId Position ID to destroy
    /// @param destroyer Address that would destroy (for checking if they're the crafter)
    /// @return totalLocked Total NGT locked in position
    /// @return npcFee Fee going to NPC owner (10%)
    /// @return teamFee Fee going to team (if configured)
    /// @return refund Amount that would be refunded to destroyer
    function getDestroyQuote(uint256 posId, address destroyer) 
        external 
        view 
        returns (
            uint256 totalLocked,
            uint256 npcFee,
            uint256 teamFee,
            uint256 refund
        ) 
    {
        Position storage p = positions[posId];
        require(p.owner != address(0), "INVALID_POSITION");
        require(p.owner == destroyer, "NOT_OWNER");
        require(block.timestamp >= p.unlockAt, "LOCKED");
        
        totalLocked = p.inputAmountLocked;
        npcFee = (totalLocked * 10) / 100;
        teamFee = (totalLocked * teamDestroyFeeBps) / 10000;
        
        // Calculate refund based on whether destroyer is the crafter
        address forge = positionForge[posId];
        bool isCrafter = (forge != address(0) && forge == destroyer);
        
        if (isCrafter) {
            // Crafter gets 100% - teamFee back (team fee still applies)
            refund = totalLocked - teamFee;
        } else {
            // Non-crafter gets remaining after fees
            refund = totalLocked - npcFee - teamFee;
        }
        
        return (totalLocked, npcFee, teamFee, refund);
    }

    // ------------------------------------------------------------
    //  NEW V3 STORAGE (APPEND-ONLY, AFTER ALL V2 STORAGE)
    // ------------------------------------------------------------

    // NPC + stats wiring (append-only)
    address public npcCollection;      // pointer to NPC ERC721 (configurable)
    address public npcStats;           // NPCStats proxy address
    address public royaltyRouter;      // RoyaltyRouter proxy address

    // Per-position NPC + forge at time of craft
    mapping(uint256 => uint256) public positionNpcId;   // posId => npcId
    mapping(uint256 => address) public positionForge;   // posId => forge (wallet) at craft time

    // ------------------------------------------------------------
    //  V5: TEAM DESTRUCTION FEE + PAUSE (APPEND-ONLY STORAGE)
    // ------------------------------------------------------------

    address public teamDestroyFeeRecipient; // Address to receive team destruction fees
    uint16 public teamDestroyFeeBps;        // Team fee in basis points (0 = disabled, default)
    bool public destructionPaused;          // Global pause flag for destruction

    // ------------------------------------------------------------
    //  V3 ADMIN CONFIG
    // ------------------------------------------------------------

    function setNpcCollection(address a) external onlyOwner {
        require(a != address(0), "NPC_ZERO");
        npcCollection = a;
    }

    function setNpcStats(address a) external onlyOwner {
        require(a != address(0), "NPCSTATS_ZERO");
        npcStats = a;
    }

    function setRoyaltyRouter(address a) external onlyOwner {
        require(a != address(0), "ROUTER_ZERO");
        royaltyRouter = a;
    }

    // ------------------------------------------------------------
    //  V5: TEAM FEE ADMIN CONFIG
    // ------------------------------------------------------------

    /// @notice Set team destruction fee recipient
    function setTeamDestroyFeeRecipient(address recipient) external onlyOwner {
        teamDestroyFeeRecipient = recipient;
    }

    /// @notice Set team destruction fee in basis points (0 = disabled, max 1000 = 10%)
    function setTeamDestroyFeeBps(uint16 bps) external onlyOwner {
        require(bps <= 1000, "TEAM_FEE_TOO_HIGH"); // Max 10%
        teamDestroyFeeBps = bps;
    }

    /// @notice Pause or unpause destruction globally
    function setDestructionPaused(bool paused) external onlyOwner {
        destructionPaused = paused;
    }

    // ------------------------------------------------------------
    //  V3 VIEW HELPERS
    // ------------------------------------------------------------

    function positionNpcIdView(uint256 posId) external view override returns (uint256) {
        return positionNpcId[posId];
    }

    function positionForgeView(uint256 posId) external view returns (address) {
        return positionForge[posId];
    }

    // ------------------------------------------------------------
    //  V3 NPC-AWARE CRAFT
    // ------------------------------------------------------------

    function craftWithNPC(uint256 recipeId, uint256 npcId) external returns (uint256 posId) {
        require(npcCollection != address(0), "NPC_COLL_NOT_SET");
        // NPC must be owned by caller
        require(IERC721Minimal(npcCollection).ownerOf(npcId) == msg.sender, "NOT_NPC_OWNER");

        // Reuse the existing craft logic but inline it here, NOT by calling craft(),
        // so we can capture posId and attach npcId / forge.
        Recipe storage r = recipes[recipeId];
        require(r.active, "INACTIVE");

        uint256 amount = r.inputPerUnit;

        IERC20(ngtToken).transferFrom(msg.sender, address(this), amount);
        if (r.coalPerUnit > 0 && coalToken != address(0)) {
            IERC20(coalToken).transferFrom(msg.sender, address(this), r.coalPerUnit);
        }

        posId = ICraftedV1Positions(positionsToken).mintPosition(msg.sender);
        uint64 unlock = uint64(block.timestamp) + uint64(r.lockDuration);

        positions[posId] = Position({
            recipeId: recipeId,
            inputAmountLocked: amount,
            createdAt: uint64(block.timestamp),
            unlockAt: unlock,
            owner: msg.sender
        });

        // Store NPC + forge
        positionNpcId[posId] = npcId;
        positionForge[posId] = msg.sender;

        // Record stats if wired
        if (npcStats != address(0)) {
            INPCStatsMinimal(npcStats).recordCraft(
                msg.sender,
                npcId,
                recipeId,
                amount,
                r.coalPerUnit,
                posId
            );
        }

        emit Crafted(msg.sender, posId, recipeId, amount, unlock);
    }

    // ------------------------------------------------------------
    //  UPGRADE FUNCTION (UUPS PATTERN - NO PROXYADMIN)
    // ------------------------------------------------------------

    event Upgraded(address indexed implementation);

    /**
     * @dev Upgrades the proxy to a new implementation.
     * @param newImplementation Address of the new implementation contract.
     * 
     * Only the owner can upgrade. This function directly updates the ERC1967 implementation slot.
     * keccak256("eip1967.proxy.implementation") - 1
     */
    function upgradeTo(address newImplementation) external onlyOwner {
        require(newImplementation != address(0), "ZERO_IMPL");
        require(newImplementation.code.length > 0, "NO_CODE");
        
        bytes32 implementationSlot = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
        
        assembly {
            sstore(implementationSlot, newImplementation)
        }
        
        emit Upgraded(newImplementation);
    }
}

