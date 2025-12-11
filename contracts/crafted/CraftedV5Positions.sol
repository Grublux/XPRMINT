// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ERC721} from "creator-token-standards/@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "creator-token-standards/@openzeppelin/contracts/token/common/ERC2981.sol";
import {ERC721CInitializable} from "creator-token-standards/erc721c/ERC721C.sol";
import {BasicRoyaltiesInitializable} from "creator-token-standards/programmable-royalties/BasicRoyalties.sol";

interface IMasterCrafterNpcPosition {
    function positionNpcIdView(uint256 posId) external view returns (uint256);
}

interface IMasterCrafterNpcCollection {
    function npcCollection() external view returns (address);
}

interface IERC721Minimal {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/**
 * @title CraftedV5Positions
 * @notice ERC721C positions implementation for Crafted V5 with NPC-owner royalties.
 * Uses UUPS pattern - deployed behind ERC1967Proxy.
 * Owner (EOA) can upgrade directly via proxy.upgradeTo(newImpl).
 * No ProxyAdmin needed.
 * 
 * V5 Changes:
 * - Royalties now go directly to the CURRENT owner of the NPC that crafted the position
 * - No dependency on RoyaltyRouter for ERC2981 royalties
 * - Preserves all existing CraftedV4Positions storage layout and behavior
 */
contract CraftedV5Positions is ERC721CInitializable, BasicRoyaltiesInitializable {
    using Strings for uint256;

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

    // ------------------------------------------------------------
    // ERC721 STATE
    // ------------------------------------------------------------

    address public masterCrafter;
    uint256 private _nextTokenId = 1;
    string private _baseTokenURI;

    // ------------------------------------------------------------
    // ROYALTY STATE
    // ------------------------------------------------------------

    address private _royaltyReceiver;  // Kept for backward compatibility, but not used in royaltyInfo
    uint96 private _royaltyBps;

    // ------------------------------------------------------------
    // V5: NPC ROYALTY STATE (APPEND-ONLY)
    // ------------------------------------------------------------
    // Note: npcCollection is read from MasterCrafter, no need to store separately

    // ------------------------------------------------------------
    // EVENTS
    // ------------------------------------------------------------

    event MasterCrafterSet(address indexed masterCrafter);
    event BaseURISet(string indexed baseURI);
    event RoyaltyReceiverSet(address indexed receiver);
    event RoyaltyBpsSet(uint96 bps);
    event RoyaltyRouterSet(address indexed router);
    event RoyaltyForwarded(uint256 indexed tokenId, uint256 amount, uint256 indexed npcId);

    // ------------------------------------------------------------
    // CONSTRUCTOR
    // ------------------------------------------------------------

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() ERC721("", "") {
        // ERC721OpenZeppelinBase (via ERC721CInitializable) requires ERC721 constructor
        // Name/symbol are set via initializeERC721() in initialize()
    }

    // ------------------------------------------------------------
    // INITIALIZER
    // ------------------------------------------------------------

    function initialize(
        string memory _name,
        string memory _symbol,
        string memory initialBaseURI,
        address initialOwner,
        address royaltyReceiver_,
        uint96 royaltyBps_
    ) external initializer {
        require(initialOwner != address(0), "ZERO_OWNER");
        require(royaltyReceiver_ != address(0), "BAD_RECIPIENT");
        require(royaltyBps_ <= 1000, "TOO_HIGH"); // Max 10%

        owner = initialOwner;
        _baseTokenURI = initialBaseURI;
        _royaltyReceiver = royaltyReceiver_;  // Stored but not used in V5 royaltyInfo
        _royaltyBps = royaltyBps_;
        _nextTokenId = 1; // Initialize to 1 (first token will be ID 1)

        // Initialize ERC721C
        initializeERC721(_name, _symbol);
        // Initialize BasicRoyalties (sets default royalty - but V5 overrides royaltyInfo)
        _setDefaultRoyalty(_royaltyReceiver, _royaltyBps);
    }

    // ------------------------------------------------------------
    // ADMIN SETTERS
    // ------------------------------------------------------------

    function setMasterCrafter(address _master) external onlyOwner {
        // Allow setting to address(0) for fallback behavior
        masterCrafter = _master;
        emit MasterCrafterSet(_master);
    }

    function setBaseURI(string memory newBase) external onlyOwner {
        _baseTokenURI = newBase;
        emit BaseURISet(newBase);
    }

    function setRoyaltyReceiver(address newReceiver) external onlyOwner {
        require(newReceiver != address(0), "BAD_RECIPIENT");
        _royaltyReceiver = newReceiver;
        _setDefaultRoyalty(newReceiver, _royaltyBps);
        emit RoyaltyReceiverSet(newReceiver);
    }

    function setRoyaltyBps(uint96 newBps) external onlyOwner {
        require(newBps <= 1000, "TOO_HIGH"); // Max 10%
        _royaltyBps = newBps;
        _setDefaultRoyalty(_royaltyReceiver, newBps);
        emit RoyaltyBpsSet(newBps);
    }

    function setRoyaltyRouter(address router) external onlyOwner {
        // Kept for backward compatibility, but not used in V5
        emit RoyaltyRouterSet(router);
    }

    // ------------------------------------------------------------
    // MINT / BURN
    // ------------------------------------------------------------

    function mintPosition(address to) external returns (uint256 tokenId) {
        require(msg.sender == masterCrafter, "OnlyMasterCrafter");
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
    }

    function burnPosition(uint256 tokenId) external {
        require(msg.sender == masterCrafter, "OnlyMasterCrafter");
        _burn(tokenId);
    }

    // ------------------------------------------------------------
    // VIEW FUNCTIONS
    // ------------------------------------------------------------

    /// @notice Returns all token IDs owned by `ownerAddr`
    /// @dev Safe, no storage changes, linear scan over totalSupply()
    function tokensOfOwner(address ownerAddr) external view returns (uint256[] memory) {
        uint256 supply = _nextTokenId; // _nextTokenId is the next ID to be minted, so tokens are 1..(_nextTokenId-1)
        uint256 count = balanceOf(ownerAddr);
        uint256[] memory result = new uint256[](count);

        uint256 idx;
        for (uint256 tokenId = 1; tokenId < supply; tokenId++) {
            if (_ownerOf(tokenId) == ownerAddr) {
                result[idx++] = tokenId;
                if (idx == count) break;
            }
        }
        return result;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "NonexistentToken");
        return string(abi.encodePacked(_baseTokenURI, tokenId.toString()));
    }

    // ------------------------------------------------------------
    // ROYALTY (ERC2981) - V5: NPC OWNER BASED
    // ------------------------------------------------------------

    /// @notice Returns royalty receiver and amount for a given token
    /// @dev V5: Returns the CURRENT owner of the NPC that crafted this position
    /// @param tokenId The position token ID
    /// @param salePrice The sale price to calculate royalty from
    /// @return receiver The current owner of the NPC that crafted this position
    /// @return royaltyAmount The royalty amount (salePrice * _royaltyBps / 10000)
    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        public
        view
        override
        returns (address receiver, uint256 royaltyAmount)
    {
        require(_ownerOf(tokenId) != address(0), "NonexistentToken");
        
        // If masterCrafter not set, fall back to old behavior
        if (masterCrafter == address(0)) {
            receiver = _royaltyReceiver;
            royaltyAmount = (salePrice * _royaltyBps) / 10_000;
            return (receiver, royaltyAmount);
        }

        // Get npcId for this position from MasterCrafter
        uint256 npcId = IMasterCrafterNpcPosition(masterCrafter).positionNpcIdView(tokenId);
        
        // If no NPC recorded (e.g., old positions crafted before NPC system), fall back
        if (npcId == 0) {
            receiver = _royaltyReceiver;
            royaltyAmount = (salePrice * _royaltyBps) / 10_000;
            return (receiver, royaltyAmount);
        }

        // Get NPC collection from MasterCrafter (it stores npcCollection)
        address npcColl = IMasterCrafterNpcCollection(masterCrafter).npcCollection();
        if (npcColl == address(0)) {
            // Fall back if not set
            receiver = _royaltyReceiver;
            royaltyAmount = (salePrice * _royaltyBps) / 10_000;
            return (receiver, royaltyAmount);
        }

        // Get current owner of the NPC
        receiver = IERC721Minimal(npcColl).ownerOf(npcId);
        
        // Calculate royalty amount using collection BPS
        royaltyAmount = (salePrice * _royaltyBps) / 10_000;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721CInitializable, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _requireCallerIsContractOwner() internal view override {
        require(msg.sender == owner, "NOT_OWNER");
    }

    // ------------------------------------------------------------
    // ROYALTY FORWARDING (kept for backward compatibility, but not used in V5)
    // ------------------------------------------------------------

    address public royaltyRouter; // Kept for backward compatibility

    /// @notice Forward a royalty payment to the RoyaltyRouter (legacy function, not used in V5)
    /// @dev Kept for backward compatibility but royalties now go directly to NPC owners
    function forwardRoyalty(uint256 tokenId, uint256 amount) external {
        // This function is kept for backward compatibility but does nothing in V5
        // Royalties are handled directly via ERC2981 royaltyInfo()
        emit RoyaltyForwarded(tokenId, amount, 0);
    }

    // ------------------------------------------------------------
    // UPGRADE FUNCTION (UUPS PATTERN - NO PROXYADMIN)
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

