pragma solidity ^0.8.24;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

// NPCStatsV5: tracks forge-level and NPC-level stats and optional forge names.
// This contract uses UUPS pattern - deployed behind ERC1967Proxy.
// Owner (EOA) can upgrade directly via proxy.upgradeTo(newImpl).
// No ProxyAdmin needed.

interface INPCStats {
    struct ForgeStats {
        uint64 totalNGTCrafted;
        uint64 totalNGTReturned;
        uint64 totalNGTFee;
        uint64 totalCoalBurned;
        uint32 crafts;
        uint32 destroys;
        uint64 xp; // XP bucket; level is derived off-chain or in a view
    }

    struct NPCStatsData {
        uint64 totalNGTCrafted;
        uint64 totalNGTReturned;
        uint64 totalNGTFee;
        uint64 totalCoalBurned;
        uint32 crafts;
        uint32 destroys;
    }

    function getForgeStats(address forge) external view returns (ForgeStats memory);
    function getNPCStats(uint256 npcId) external view returns (NPCStatsData memory);
    function getForgeName(address forge) external view returns (string memory);

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

contract NPCStatsV5 is INPCStats {
    // ------------------------------------------------------------
    // PROXY-SAFE OWNERSHIP
    // ------------------------------------------------------------

    address public owner;
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

    function initialize(address _owner) external initializer {
        require(_owner != address(0), "ZERO_OWNER");
        owner = _owner;
    }

    // ------------------------------------------------------------
    // CONFIG
    // ------------------------------------------------------------

    // Current NPC ERC-721 collection. This MUST be configurable so we
    // can migrate NPCs to a new contract later.
    address public npcCollection;

    // Optional: MasterCrafter address that is allowed to call record* functions.
    address public masterCrafter;

    // Forge naming gate and default name.
    bool public forgeNamingEnabled;
    string public defaultForgeName = "NGMI Genesis Forge";

    // ------------------------------------------------------------
    // STATS STORAGE
    // ------------------------------------------------------------

    mapping(address => ForgeStats) private _forgeStats; // forge (wallet) => stats
    mapping(uint256 => NPCStatsData) private _npcStats; // npcId => stats
    mapping(address => string) private _forgeName;      // forge (wallet) => name

    // ------------------------------------------------------------
    // EVENTS
    // ------------------------------------------------------------

    event NpcCollectionSet(address indexed newCollection);
    event MasterCrafterSet(address indexed newMasterCrafter);
    event ForgeNameSet(address indexed forge, string name);
    event ForgeNamingEnabledSet(bool enabled);

    event CraftRecorded(
        address indexed forge,
        uint256 indexed npcId,
        uint256 indexed posId,
        uint256 recipeId,
        uint256 ngtAmount,
        uint256 coalAmount
    );

    event DestroyRecorded(
        address indexed forge,
        uint256 indexed npcId,
        uint256 indexed posId,
        uint256 ngtReturned,
        uint256 feeAmount
    );


    // ------------------------------------------------------------
    // ADMIN CONFIG
    // ------------------------------------------------------------

    function setNpcCollection(address newCollection) external onlyOwner {
        require(newCollection != address(0), "NPC_ZERO");
        npcCollection = newCollection;
        emit NpcCollectionSet(newCollection);
    }

    function setMasterCrafter(address newMasterCrafter) external onlyOwner {
        require(newMasterCrafter != address(0), "MC_ZERO");
        masterCrafter = newMasterCrafter;
        emit MasterCrafterSet(newMasterCrafter);
    }

    function setForgeNamingEnabled(bool enabled) external onlyOwner {
        forgeNamingEnabled = enabled;
        emit ForgeNamingEnabledSet(enabled);
    }

    function setDefaultForgeName(string calldata name_) external onlyOwner {
        // Optional: enforce a reasonable length [3, 32]
        bytes memory b = bytes(name_);
        require(b.length >= 3 && b.length <= 32, "FORGE_NAME_LEN");
        defaultForgeName = name_;
    }

    // ------------------------------------------------------------
    // PUBLIC VIEWS
    // ------------------------------------------------------------

    function getForgeStats(address forge) external view override returns (ForgeStats memory) {
        return _forgeStats[forge];
    }

    function getNPCStats(uint256 npcId) external view override returns (NPCStatsData memory) {
        return _npcStats[npcId];
    }

    function getForgeName(address forge) external view override returns (string memory) {
        string memory n = _forgeName[forge];
        if (bytes(n).length == 0) {
            return defaultForgeName;
        }
        return n;
    }

    // ------------------------------------------------------------
    // V5: DECODED GETTERS
    // ------------------------------------------------------------

    /// @notice Returns NPC stats as individual named fields (easier to read than struct)
    function getNPCStatsDecoded(uint256 npcId)
        external
        view
        returns (
            uint64 totalNGTCrafted,
            uint64 totalNGTReturned,
            uint64 totalNGTFee,
            uint64 totalCoalBurned,
            uint32 crafts,
            uint32 destroys
        )
    {
        NPCStatsData storage s = _npcStats[npcId];
        return (
            s.totalNGTCrafted,
            s.totalNGTReturned,
            s.totalNGTFee,
            s.totalCoalBurned,
            s.crafts,
            s.destroys
        );
    }

    /// @notice Returns a human-readable string summary of NPC stats (for ApeScan debugging)
    function getNPCStatsHuman(uint256 npcId) external view returns (string memory) {
        NPCStatsData storage s = _npcStats[npcId];
        return string(
            abi.encodePacked(
                "NPC #",
                Strings.toString(npcId),
                " | crafted=", Strings.toString(s.totalNGTCrafted),
                " | returned=", Strings.toString(s.totalNGTReturned),
                " | fee=", Strings.toString(s.totalNGTFee),
                " | coal=", Strings.toString(s.totalCoalBurned),
                " | crafts=", Strings.toString(s.crafts),
                " | destroys=", Strings.toString(s.destroys)
            )
        );
    }

    // ------------------------------------------------------------
    // FORGE NAMING
    // ------------------------------------------------------------

    function setForgeName(string calldata name_) external {
        require(forgeNamingEnabled, "FORGE_NAMING_DISABLED");
        bytes memory b = bytes(name_);
        require(b.length >= 3 && b.length <= 16, "FORGE_NAME_LEN");
        _forgeName[msg.sender] = name_;
        emit ForgeNameSet(msg.sender, name_);
    }

    // ------------------------------------------------------------
    // STATS RECORDING (CALLED BY MASTERCRAFTER)
    // ------------------------------------------------------------

    function recordCraft(
        address forge,
        uint256 npcId,
        uint256 recipeId,
        uint256 ngtAmount,
        uint256 coalAmount,
        uint256 posId
    ) external override {
        require(msg.sender == masterCrafter, "NOT_MC");
        ForgeStats storage fs = _forgeStats[forge];
        fs.totalNGTCrafted += uint64(ngtAmount);
        fs.totalCoalBurned += uint64(coalAmount);
        fs.crafts += 1;
        // XP policy can be tuned later; for now: 1 XP per craft.
        fs.xp += 1;

        NPCStatsData storage ns = _npcStats[npcId];
        ns.totalNGTCrafted += uint64(ngtAmount);
        ns.totalCoalBurned += uint64(coalAmount);
        ns.crafts += 1;

        emit CraftRecorded(forge, npcId, posId, recipeId, ngtAmount, coalAmount);
    }

    function recordDestroy(
        address forge,
        uint256 npcId,
        uint256 ngtReturned,
        uint256 feeAmount,
        uint256 posId
    ) external override {
        require(msg.sender == masterCrafter, "NOT_MC");
        ForgeStats storage fs = _forgeStats[forge];
        fs.totalNGTReturned += uint64(ngtReturned);
        fs.totalNGTFee += uint64(feeAmount);
        fs.destroys += 1;

        NPCStatsData storage ns = _npcStats[npcId];
        ns.totalNGTReturned += uint64(ngtReturned);
        ns.totalNGTFee += uint64(feeAmount);
        ns.destroys += 1;

        emit DestroyRecorded(forge, npcId, posId, ngtReturned, feeAmount);
    }

    // ------------------------------------------------------------
    // V5: RESET HELPERS (OWNER-ONLY)
    // ------------------------------------------------------------

    /// @notice Reset stats for a single NPC
    function resetNPC(uint256 npcId) external onlyOwner {
        delete _npcStats[npcId];
    }

    /// @notice Reset stats for multiple NPCs in a batch
    function resetNPCBatch(uint256[] calldata npcIds) external onlyOwner {
        uint256 len = npcIds.length;
        for (uint256 i = 0; i < len; i++) {
            delete _npcStats[npcIds[i]];
        }
    }

    /// @notice Reset stats for a single forge
    function resetForge(address forge) external onlyOwner {
        delete _forgeStats[forge];
    }

    /// @notice Reset stats for multiple forges in a batch
    function resetForgeBatch(address[] calldata forges) external onlyOwner {
        uint256 len = forges.length;
        for (uint256 i = 0; i < len; i++) {
            delete _forgeStats[forges[i]];
        }
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

