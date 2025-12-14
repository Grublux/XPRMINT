// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ICraftedV1Positions
 * @notice Minimal interface stub for compilation/verification only.
 *         Defines functions required by MasterCrafterV5.
 */
interface ICraftedV1Positions {
    function mintPosition(address to) external returns (uint256);
    function burnPosition(uint256 posId) external;
}

