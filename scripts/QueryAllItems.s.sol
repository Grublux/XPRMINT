// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../contracts/stabilization/items/ItemCatalog.sol";

/**
 * @title QueryAllItems
 * @notice Script to query all items from the deployed ItemCatalog and display their traits/deltas
 */
contract QueryAllItems is Script {
    function run() external view {
        // V3 Catalog address on ApeChain mainnet
        address catalogAddr = vm.envOr("CATALOG_V1", address(0x06266255ee081AcA64328dE8fcc939923eE6e8c8));
        
        if (catalogAddr == address(0)) {
            console.log("Error: CATALOG_V1 not set");
            return;
        }
        
        ItemCatalog catalog = ItemCatalog(catalogAddr);
        uint256 templateCount = catalog.templateCount();
        
        console.log("=== Item Catalog Query ===");
        console.log("Catalog Address:", catalogAddr);
        console.log("Total Templates:", templateCount);
        console.log("");
        
        // Trait names
        string[5] memory traitNames = ["Salinity", "pH", "Temperature", "Frequency", "None"];
        string[4] memory rarityNames = ["Common", "Uncommon", "Rare", "Epic"];
        
        console.log("ID | Name | Rarity | Primary Trait | Primary Delta | Secondary Trait | Secondary Delta");
        console.log("---|------|--------|---------------|---------------|----------------|----------------");
        
        for (uint256 i = 0; i < templateCount; i++) {
            ItemCatalog.ItemTemplate memory template = catalog.getTemplate(i);
            
            string memory primaryTraitName = traitNames[template.primaryTrait];
            string memory secondaryTraitName = template.secondaryTrait < 5 
                ? traitNames[template.secondaryTrait] 
                : "None";
            string memory rarityName = rarityNames[template.rarity];
            
            console.log("%s | %s | %s | %s | %d | %s | %d", 
                vm.toString(i),
                template.name,
                rarityName,
                primaryTraitName,
                template.primaryDelta,
                secondaryTraitName,
                template.secondaryDelta
            );
        }
    }
}

