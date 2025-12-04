// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {NGMI721Upgradeable} from "../nft-base-upgradeable/NGMI721Upgradeable.sol";

/**
 * @title ForgePosition721
 * @notice ERC721 token representing individual MasterForge positions (coins / relics / artifacts).
 * @dev Minting and burning is restricted to the MasterForgeV1 contract.
 */
interface IMasterForgeTokenURI {
    function positionTokenURI(uint256 positionId) external view returns (string memory);
}

contract ForgePosition721 is NGMI721Upgradeable {
    /// @notice Address of the MasterForgeV1 contract authorized to mint and burn positions.
    address public masterForge;

    /// @notice Counter for token ids.
    uint256 private _nextTokenId;

    /// @notice Total supply of position tokens.
    uint256 private _totalSupply;

    // Local errors specific to this contract.
    error InvalidMasterForgeAddress();
    error UnauthorizedMasterForge();
    error UnauthorizedPositionOwner();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the ForgePosition721 contract.
     * @param name_ Token name.
     * @param symbol_ Token symbol.
     * @param royaltyBps Default royalty basis points (applied to this contract itself).
     * @param masterForge_ Initial MasterForgeV1 address.
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        uint96 royaltyBps,
        address masterForge_
    ) external initializer {
        __NGMIERC721C_init(name_, symbol_, royaltyBps);
        if (masterForge_ == address(0)) revert InvalidMasterForgeAddress();
        masterForge = masterForge_;
    }

    // ============ Modifiers ============

    modifier onlyMasterForge() {
        if (msg.sender != masterForge) revert UnauthorizedMasterForge();
        _;
    }

    // ============ ERC721C required overrides ============

    /**
     * @notice Returns the total supply of position tokens.
     */
    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @notice Get tokenURI for a position, delegating to MasterForge.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        return IMasterForgeTokenURI(masterForge).positionTokenURI(tokenId);
    }

    // ============ Admin ============

    /**
     * @notice Update the master forge address.
     * @dev Restricted to owner or upgrader via NGMI721Upgradeable.
     */
    function setMasterForge(address newMasterForge) external onlyOwnerOrUpgrader {
        if (newMasterForge == address(0)) revert InvalidMasterForgeAddress();
        masterForge = newMasterForge;
    }

    // ============ Mint / burn API for MasterForgeV1 ============

    /**
     * @notice Mint a new position token to `to`.
     * @dev Only callable by MasterForgeV1.
     */
    function mintPosition(address to) external onlyMasterForge returns (uint256 tokenId) {
        tokenId = ++_nextTokenId;
        _totalSupply += 1;
        _safeMint(to, tokenId);
    }

    /**
     * @notice Burn an existing position token.
     * @dev Only callable by MasterForgeV1.
     */
    function burnPosition(address from, uint256 tokenId) external onlyMasterForge {
        // Optional safety: enforce that `from` is current owner.
        if (ownerOf(tokenId) != from) {
            revert UnauthorizedPositionOwner();
        }
        _totalSupply -= 1;
        _burn(tokenId);
    }
}
