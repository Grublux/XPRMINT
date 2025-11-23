// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ItemCatalog} from "../contracts/stabilization/items/ItemCatalog.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";

/**
 * @title DeployItemCatalogV1
 * @notice Seed the v1 ItemCatalog proxy with templates from catalog.json
 * @dev Reads catalog.json and calls addTemplate/addTemplatesBatch for v1 catalog only
 */
contract DeployItemCatalogV1 is Script {
    struct CatalogEntry {
        uint256 id;
        string name;
        uint8 rarity;
        uint8 primary_trait;
        int16 primary_delta;
        uint8 secondary_trait;
        int16 secondary_delta;
        string image_key;
        string description;
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        console2.log("Deployer:", deployer);

        // Read v1 addresses from env
        address catalogProxyV1 = vm.envAddress("ITEM_CATALOG_PROXY_V1");
        address itemTokenProxyV1 = vm.envOr("ITEM_TOKEN_PROXY_V1", address(0));
        address adminRecipientV1 = vm.envOr("ITEM_ADMIN_RECIPIENT_V1", deployer);
        
        console2.log("ItemCatalogProxyV1:", catalogProxyV1);
        if (itemTokenProxyV1 != address(0)) {
            console2.log("ItemTokenProxyV1:", itemTokenProxyV1);
            console2.log("Admin recipient:", adminRecipientV1);
        }

        ItemCatalog catalog = ItemCatalog(catalogProxyV1);

        // Read catalog.json
        string memory catalogJson = vm.readFile("docs/stabilization_script/sim/items/output/catalog.json");
        
        // Count entries
        uint256 entryCount = _countCatalogEntries(catalogJson);
        console2.log("Total entries in catalog.json:", entryCount);

        vm.startBroadcast(deployerPrivateKey);

        // Add templates in batches to avoid memory limits
        uint256 BATCH_SIZE = 10;
        uint256 successCount = 0;
        
        for (uint256 batchStart = 0; batchStart < entryCount; batchStart += BATCH_SIZE) {
            uint256 batchEnd = batchStart + BATCH_SIZE;
            if (batchEnd > entryCount) {
                batchEnd = entryCount;
            }
            
            // Prepare batch
            ItemCatalog.ItemTemplate[] memory batch = new ItemCatalog.ItemTemplate[](batchEnd - batchStart);
            
            for (uint256 i = batchStart; i < batchEnd; i++) {
                CatalogEntry memory entry = _parseSingleEntry(catalogJson, i);

                // Add to batch (imagePtr will be address(0) initially, updated later via UploadItemImages)
                batch[i - batchStart] = ItemCatalog.ItemTemplate({
                    rarity: entry.rarity,
                    primaryTrait: entry.primary_trait,
                    primaryDelta: entry.primary_delta,
                    secondaryTrait: entry.secondary_trait,
                    secondaryDelta: entry.secondary_delta,
                    imagePtr: address(0), // Will be set by UploadItemImages script
                    name: entry.name,
                    description: entry.description
                });
            }
            
            // Add batch to catalog
            try catalog.addTemplatesBatch(batch) returns (uint256 firstTemplateId) {
                successCount += batch.length;
                console2.log("Added batch", batchStart, "to", batchEnd - 1);
                console2.log("First template ID:", firstTemplateId);
            } catch Error(string memory reason) {
                console2.log("Failed to add batch", batchStart, "-", batchEnd - 1);
                console2.log("Error:", reason);
                revert(reason);
            } catch {
                console2.log("Failed to add batch", batchStart, "-", batchEnd - 1);
                revert("Batch add failed");
            }
        }

        // Optionally mint 1 of each item to admin recipient
        if (itemTokenProxyV1 != address(0)) {
            ItemToken1155 itemToken = ItemToken1155(itemTokenProxyV1);
            console2.log("\nMinting 1 of each item to admin recipient...");
            
            for (uint256 i = 0; i < entryCount; i++) {
                try itemToken.adminMint(adminRecipientV1, i, 1) {
                    if (i % 10 == 0 || i == entryCount - 1) {
                        console2.log("Minted item", i, "to", adminRecipientV1);
                    }
                } catch {
                    console2.log("Failed to mint item", i);
                }
            }
        }

        vm.stopBroadcast();

        console2.log("\n=== V1 Catalog Seeding Complete ===");
        console2.log("Seeded", successCount, "templates into v1 catalog at", catalogProxyV1);
        if (itemTokenProxyV1 != address(0)) {
            console2.log("Minted 1 of each item to", adminRecipientV1);
        }
        console2.log("\nNext step: Run UploadItemImages.s.sol with v1 env vars to upload images");
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
        entry.name = vm.parseJsonString(json, string(abi.encodePacked(baseKey, ".name")));
        entry.rarity = uint8(vm.parseJsonUint(json, string(abi.encodePacked(baseKey, ".rarity"))));
        entry.primary_trait = uint8(vm.parseJsonUint(json, string(abi.encodePacked(baseKey, ".primary_trait"))));
        entry.primary_delta = int16(int256(vm.parseJsonInt(json, string(abi.encodePacked(baseKey, ".primary_delta")))));
        entry.secondary_trait = uint8(vm.parseJsonUint(json, string(abi.encodePacked(baseKey, ".secondary_trait"))));
        entry.secondary_delta = int16(int256(vm.parseJsonInt(json, string(abi.encodePacked(baseKey, ".secondary_delta")))));
        entry.image_key = vm.parseJsonString(json, string(abi.encodePacked(baseKey, ".image_key")));
        entry.description = vm.parseJsonString(json, string(abi.encodePacked(baseKey, ".description")));
    }
}

