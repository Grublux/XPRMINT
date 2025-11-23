// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ItemCatalog} from "../contracts/stabilization/items/ItemCatalog.sol";
import {ItemImageDeployer} from "../contracts/stabilization/items/ItemImageDeployer.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @title DeployItemCatalog
 * @notice Deploy and populate ItemCatalog with templates from catalog.json
 */
contract DeployItemCatalog is Script {
    struct CatalogEntry {
        uint256 id;
        string name;
        uint8 rarity;
        string rarity_name;
        uint8 primary_trait;
        string primary_trait_name;
        int16 primary_delta;
        uint8 secondary_trait;
        string secondary_trait_name;
        int16 secondary_delta;
        string image_key;
        string description;
        string[] domain;
    }

    function run() external {
        // Deployer configuration - supports both PRIVATE_KEY and DEPLOYER_PRIVATE_KEY
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        if (deployerPrivateKey == 0) {
            deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        }
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);

        // Use existing addresses if provided (for populating existing catalog)
        address catalogProxyAddr = vm.envOr("ITEM_CATALOG_PROXY", address(0));
        address imageDeployerAddr = vm.envOr("ITEM_IMAGE_DEPLOYER", address(0));
        address proxyAdminAddr = vm.envOr("PROXY_ADMIN", address(0));

        ItemCatalog catalog;
        ItemImageDeployer imageDeployer;

        if (catalogProxyAddr != address(0)) {
            // Use existing catalog proxy
            catalog = ItemCatalog(catalogProxyAddr);
            console.log("Using existing ItemCatalog proxy at:", catalogProxyAddr);
            
            if (imageDeployerAddr != address(0)) {
                imageDeployer = ItemImageDeployer(imageDeployerAddr);
                console.log("Using existing ItemImageDeployer at:", imageDeployerAddr);
            } else {
                // Deploy new ItemImageDeployer if not provided
                imageDeployer = new ItemImageDeployer();
                console.log("ItemImageDeployer deployed at:", address(imageDeployer));
            }
        } else {
            // Deploy new catalog and image deployer
            ProxyAdmin proxyAdmin;
            if (proxyAdminAddr == address(0)) {
                proxyAdmin = new ProxyAdmin(deployer);
                console.log("ProxyAdmin deployed at:", address(proxyAdmin));
            } else {
                proxyAdmin = ProxyAdmin(proxyAdminAddr);
                console.log("Using existing ProxyAdmin at:", address(proxyAdmin));
            }

            // Deploy ItemImageDeployer
            imageDeployer = new ItemImageDeployer();
            console.log("ItemImageDeployer deployed at:", address(imageDeployer));

            // Deploy ItemCatalog implementation
            ItemCatalog catalogImpl = new ItemCatalog();
            console.log("ItemCatalog impl deployed at:", address(catalogImpl));

            // Deploy ItemCatalog proxy
            bytes memory initData = abi.encodeWithSelector(
                ItemCatalog.initialize.selector
            );
            TransparentUpgradeableProxy catalogProxy = new TransparentUpgradeableProxy(
                address(catalogImpl),
                address(proxyAdmin),
                initData
            );
            catalog = ItemCatalog(address(catalogProxy));
            console.log("ItemCatalog proxy deployed at:", address(catalogProxy));
        }

        // Load catalog.json
        string memory catalogJsonPath = vm.envOr(
            "CATALOG_JSON_PATH",
            string("docs/stabilization_script/sim/items/output/catalog.json")
        );
        string memory catalogJson = vm.readFile(catalogJsonPath);

        // Count entries first
        uint256 entryCount = _countCatalogEntries(catalogJson);
        console.log("Found", entryCount, "templates in catalog.json");

        // Deploy images and populate catalog in batches
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

                // Deploy image to SSTORE2 (skip for now to avoid memory limits)
                address imagePtr = address(0);
                // TODO: Deploy images in a separate script to avoid memory limits
                // if (bytes(entry.image_key).length > 0) {
                //     string memory imagePath = string(
                //         abi.encodePacked("assets/items/", entry.image_key, ".png")
                //     );
                //     try vm.readFileBinary(imagePath) returns (bytes memory imageBytes) {
                //         imagePtr = imageDeployer.deployImage(imageBytes);
                //         if (i % 10 == 0) {
                //             console.log("Deployed image for template", entry.id, "at:", imagePtr);
                //         }
                //     } catch {
                //         // Use address(0) if image not found
                //     }
                // }

                // Add to batch
                batch[i - batchStart] = ItemCatalog.ItemTemplate({
                    rarity: entry.rarity,
                    primaryTrait: entry.primary_trait,
                    primaryDelta: entry.primary_delta,
                    secondaryTrait: entry.secondary_trait,
                    secondaryDelta: entry.secondary_delta,
                    imagePtr: imagePtr,
                    name: entry.name,
                    description: entry.description
                });
            }
            
            // Add batch to catalog
            try catalog.addTemplatesBatch(batch) returns (uint256 firstTemplateId) {
                successCount += batch.length;
                console.log("Added batch", batchStart, "to", batchEnd - 1);
            } catch {
                console.log("Failed to add batch", batchStart, "to", batchEnd - 1);
            }
        }

        console.log("\n=== Deployment Summary ===");
        console.log("ItemCatalog proxy:", address(catalog));
        console.log("ItemImageDeployer:", address(imageDeployer));
        console.log("Templates added:", successCount, "/", entryCount);

        // Ops/testing: Mint 1 of each item template to admin recipient
        address itemTokenAddr = vm.envOr("STAB_ITEM_TOKEN", vm.envOr("ITEM_TOKEN_PROXY", address(0)));
        if (itemTokenAddr != address(0)) {
            ItemToken1155 itemToken = ItemToken1155(itemTokenAddr);
            address adminRecipient = vm.envOr("ITEM_ADMIN_RECIPIENT", deployer);
            
            console.log("\n=== Admin Mint: 1 of each item ===");
            console.log("Recipient:", adminRecipient);
            
            uint256 templateCount = catalog.templateCount();
            uint256 mintCount = 0;
            for (uint256 i = 0; i < templateCount; i++) {
                try itemToken.adminMint(adminRecipient, i, 1) {
                    mintCount++;
                    if (i % 10 == 0) {
                        console.log("Minted template", i);
                    }
                } catch {
                    console.log("Failed to mint template", i);
                }
            }
            console.log("Admin mint complete:", mintCount, "/", templateCount);
        } else {
            console.log("\n=== Skipping admin mint (ITEM_TOKEN_PROXY not set) ===");
        }

        vm.stopBroadcast();
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
     * @notice Parse a single catalog entry from JSON
     */
    function _parseSingleEntry(
        string memory json,
        uint256 index
    ) internal returns (CatalogEntry memory entry) {
        string memory baseKey = string(abi.encodePacked("$[", vm.toString(index), "]"));
        
        entry.id = vm.parseJsonUint(json, string(abi.encodePacked(baseKey, ".id")));
        entry.name = vm.parseJsonString(json, string(abi.encodePacked(baseKey, ".name")));
        entry.rarity = uint8(vm.parseJsonUint(json, string(abi.encodePacked(baseKey, ".rarity"))));
        entry.rarity_name = vm.parseJsonString(json, string(abi.encodePacked(baseKey, ".rarity_name")));
        entry.primary_trait = uint8(vm.parseJsonUint(json, string(abi.encodePacked(baseKey, ".primary_trait"))));
        entry.primary_trait_name = vm.parseJsonString(json, string(abi.encodePacked(baseKey, ".primary_trait_name")));
        entry.primary_delta = int16(int256(vm.parseJsonUint(json, string(abi.encodePacked(baseKey, ".primary_delta")))));
        entry.secondary_trait = uint8(vm.parseJsonUint(json, string(abi.encodePacked(baseKey, ".secondary_trait"))));
        entry.secondary_trait_name = vm.parseJsonString(json, string(abi.encodePacked(baseKey, ".secondary_trait_name")));
        entry.secondary_delta = int16(int256(vm.parseJsonUint(json, string(abi.encodePacked(baseKey, ".secondary_delta")))));
        entry.image_key = vm.parseJsonString(json, string(abi.encodePacked(baseKey, ".image_key")));
        entry.description = vm.parseJsonString(json, string(abi.encodePacked(baseKey, ".description")));
        
        // Parse domain array (simplified - just get first element if exists)
        try vm.parseJsonString(json, string(abi.encodePacked(baseKey, ".domain[0]"))) returns (string memory domain0) {
            entry.domain = new string[](1);
            entry.domain[0] = domain0;
        } catch {
            entry.domain = new string[](0);
        }
    }

}

