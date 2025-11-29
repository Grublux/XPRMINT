// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IGoobs
 * @notice Minimal ERC-721 interface for Goobs ownership verification
 */
interface IGoobs {
    function ownerOf(uint256 tokenId) external view returns (address);
}



