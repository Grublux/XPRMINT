// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ItemCatalog} from "../contracts/stabilization/items/ItemCatalog.sol";
import {ItemGenerator} from "../contracts/stabilization/items/ItemGenerator.sol";

/**
 * @title UpdateSecondaryTraits
 * @notice Script to update all 54 non-epic items (0-53) with new item-specific secondary traits
 * @dev Epic items (54-63) are skipped as they have no secondary trait
 * 
 * Mapping:
 * - Items 0-3: Salinity → pH
 * - Items 4-7: Salinity → Temperature
 * - Items 8-12: Salinity → Frequency
 * - Items 13-16: pH → Salinity
 * - Items 17-20: pH → Temperature
 * - Items 21-25: pH → Frequency
 * - Items 26-30: Temperature → Salinity
 * - Items 31-34: Temperature → pH
 * - Items 35-39: Temperature → Frequency
 * - Items 40-44: Frequency → Salinity
 * - Items 45-48: Frequency → pH
 * - Items 49-53: Frequency → Temperature
 */
contract UpdateSecondaryTraits is Script {
    // Trait constants
    uint8 private constant TRAIT_SALINITY = ItemGenerator.TRAIT_SALINITY;      // 0
    uint8 private constant TRAIT_PH = ItemGenerator.TRAIT_PH;                  // 1
    uint8 private constant TRAIT_TEMPERATURE = ItemGenerator.TRAIT_TEMPERATURE; // 2
    uint8 private constant TRAIT_FREQUENCY = ItemGenerator.TRAIT_FREQUENCY;     // 3
    uint8 private constant TRAIT_NONE = ItemGenerator.TRAIT_NONE;               // 4

    // Mapping: templateId -> new secondary trait
    // Items 0-53 only (epic items 54-63 are skipped)
    mapping(uint256 => uint8) private secondaryTraitMap;

    function setUp() public {
        // Salinity items (0-12)
        secondaryTraitMap[0] = TRAIT_PH;        // Rust-Flake Calibrator
        secondaryTraitMap[1] = TRAIT_PH;        // Brass Drip Coupling
        secondaryTraitMap[2] = TRAIT_PH;        // Pickle-Line Tubing Section
        secondaryTraitMap[3] = TRAIT_PH;        // Salinity Gauge Cartridge
        secondaryTraitMap[4] = TRAIT_TEMPERATURE; // Tap-Valve Concentrator
        secondaryTraitMap[5] = TRAIT_TEMPERATURE; // Dust of Minto Horn
        secondaryTraitMap[6] = TRAIT_TEMPERATURE; // Pickle-Brine Filter Disk
        secondaryTraitMap[7] = TRAIT_TEMPERATURE; // Minewater Compression Brick
        secondaryTraitMap[8] = TRAIT_FREQUENCY;  // Electro-Salt Capacitor
        secondaryTraitMap[9] = TRAIT_FREQUENCY;  // Outhouse Sludge Tablet
        secondaryTraitMap[10] = TRAIT_FREQUENCY; // Cellar Salt-Press Plate
        secondaryTraitMap[11] = TRAIT_FREQUENCY; // Iono-Regulation Core
        secondaryTraitMap[12] = TRAIT_FREQUENCY; // House-Linen Mineral Strip

        // pH items (13-25)
        secondaryTraitMap[13] = TRAIT_SALINITY;  // pH Drip Regulator
        secondaryTraitMap[14] = TRAIT_SALINITY;  // Neutralizing Valve Pellet
        secondaryTraitMap[15] = TRAIT_SALINITY;  // Vinegar-Stone Bite
        secondaryTraitMap[16] = TRAIT_SALINITY;  // Balancing Basin Cartridge
        secondaryTraitMap[17] = TRAIT_TEMPERATURE; // Metered Dose Basin Syringe
        secondaryTraitMap[18] = TRAIT_TEMPERATURE; // Unicorn Brew Settling Disc
        secondaryTraitMap[19] = TRAIT_TEMPERATURE; // Dairy-Ladle pH Paddle
        secondaryTraitMap[20] = TRAIT_TEMPERATURE; // Guestroom Basin Scale Chip
        secondaryTraitMap[21] = TRAIT_FREQUENCY;  // Basin-Reactor Flask
        secondaryTraitMap[22] = TRAIT_FREQUENCY;  // Mineral pH Regulator Shard
        secondaryTraitMap[23] = TRAIT_FREQUENCY;  // Volatility Modulation Tube
        secondaryTraitMap[24] = TRAIT_FREQUENCY;  // Deep-Clean Scraper Head
        secondaryTraitMap[25] = TRAIT_FREQUENCY;  // pH Equilibrium Lance

        // Temperature items (26-39)
        secondaryTraitMap[26] = TRAIT_SALINITY;  // Flux-Wick Assembly
        secondaryTraitMap[27] = TRAIT_SALINITY;  // Conduction Scrap Chip
        secondaryTraitMap[28] = TRAIT_SALINITY;  // Stove Coil Topper
        secondaryTraitMap[29] = TRAIT_SALINITY;  // Pantry Thermo-Crank
        secondaryTraitMap[30] = TRAIT_SALINITY;  // Boiler-Runoff Coil Segment
        secondaryTraitMap[31] = TRAIT_PH;        // Cellar-Core Capsule
        secondaryTraitMap[32] = TRAIT_PH;        // Generator-Chain Flux Loop
        secondaryTraitMap[33] = TRAIT_PH;        // Goat-Stall Comfort Rod
        secondaryTraitMap[34] = TRAIT_PH;        // Bedframe Coil Support
        secondaryTraitMap[35] = TRAIT_FREQUENCY;  // Kinetic-Whip Rod
        secondaryTraitMap[36] = TRAIT_FREQUENCY;  // Charge-Burst Pebble
        secondaryTraitMap[37] = TRAIT_FREQUENCY;  // Stabilizer Core Block
        secondaryTraitMap[38] = TRAIT_FREQUENCY;  // Smokehouse Ember Disk
        secondaryTraitMap[39] = TRAIT_FREQUENCY;  // Flux Convergence Node

        // Frequency items (40-53)
        secondaryTraitMap[40] = TRAIT_SALINITY;  // Chime-Plate Resonator
        secondaryTraitMap[41] = TRAIT_SALINITY;  // Buzz-Coil Relay
        secondaryTraitMap[42] = TRAIT_SALINITY;  // Vibe-Spring Coupling
        secondaryTraitMap[43] = TRAIT_SALINITY;  // Broom-Handle Resonance Rod
        secondaryTraitMap[44] = TRAIT_SALINITY;  // Stove-Plate Resonance Cage
        secondaryTraitMap[45] = TRAIT_PH;        // Tuning Fork Assembly
        secondaryTraitMap[46] = TRAIT_PH;        // Bar-Top Acoustic Rod
        secondaryTraitMap[47] = TRAIT_PH;        // Maintenance Rattle Clamp
        secondaryTraitMap[48] = TRAIT_PH;        // Door-Hinge Resonance Pin
        secondaryTraitMap[49] = TRAIT_TEMPERATURE; // Bottling Conveyor Harmonic Wheel
        secondaryTraitMap[50] = TRAIT_TEMPERATURE; // Lantern-Soot Oscillation Baffle
        secondaryTraitMap[51] = TRAIT_TEMPERATURE; // Chroma Conduction Core
        secondaryTraitMap[52] = TRAIT_TEMPERATURE; // Stage-Bell Resonance Drum
        secondaryTraitMap[53] = TRAIT_TEMPERATURE; // Boiler-Gauge Flux Coupler

        // Epic items (54-63) are skipped - they have no secondary trait
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");

        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deployer:", deployer);

        // Get ItemCatalog proxy address
        address catalogProxyAddr = vm.envOr("ITEM_CATALOG_PROXY", vm.envOr("STAB_ITEM_CATALOG", address(0)));
        require(catalogProxyAddr != address(0), "ItemCatalog proxy address not set");
        console.log("ItemCatalog proxy:", catalogProxyAddr);

        ItemCatalog catalog = ItemCatalog(catalogProxyAddr);

        // Get current template count
        uint256 templateCount = catalog.templateCount();
        console.log("Current template count:", templateCount);
        require(templateCount >= 64, "Expected at least 64 templates");

        vm.startBroadcast(deployerPrivateKey);

        uint256 successCount = 0;
        uint256 skipCount = 0;

        // Update items 0-53 (non-epic items)
        for (uint256 templateId = 0; templateId < 54; templateId++) {
            // Get current template to preserve secondaryDelta
            ItemCatalog.ItemTemplate memory currentTemplate = catalog.getTemplate(templateId);
            
            // Get new secondary trait from mapping
            uint8 newSecondaryTrait = secondaryTraitMap[templateId];
            
            // Preserve existing secondaryDelta
            int16 currentSecondaryDelta = currentTemplate.secondaryDelta;

            // Verify this is not an epic item
            require(
                currentTemplate.rarity != ItemGenerator.RARITY_EPIC,
                string(abi.encodePacked("Template ", vm.toString(templateId), " is epic, should be skipped"))
            );

            // Check if update is needed
            if (currentTemplate.secondaryTrait == newSecondaryTrait) {
                console.log("Template", templateId, "already has correct secondary trait, skipping");
                skipCount++;
                continue;
            }

            // Update the template
            console.log("Updating template", templateId, ":");
            console.log("  Name:", currentTemplate.name);
            console.log("  Old secondary trait:", currentTemplate.secondaryTrait);
            console.log("  New secondary trait:", newSecondaryTrait);
            console.log("  Preserving secondary delta:", currentSecondaryDelta);

            catalog.updateTemplateSecondaryTrait(
                templateId,
                newSecondaryTrait,
                currentSecondaryDelta
            );

            // Verify the update
            ItemCatalog.ItemTemplate memory updatedTemplate = catalog.getTemplate(templateId);
            require(
                updatedTemplate.secondaryTrait == newSecondaryTrait,
                string(abi.encodePacked("Failed to update template ", vm.toString(templateId)))
            );
            require(
                updatedTemplate.secondaryDelta == currentSecondaryDelta,
                string(abi.encodePacked("Secondary delta changed for template ", vm.toString(templateId)))
            );

            successCount++;
            console.log("  [OK] Template", templateId, "updated successfully\n");
        }

        vm.stopBroadcast();

        console.log("\n=== Update Complete ===");
        console.log("Successfully updated:", successCount, "templates");
        console.log("Skipped (already correct):", skipCount, "templates");
        console.log("Epic items (54-63) were not modified (no secondary trait)");
    }
}

