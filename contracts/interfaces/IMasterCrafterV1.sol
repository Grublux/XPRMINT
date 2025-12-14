// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IMasterCrafterV1
 * @notice Minimal interface stub for compilation/verification only.
 *         Defines structs and functions required by MasterCrafterV5.
 */
interface IMasterCrafterV1 {
    struct Recipe {
        bool active;
        uint256 inputPerUnit;
        uint256 coalPerUnit;
        uint256 lockDuration;
    }

    struct Position {
        uint256 recipeId;
        uint256 inputAmountLocked;
        uint64 createdAt;
        uint64 unlockAt;
        address owner;
    }

    function getRecipe(uint256 id) external view returns (Recipe memory);
    function getPosition(uint256 id) external view returns (Position memory);
    function positionTokenURI(uint256 id) external view returns (string memory);
    function royaltyReceiverForPosition(uint256 posId) external view returns (address);
}

