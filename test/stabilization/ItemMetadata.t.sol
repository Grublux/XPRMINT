// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ItemCatalog} from "../../contracts/stabilization/items/ItemCatalog.sol";
import {ItemToken1155} from "../../contracts/stabilization/items/ItemToken1155.sol";
import {ItemGenerator} from "../../contracts/stabilization/items/ItemGenerator.sol";
import {StabilizationTestHelper} from "../utils/StabilizationTestHelper.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title ItemMetadata
 * @notice Tests for item metadata behavior: name, description, collection title, and metadata updates
 * @dev These tests focus on metadata only; no gameplay mechanics are tested
 */
contract ItemMetadata is Test {
    using StabilizationTestHelper for *;
    
    ItemCatalog public catalog;
    ItemToken1155 public itemToken;
    address public owner;
    address public nonOwner;

    function setUp() public {
        owner = address(this);
        nonOwner = address(0x1234);

        // Deploy catalog and item token
        catalog = StabilizationTestHelper.deployItemCatalog();
        itemToken = StabilizationTestHelper.deployItemToken1155(catalog, "https://api.xprmint.com/items/{id}.json");

        // Seed test catalog
        StabilizationTestHelper.seedTestCatalog(catalog);
    }

    /**
     * @notice Test that collection name and symbol are set correctly with V1 defaults
     */
    function test_CollectionNameAndSymbol() public view {
        string memory name = itemToken.name();
        string memory symbol = itemToken.symbol();

        // Check V1 defaults are set
        assertEq(keccak256(bytes(name)), keccak256(bytes("Stabilization Items V1")), "Default name incorrect");
        assertEq(keccak256(bytes(symbol)), keccak256(bytes("ITEMS")), "Default symbol incorrect");
    }

    /**
     * @notice Test that contractURI includes V1 collection metadata
     */
    function test_ContractURIContainsV1Metadata() public view {
        string memory uri = itemToken.contractURI();
        
        // Should start with data URI prefix
        assertTrue(bytes(uri).length > 0, "Contract URI should not be empty");
        assertTrue(
            keccak256(bytes(substring(uri, 0, 29))) == keccak256(bytes("data:application/json;base64,")),
            "Contract URI should be base64 data URI"
        );
        
        // Decode and check content
        bytes memory uriBytes = bytes(uri);
        string memory base64Part = substring(uri, 29, uriBytes.length);
        bytes memory jsonBytes = Base64.decode(base64Part);
        string memory json = string(jsonBytes);
        
        // Check that JSON contains V1 collection name and description
        assertTrue(contains(json, "Stabilization Items V1"), "Contract URI missing V1 collection name");
        assertTrue(contains(json, "On-chain tools, artifacts, and anomalies"), "Contract URI missing V1 description");
    }

    /**
     * @notice Test that owner can update collection name and symbol
     */
    function test_UpdateCollectionNameAndSymbol() public {
        itemToken.setName("New Collection Name");
        itemToken.setSymbol("NEW-SYMBOL");

        assertEq(keccak256(bytes(itemToken.name())), keccak256(bytes("New Collection Name")), "Name not updated");
        assertEq(keccak256(bytes(itemToken.symbol())), keccak256(bytes("NEW-SYMBOL")), "Symbol not updated");
    }

    /**
     * @notice Test that non-owner cannot update collection name
     */
    function test_NonOwnerCannotUpdateCollectionName() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        itemToken.setName("Hacked Name");
    }


    /**
     * @notice Test that token URI includes name and description
     */
    function test_TokenURIIncludesNameAndDescription() public view {
        // Get URI for template 0 (Common item)
        string memory uri = itemToken.uri(0);
        
        // Decode base64
        bytes memory uriBytes = bytes(uri);
        require(uriBytes.length > 29, "URI too short");
        
        // Extract base64 part (after "data:application/json;base64,")
        string memory base64Part = substring(uri, 29, uriBytes.length);
        bytes memory jsonBytes = Base64.decode(base64Part);
        string memory json = string(jsonBytes);
        
        // Check that JSON contains name and description fields
        assertTrue(contains(json, '"name"'), "URI JSON missing 'name' field");
        assertTrue(contains(json, '"description"'), "URI JSON missing 'description' field");
        assertTrue(contains(json, "Test Common Item"), "URI JSON missing item name");
        assertTrue(contains(json, "A common test item"), "URI JSON missing item description");
    }

    /**
     * @notice Test that token URI collection label is set to V3
     */
    function test_TokenURI_CollectionLabel_V3() public view {
        // Get URI for template 0
        string memory uri = itemToken.uri(0);
        
        // Decode base64
        bytes memory uriBytes = bytes(uri);
        require(uriBytes.length > 29, "URI too short");
        
        // Extract base64 part (after "data:application/json;base64,")
        string memory base64Part = substring(uri, 29, uriBytes.length);
        bytes memory jsonBytes = Base64.decode(base64Part);
        string memory json = string(jsonBytes);
        
        // Check that collection field is set to V3
        assertTrue(contains(json, '"collection":"Stabilization Items V3"'), "URI JSON missing V3 collection label");
        
        // Verify other required fields are still present
        assertTrue(contains(json, '"name"'), "URI JSON missing 'name' field");
        assertTrue(contains(json, '"description"'), "URI JSON missing 'description' field");
        // Note: image/image_data may not be present if template.imagePtr is not set in test environment
        // This is acceptable for test environment; production will have images
    }

    /**
     * @notice Test that updateTemplateMetadata updates name and description
     */
    function test_UpdateTemplateMetadata() public {
        uint256 templateId = 0;
        string memory newName = "Updated Common Item";
        string memory newDescription = "An updated common test item";

        // Update metadata
        catalog.updateTemplateMetadata(templateId, newName, newDescription);

        // Verify template was updated
        ItemCatalog.ItemTemplate memory template = catalog.getTemplate(templateId);
        assertEq(keccak256(bytes(template.name)), keccak256(bytes(newName)), "Name not updated");
        assertEq(keccak256(bytes(template.description)), keccak256(bytes(newDescription)), "Description not updated");

        // Verify URI reflects the update
        string memory uri = itemToken.uri(templateId);
        bytes memory uriBytes = bytes(uri);
        string memory base64Part = substring(uri, 29, uriBytes.length);
        bytes memory jsonBytes = Base64.decode(base64Part);
        string memory json = string(jsonBytes);

        assertTrue(contains(json, newName), "URI JSON missing updated name");
        assertTrue(contains(json, newDescription), "URI JSON missing updated description");
    }

    /**
     * @notice Test that updateTemplateName updates only name
     */
    function test_UpdateTemplateName() public {
        uint256 templateId = 0;
        string memory originalDescription = "A common test item";
        string memory newName = "Renamed Item";

        catalog.updateTemplateName(templateId, newName);

        ItemCatalog.ItemTemplate memory template = catalog.getTemplate(templateId);
        assertEq(keccak256(bytes(template.name)), keccak256(bytes(newName)), "Name not updated");
        assertEq(keccak256(bytes(template.description)), keccak256(bytes(originalDescription)), "Description should be unchanged");
    }

    /**
     * @notice Test that updateTemplateDescription updates only description
     */
    function test_UpdateTemplateDescription() public {
        uint256 templateId = 0;
        string memory originalName = "Test Common Item";
        string memory newDescription = "Updated description only";

        catalog.updateTemplateDescription(templateId, newDescription);

        ItemCatalog.ItemTemplate memory template = catalog.getTemplate(templateId);
        assertEq(keccak256(bytes(template.name)), keccak256(bytes(originalName)), "Name should be unchanged");
        assertEq(keccak256(bytes(template.description)), keccak256(bytes(newDescription)), "Description not updated");
    }

    /**
     * @notice Test that non-owner cannot update template metadata
     */
    function test_NonOwnerCannotUpdateTemplateMetadata() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        catalog.updateTemplateMetadata(0, "Hacked Name", "Hacked Description");
    }

    /**
     * @notice Test that updateTemplateMetadata does not affect gameplay fields
     */
    function test_UpdateMetadataDoesNotAffectGameplay() public {
        uint256 templateId = 0;
        
        // Get original template
        ItemCatalog.ItemTemplate memory original = catalog.getTemplate(templateId);
        uint8 originalRarity = original.rarity;
        uint8 originalPrimaryTrait = original.primaryTrait;
        int16 originalPrimaryDelta = original.primaryDelta;
        uint8 originalSecondaryTrait = original.secondaryTrait;
        int16 originalSecondaryDelta = original.secondaryDelta;

        // Update metadata
        catalog.updateTemplateMetadata(templateId, "New Name", "New Description");

        // Verify gameplay fields unchanged
        ItemCatalog.ItemTemplate memory updated = catalog.getTemplate(templateId);
        assertEq(updated.rarity, originalRarity, "Rarity should not change");
        assertEq(updated.primaryTrait, originalPrimaryTrait, "Primary trait should not change");
        assertEq(updated.primaryDelta, originalPrimaryDelta, "Primary delta should not change");
        assertEq(updated.secondaryTrait, originalSecondaryTrait, "Secondary trait should not change");
        assertEq(updated.secondaryDelta, originalSecondaryDelta, "Secondary delta should not change");
    }

    /**
     * @notice Test that updateTemplateMetadata reverts for invalid template ID
     */
    function test_UpdateMetadataRevertsForInvalidId() public {
        uint256 invalidId = 9999;
        vm.expectRevert("ItemCatalog: invalid templateId");
        catalog.updateTemplateMetadata(invalidId, "Name", "Description");
    }

    /**
     * @notice Test that all templates have name and description in URI
     */
    function test_AllTemplatesHaveNameAndDescription() public view {
        uint256 templateCount = catalog.templateCount();
        
        for (uint256 i = 0; i < templateCount; i++) {
            string memory uri = itemToken.uri(i);
            bytes memory uriBytes = bytes(uri);
            string memory base64Part = substring(uri, 29, uriBytes.length);
            bytes memory jsonBytes = Base64.decode(base64Part);
            string memory json = string(jsonBytes);

            assertTrue(contains(json, '"name"'), string(abi.encodePacked("Template ", vm.toString(i), " missing name")));
            assertTrue(contains(json, '"description"'), string(abi.encodePacked("Template ", vm.toString(i), " missing description")));
        }
    }

    // Helper functions
    function contains(string memory str, string memory substr) internal pure returns (bool) {
        bytes memory strBytes = bytes(str);
        bytes memory substrBytes = bytes(substr);
        
        if (substrBytes.length > strBytes.length) return false;
        if (substrBytes.length == 0) return true;
        
        for (uint256 i = 0; i <= strBytes.length - substrBytes.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < substrBytes.length; j++) {
                if (strBytes[i + j] != substrBytes[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        return false;
    }

    function substring(string memory str, uint256 start, uint256 end) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(end - start);
        for (uint256 i = start; i < end; i++) {
            result[i - start] = strBytes[i];
        }
        return string(result);
    }
}

