// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title VerifyExternalImageURI
 * @notice Verify that external image base URI is configured correctly and metadata includes both image fields
 * @dev This script reads on-chain data and verifies the upgrade was successful
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export ITEM_TOKEN_PROXY_V1=0x9c4216d7b56a25b4b8a8eddefebaba389e05a01e
 * 
 *   forge script scripts/VerifyExternalImageURI.s.sol --rpc-url $RPC
 */
contract VerifyExternalImageURI is Script {
    function run() external {
        address itemTokenProxy = vm.envAddress("ITEM_TOKEN_PROXY_V1");
        
        console2.log("=== Verify External Image URI Configuration ===");
        console2.log("ItemToken1155 Proxy:", itemTokenProxy);
        console2.log("");

        ItemToken1155 itemToken = ItemToken1155(itemTokenProxy);

        // Check if externalImageBaseURI is set
        string memory baseURI = itemToken.externalImageBaseURI();
        console2.log("External Image Base URI:", baseURI);
        
        if (bytes(baseURI).length == 0) {
            console2.log("⚠️  Base URI is not set (will use data URIs only)");
        } else {
            console2.log("✅ Base URI is configured");
        }
        console2.log("");

        // Fetch and decode metadata for item 0
        console2.log("=== Sample Metadata (Item 0) ===");
        string memory uri = itemToken.uri(0);
        
        // Decode base64 JSON
        bytes memory uriBytes = bytes(uri);
        require(uriBytes.length > 29, "Invalid URI format");
        
        // Extract base64 part
        bytes memory b64Bytes = new bytes(uriBytes.length - 29);
        for (uint256 i = 0; i < b64Bytes.length; i++) {
            b64Bytes[i] = uriBytes[i + 29];
        }
        
        bytes memory jsonBytes = Base64.decode(string(b64Bytes));
        string memory json = string(jsonBytes);
        
        console2.log("Metadata JSON:");
        console2.log(json);
        console2.log("");

        // Check for image fields
        bytes memory jsonBytesCheck = bytes(json);
        bool hasImage = _contains(jsonBytesCheck, bytes('"image":'));
        bool hasImageData = _contains(jsonBytesCheck, bytes('"image_data":'));
        
        console2.log("=== Verification Results ===");
        if (hasImage) {
            console2.log("✅ 'image' field present");
        } else {
            console2.log("❌ 'image' field missing");
        }
        
        if (hasImageData) {
            console2.log("✅ 'image_data' field present");
        } else {
            console2.log("❌ 'image_data' field missing");
        }
        console2.log("");

        // Check if image is HTTP URL or data URI
        if (bytes(baseURI).length > 0) {
            string memory expectedPrefix = string(abi.encodePacked(baseURI, "0.png"));
            if (_contains(jsonBytesCheck, bytes(expectedPrefix))) {
                console2.log("✅ Image field uses HTTP URL (marketplace-friendly)");
            } else if (_contains(jsonBytesCheck, bytes('"image":"data:image/png;base64,'))) {
                console2.log("⚠️  Image field is still data URI (base URI may not be working)");
            }
        } else {
            if (_contains(jsonBytesCheck, bytes('"image":"data:image/png;base64,'))) {
                console2.log("✅ Image field is data URI (backward compatible - base URI not set)");
            }
        }

        if (_contains(jsonBytesCheck, bytes('"image_data":"data:image/png;base64,'))) {
            console2.log("✅ Image_data field is on-chain data URI (for purists)");
        }
    }

    function _contains(bytes memory data, bytes memory pattern) internal pure returns (bool) {
        if (pattern.length > data.length) return false;
        
        for (uint256 i = 0; i <= data.length - pattern.length; i++) {
            bool _match = true;
            for (uint256 j = 0; j < pattern.length; j++) {
                if (data[i + j] != pattern[j]) {
                    _match = false;
                    break;
                }
            }
            if (_match) return true;
        }
        return false;
    }
}




