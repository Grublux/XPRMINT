// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MasterCrafterV1Events
 * @notice Events and errors for MasterCrafterV1.
 */
contract MasterCrafterV1Events {
    event RecipeCreated(uint256 indexed recipeId, address indexed creator, uint8 itemClass);
    event RecipeUpdated(uint256 indexed recipeId);
    event CraftNameUpdated(address indexed craft, string name);
    event Crafted(address indexed user, uint256 indexed positionId, uint256 indexed recipeId, uint256 inputAmountLocked, uint64 unlockAt);
    event CraftedBatch(address indexed user, uint256 indexed recipeId, uint256[] positionIds, uint256 totalInputAmountLocked, uint64 unlockAt);
    event Destroyed(address indexed user, uint256 indexed positionId, uint256 indexed recipeId, uint256 amountReturned, uint256 feeTaken);

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
    error InvalidCraftName();
    error UnsupportedRoyaltyCollection();
    error NotRoyaltySeatOwner();
}

