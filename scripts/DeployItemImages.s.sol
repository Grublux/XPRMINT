// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ItemCatalog} from "../contracts/stabilization/items/ItemCatalog.sol";
import {ItemImageDeployer} from "../contracts/stabilization/items/ItemImageDeployer.sol";

/**
 * @title DeployItemImages
 * @notice Script to deploy images to SSTORE2 and update catalog templates
 */
contract DeployItemImages is Script {
    struct CatalogEntry {
        uint256 id;
        string image_key;
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deployer:", deployer);

        // Get contract addresses
        address catalogProxy = vm.envAddress("ITEM_CATALOG_PROXY");
        address imageDeployerAddr = vm.envAddress("ITEM_IMAGE_DEPLOYER");
        
        console.log("Catalog proxy:", catalogProxy);
        console.log("Image deployer:", imageDeployerAddr);

        ItemCatalog catalog = ItemCatalog(catalogProxy);
        ItemImageDeployer imageDeployer = ItemImageDeployer(imageDeployerAddr);

        // Read catalog.json
        string memory catalogJson = vm.readFile("docs/stabilization_script/sim/items/output/catalog.json");
        
        // Count entries
        uint256 entryCount = _countCatalogEntries(catalogJson);
        console.log("Total entries:", entryCount);

        vm.startBroadcast(deployerPrivateKey);

        // Process images one at a time to avoid memory limits
        uint256 successCount = 0;
        
        for (uint256 i = 0; i < entryCount; i++) {
            try this._deployImageForTemplate(catalogJson, i, catalog, imageDeployer) returns (bool success) {
                if (success) {
                    successCount++;
                    if (i % 10 == 0 || i == entryCount - 1) {
                        console.log("Processed", i + 1, "/", entryCount);
                    }
                }
            } catch {
                console.log("Failed to deploy image for template", i);
            }
        }

        vm.stopBroadcast();

        console.log("Successfully deployed images for", successCount, "templates");
    }

    /**
     * @notice Deploy image for a single template
     * @dev External function to allow try-catch
     */
    function _deployImageForTemplate(
        string memory catalogJson,
        uint256 index,
        ItemCatalog catalog,
        ItemImageDeployer imageDeployer
    ) external returns (bool) {
        CatalogEntry memory entry = _parseSingleEntry(catalogJson, index);
        
        if (bytes(entry.image_key).length == 0) {
            return false; // No image key
        }

        // Read image file
        string memory imagePath = string(
            abi.encodePacked("assets/items/", entry.image_key, ".png")
        );
        
        bytes memory imageBytes = vm.readFileBinary(imagePath);
        if (imageBytes.length == 0) {
            console.log("Image file not found for", entry.image_key);
            return false;
        }

        // Deploy image to SSTORE2
        address imagePtr = imageDeployer.deployImage(imageBytes);
        console.log("Deployed image for template", entry.id, "at:", imagePtr);

        // Update catalog template
        catalog.updateTemplateImage(entry.id, imagePtr);

        return true;
    }

    /**
     * @notice Count entries in catalog JSON
     */
    function _countCatalogEntries(string memory json) internal returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < 1000; i++) {
            string memory idKey = string(
                abi.encodePacked("$[", vm.toString(i), "].id")
            );
            try vm.parseJsonUint(json, idKey) returns (uint256) {
                count++;
            } catch {
                break;
            }
        }
        require(count > 0, "No entries in catalog JSON");
        return count;
    }

    /**
     * @notice Parse a single entry from catalog JSON
     */
    function _parseSingleEntry(string memory json, uint256 index) internal returns (CatalogEntry memory entry) {
        string memory baseKey = string(abi.encodePacked("$[", vm.toString(index), "]"));
        
        entry.id = vm.parseJsonUint(json, string(abi.encodePacked(baseKey, ".id")));
        entry.image_key = vm.parseJsonString(json, string(abi.encodePacked(baseKey, ".image_key")));
    }
}

