// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockERC1155
 * @notice Minimal ERC1155 mock for testing purposes
 */
contract MockERC1155 is ERC1155, Ownable {
    constructor(string memory uri_) ERC1155(uri_) Ownable(msg.sender) {}

    /**
     * @notice Mint tokens to an address
     * @param to Recipient address
     * @param id Token ID
     * @param amount Amount to mint
     * @param data Additional data
     */
    function mint(
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) external {
        _mint(to, id, amount, data);
    }

    /**
     * @notice Mint batch of tokens to an address
     * @param to Recipient address
     * @param ids Token IDs
     * @param amounts Amounts to mint
     * @param data Additional data
     */
    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) external {
        _mintBatch(to, ids, amounts, data);
    }

    /**
     * @notice Burn tokens from an address
     * @param from Address to burn from
     * @param id Token ID
     * @param amount Amount to burn
     */
    function burn(address from, uint256 id, uint256 amount) external {
        _burn(from, id, amount);
    }
}

