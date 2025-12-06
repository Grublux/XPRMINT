// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMasterCrafterV1 {
    function positionTokenURI(uint256 positionId) external view returns (string memory);

    function royaltyReceiverForPosition(uint256 positionId) external view returns (address);

    // Optional: expose NPC seat mapping if needed later
    // function npcSeatForPosition(uint256 positionId) external view returns (address collection, uint256 tokenId);
}

