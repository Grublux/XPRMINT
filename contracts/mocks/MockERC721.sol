// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockERC721
 * @notice Minimal ERC721 mock for testing purposes
 */
contract MockERC721 is ERC721, Ownable {
    constructor(
        string memory name_,
        string memory symbol_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {}

    /**
     * @notice Mint a token to an address
     * @param to Recipient address
     * @param tokenId Token ID to mint
     */
    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }

    /**
     * @notice Burn a token
     * @param tokenId Token ID to burn
     */
    function burn(uint256 tokenId) external {
        _burn(tokenId);
    }
}

