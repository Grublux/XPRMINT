// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ItemCatalog} from "../contracts/stabilization/items/ItemCatalog.sol";
import {ItemImageDeployer} from "../contracts/stabilization/items/ItemImageDeployer.sol";

/**
 * @title UploadItemImages
 * @notice Script to upload PNGs via SSTORE2 and update ItemCatalog imagePtr per template
 * @dev Reads catalog.json, uploads images, and updates only the imagePtr field
 * 
 * IMPORTANT: This script is meant for v1 and must be run AFTER:
 *  1. v1 catalog is seeded (DeployItemCatalogV1.s.sol)
 *  2. v1 implementations are deployed (DeployStabilizationSystemV1.s.sol)
 * 
 * Set ITEM_CATALOG_PROXY_V1 and ITEM_IMAGE_DEPLOYER_V1 to target v1.
 * Do NOT reference or mutate v0 catalog or v0 image pointers.
 */
contract UploadItemImages is Script {
    struct CatalogEntry {
        uint256 id;
        string image_key;
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        console2.log("Deployer:", deployer);

        // Get contract addresses from env - support both v0 and v1
        // v1 takes precedence if both are set
        address catalogProxy = vm.envOr("ITEM_CATALOG_PROXY_V1", vm.envOr("ITEM_CATALOG_PROXY", vm.envOr("STAB_ITEM_CATALOG", address(0))));
        // Check for V1_2 first (fixed deployer), then V1, then V0
        address imageDeployerAddr = vm.envOr("ITEM_IMAGE_DEPLOYER_V1_2", vm.envOr("ITEM_IMAGE_DEPLOYER_V1", vm.envOr("ITEM_IMAGE_DEPLOYER", address(0))));
        
        // Get image directory - try env var, fallback to default
        string memory imageDir;
        try vm.envString("ITEM_IMAGE_DIR") returns (string memory dir) {
            imageDir = dir;
        } catch {
            imageDir = "assets/items";
        }
        
        require(catalogProxy != address(0), "ITEM_CATALOG_PROXY_V1 or ITEM_CATALOG_PROXY not set");
        require(imageDeployerAddr != address(0), "ITEM_IMAGE_DEPLOYER_V1 or ITEM_IMAGE_DEPLOYER not set");
        
        console2.log("Catalog proxy:", catalogProxy);
        console2.log("Image deployer:", imageDeployerAddr);
        console2.log("Image directory:", imageDir);
        
        // Log which version we're targeting
        if (vm.envOr("ITEM_CATALOG_PROXY_V1", address(0)) != address(0)) {
            console2.log("Targeting V1 catalog");
        } else {
            console2.log("Targeting V0 catalog (legacy)");
        }

        ItemCatalog catalog = ItemCatalog(catalogProxy);
        ItemImageDeployer imageDeployer = ItemImageDeployer(imageDeployerAddr);

        // Read catalog.json
        string memory catalogJson = vm.readFile("docs/stabilization_script/sim/items/output/catalog.json");
        
        // Count entries
        uint256 entryCount = _countCatalogEntries(catalogJson);
        console2.log("Total entries:", entryCount);

        vm.startBroadcast(deployerPrivateKey);

        // Process images one at a time to avoid memory limits
        uint256 successCount = 0;
        
        for (uint256 i = 0; i < entryCount; i++) {
            try this._uploadImageForTemplate(catalogJson, i, catalog, imageDeployer, imageDir) returns (address imagePtr) {
                if (imagePtr != address(0)) {
                    // Update catalog in broadcast context (msg.sender = deployer)
                    catalog.updateTemplateImage(i, imagePtr);
                    console2.log("Updated template", i, "imagePtr to", imagePtr);
                    successCount++;
                    if (i % 10 == 0 || i == entryCount - 1) {
                        console2.log("Processed", i + 1, "/", entryCount);
                    }
                } else {
                    console2.log("Skipped template", i, "(no image key or file not found)");
                }
            } catch Error(string memory reason) {
                console2.log("Failed template", i, ":", reason);
            } catch (bytes memory lowLevelData) {
                console2.log("Failed template", i, "(low-level error)");
                if (lowLevelData.length > 0) {
                    console2.log("Error data (hex):", vm.toString(lowLevelData));
                }
            }
        }

        vm.stopBroadcast();

        console2.log("Successfully uploaded images for", successCount, "templates");
    }

    /**
     * @notice Upload image for a single template
     * @dev External function to allow try-catch
     */
    function _uploadImageForTemplate(
        string memory catalogJson,
        uint256 index,
        ItemCatalog catalog,
        ItemImageDeployer imageDeployer,
        string memory imageDir
    ) external returns (address imagePtr) {
        CatalogEntry memory entry = _parseSingleEntry(catalogJson, index);
        
        if (bytes(entry.image_key).length == 0) {
            return address(0); // No image key
        }

        // Build file path: imageDir/image_key.png
        string memory imagePath = string(
            abi.encodePacked(imageDir, "/", entry.image_key, ".png")
        );
        
        // Read image file
        bytes memory imageBytes = vm.readFileBinary(imagePath);
        if (imageBytes.length == 0) {
            console2.log("Image file not found for", entry.image_key, "at", imagePath);
            return address(0);
        }

        // Deploy image to SSTORE2
        imagePtr = imageDeployer.deployImage(imageBytes);
        console2.log("Uploaded %s -> %s (template %s)", imagePath, imagePtr, entry.id);

        // Return imagePtr - update will be done in broadcast context
        return imagePtr;
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

