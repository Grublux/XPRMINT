// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title MasterForgeV1Events
 * @notice Events and errors for the MasterForgeV1 contract.
 */
contract MasterForgeV1Events {
    // ============ Events ============

    event RecipeCreated(
        uint256 indexed recipeId,
        address indexed creator,
        uint8 itemClass
    );

    event RecipeUpdated(uint256 indexed recipeId);

    event ForgeNameUpdated(address indexed forge, string name);

    event Crafted(
        address indexed user,
        uint256 indexed positionId,
        uint256 indexed recipeId,
        uint256 inputAmount,
        uint64 unlockAt
    );

    event CraftedBatch(
        address indexed user,
        uint256 indexed recipeId,
        uint256[] positionIds,
        uint256 totalInputAmount
    );

    event Destroyed(
        address indexed user,
        uint256 indexed positionId,
        uint256 indexed recipeId,
        uint256 amountReturned,
        uint256 feeTaken
    );

    // ============ Errors ============

    error UnauthorizedUpgrader();
    error InvalidAdminAddress();
    error UpgraderZeroAddress();
    error InvalidRecipe();
    error RecipeNotActive();
    error BatchTooLarge();
    error LockNotExpired();
    error InvalidPosition();
    error UnauthorizedPositionOwner();
    error InvalidFeeConfig();
    error InvalidInputAmount();
    error InvalidForgeName();
    error UnsupportedRoyaltyCollection();
    error NotRoyaltySeatOwner();
}

