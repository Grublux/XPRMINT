// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ItemCatalog} from "../../contracts/stabilization/items/ItemCatalog.sol";
import {ItemToken1155} from "../../contracts/stabilization/items/ItemToken1155.sol";
import {ItemGenerator} from "../../contracts/stabilization/items/ItemGenerator.sol";
import {ItemImageDeployer} from "../../contracts/stabilization/items/ItemImageDeployer.sol";
import {StabilizationTestHelper} from "../utils/StabilizationTestHelper.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title ItemExternalImageURI
 * @notice Tests for external image base URI functionality
 * @dev Verifies that metadata includes both marketplace-friendly URLs and on-chain data URIs
 */
contract ItemExternalImageURI is Test {
    using StabilizationTestHelper for *;
    
    ItemCatalog public catalog;
    ItemToken1155 public itemToken;
    address public owner;

    ItemImageDeployer public imageDeployer;

    function setUp() public {
        owner = address(this);

        // Deploy catalog and item token
        catalog = StabilizationTestHelper.deployItemCatalog();
        itemToken = StabilizationTestHelper.deployItemToken1155(catalog, "https://api.xprmint.com/items/{id}.json");

        // Deploy image deployer for test images
        imageDeployer = new ItemImageDeployer();

        // Seed test catalog
        StabilizationTestHelper.seedTestCatalog(catalog);

        // Deploy a minimal test PNG (1x1 red pixel) and set it for template 0
        bytes memory testPng = hex"89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8ffff3f0005fe02fe0d0c5c0000000049454e44ae426082";
        address imagePtr = imageDeployer.deployImage(testPng);
        catalog.updateTemplateImage(0, imagePtr);
    }

    /**
     * @notice Helper to decode base64 JSON from token URI
     */
    function _decodeTokenURI(string memory uri) internal pure returns (string memory) {
        // Remove "data:application/json;base64," prefix
        bytes memory uriBytes = bytes(uri);
        require(uriBytes.length > 29, "Invalid URI format");
        
        // Find the comma after "base64,"
        uint256 prefixLen = 29; // "data:application/json;base64,".length
        bytes memory b64Bytes = new bytes(uriBytes.length - prefixLen);
        for (uint256 i = 0; i < b64Bytes.length; i++) {
            b64Bytes[i] = uriBytes[i + prefixLen];
        }
        
        return string(Base64.decode(string(b64Bytes)));
    }

    /**
     * @notice Test default behavior when externalImageBaseURI is not set
     */
    function test_DefaultBehavior_NoBaseURISet() public view {
        // Call uri(0) and decode
        string memory uri = itemToken.uri(0);
        string memory json = _decodeTokenURI(uri);
        
        // Assert that both image and image_data exist and are equal (both are data URIs)
        bytes memory jsonBytes = bytes(json);
        
        // Check for image_data field
        require(
            _contains(jsonBytes, bytes('"image_data":"data:image/png;base64,')),
            "Missing image_data field"
        );
        
        // Check for image field (should also be data URI when base URI not set)
        require(
            _contains(jsonBytes, bytes('"image":"data:image/png;base64,')),
            "Missing image field"
        );
        
        // When externalImageBaseURI is empty, image should equal image_data
        // (both are the on-chain data URI)
        // We verify this by checking both fields exist and are data URIs
    }

    /**
     * @notice Test behavior when externalImageBaseURI is set
     */
    function test_WithBaseURISet() public {
        // Set external image base URI
        itemToken.setExternalImageBaseURI("https://example.com/items_full/");
        
        // Call uri(0) and decode
        string memory uri = itemToken.uri(0);
        string memory json = _decodeTokenURI(uri);
        bytes memory jsonBytes = bytes(json);
        
        // Assert that image is now an HTTP URL
        string memory expectedImage = "https://example.com/items_full/0.png";
        require(
            _contains(jsonBytes, bytes(expectedImage)),
            "Image field should be HTTP URL when base URI is set"
        );
        
        // Assert that image_data still exists and is a data URI
        require(
            _contains(jsonBytes, bytes('"image_data":"data:image/png;base64,')),
            "image_data should still be a data URI"
        );
        
        // Verify image and image_data are different
        require(
            !_contains(jsonBytes, bytes('"image":"data:image/png;base64,')),
            "Image should not be data URI when base URI is set"
        );
    }

    /**
     * @notice Test that setExternalImageBaseURI is owner-only
     */
    function test_NonOwnerCannotSetBaseURI() public {
        address nonOwner = address(0x1234);
        
        vm.prank(nonOwner);
        vm.expectRevert();
        itemToken.setExternalImageBaseURI("https://malicious.com/");
    }

    /**
     * @notice Test that externalImageBaseURI can be read publicly
     */
    function test_ExternalImageBaseURIIsPublic() public view {
        // Initially empty
        string memory baseURI = itemToken.externalImageBaseURI();
        require(bytes(baseURI).length == 0, "Base URI should be empty initially");
    }

    /**
     * @notice Test backward compatibility: empty base URI falls back to data URI
     */
    function test_BackwardCompatibility_EmptyBaseURI() public view {
        // Ensure base URI is empty (default state)
        string memory baseURI = itemToken.externalImageBaseURI();
        require(bytes(baseURI).length == 0, "Base URI should be empty");
        
        // Call uri(0)
        string memory uri = itemToken.uri(0);
        string memory json = _decodeTokenURI(uri);
        bytes memory jsonBytes = bytes(json);
        
        // Image should be a data URI (backward compatible)
        require(
            _contains(jsonBytes, bytes('"image":"data:image/png;base64,')),
            "Image should be data URI when base URI is empty (backward compatible)"
        );
    }

    /**
     * @notice Helper to check if bytes array contains a substring
     */
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

