// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC2981Upgradeable} from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";

/**
 * @title NGMI721Upgradeable
 * @notice Minimal upgradeable ERC721 base with ERC2981 royalties
 * @dev This is a stub implementation for testing purposes
 */
abstract contract NGMI721Upgradeable is
    Initializable,
    ERC721Upgradeable,
    ERC2981Upgradeable,
    OwnableUpgradeable
{
    /// @dev Address authorized to upgrade the contract
    address internal _upgrader;

    error UnauthorizedUpgrader();

    modifier onlyOwnerOrUpgrader() {
        if (msg.sender != owner() && msg.sender != _upgrader) {
            revert UnauthorizedUpgrader();
        }
        _;
    }

    /**
     * @notice Initialize the NGMI721 contract
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param royaltyBps Default royalty basis points
     */
    function __NGMIERC721C_init(
        string memory name_,
        string memory symbol_,
        uint96 royaltyBps
    ) internal onlyInitializing {
        __ERC721_init(name_, symbol_);
        __Ownable_init(msg.sender);
        __ERC2981_init();
        
        // Set default royalty to contract owner
        _setDefaultRoyalty(msg.sender, royaltyBps);
        _upgrader = msg.sender;
    }

    /**
     * @notice Returns the total supply of tokens
     * @dev Must be overridden by implementing contract
     */
    function totalSupply() external view virtual returns (uint256);

    /**
     * @notice Set the upgrader address
     * @param newUpgrader New upgrader address
     */
    function setUpgrader(address newUpgrader) external onlyOwnerOrUpgrader {
        _upgrader = newUpgrader;
    }

    /**
     * @notice Get the current upgrader
     */
    function getUpgrader() external view returns (address) {
        return _upgrader;
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721Upgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

