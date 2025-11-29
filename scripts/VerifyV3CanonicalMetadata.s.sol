// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";

/**
 * @title VerifyV3CanonicalMetadata
 * @notice Read-only script to verify V3 item collection metadata is canonical
 * @dev No broadcast needed - this is a read-only verification
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export ITEM_V3=0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8
 * 
 *   forge script scripts/VerifyV3CanonicalMetadata.s.sol --rpc-url $RPC
 */
contract VerifyV3CanonicalMetadata is Script {
    function run() external view {
        address itemV3 = vm.envAddress("ITEM_V3");
        
        console2.log("=== Verifying V3 Canonical Metadata ===");
        console2.log("ITEM_V3:", itemV3);
        console2.log("");
        
        ItemToken1155 itemToken = ItemToken1155(itemV3);
        
        // Read metadata
        string memory name = itemToken.name();
        string memory symbol = itemToken.symbol();
        string memory contractURI = itemToken.contractURI();
        string memory externalImageBaseURI = itemToken.externalImageBaseURI();
        
        console2.log("Collection Name:", name);
        console2.log("Collection Symbol:", symbol);
        console2.log("Contract URI:", contractURI);
        console2.log("External Image Base URI:", externalImageBaseURI);
        console2.log("");
        
        // Verify canonical branding
        bool nameValid = _contains(name, "Stabilization Items");
        bool symbolValid = _contains(symbol, "ITEMS");
        
        console2.log("=== Verification Results ===");
        console2.log("Name contains 'Stabilization Items':", nameValid ? "✓" : "✗");
        console2.log("Symbol contains 'ITEMS':", symbolValid ? "✓" : "✗");
        console2.log("External Image Base URI set:", bytes(externalImageBaseURI).length > 0 ? "✓" : "✗");
        
        if (nameValid && symbolValid) {
            console2.log("");
            console2.log("✓ V3 metadata is canonical");
        } else {
            console2.log("");
            console2.log("⚠ V3 metadata may need attention");
        }
    }
    
    function _contains(string memory str, string memory substr) internal pure returns (bool) {
        bytes memory strBytes = bytes(str);
        bytes memory substrBytes = bytes(substr);
        
        if (substrBytes.length > strBytes.length) return false;
        
        for (uint256 i = 0; i <= strBytes.length - substrBytes.length; i++) {
            bool match = true;
            for (uint256 j = 0; j < substrBytes.length; j++) {
                if (strBytes[i + j] != substrBytes[j]) {
                    match = false;
                    break;
                }
            }
            if (match) return true;
        }
        return false;
    }
}



