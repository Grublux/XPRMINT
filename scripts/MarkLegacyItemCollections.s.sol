// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

// Minimal interfaces for legacy contracts
interface ILegacyItemMetadata {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function setName(string calldata) external;
    function setSymbol(string calldata) external;
    function setContractURI(string calldata) external;
}

interface IERC1155Lite {
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;
}

/**
 * @title MarkLegacyItemCollections
 * @notice Marks V0/V1/V2 item collections as legacy and burns deployer-held items
 * @dev Uses try/catch to gracefully handle missing functions
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=0x...
 *   export ITEM_V0=0x...  # optional, skip if empty
 *   export ITEM_V1=0x...  # optional, skip if empty
 *   export ITEM_V2=0x...  # optional, skip if empty
 * 
 *   forge script scripts/MarkLegacyItemCollections.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast \
 *     --private-key $DEPLOYER_PRIVATE_KEY
 */
contract MarkLegacyItemCollections is Script {
    // Dead address for burning tokens
    address constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console2.log("=== Marking Legacy Item Collections ===");
        console2.log("Deployer:", deployer);
        console2.log("");
        
        // Load legacy addresses (optional env vars)
        address itemV0 = vm.envOr("ITEM_V0", address(0));
        address itemV1 = vm.envOr("ITEM_V1", address(0));
        address itemV2 = vm.envOr("ITEM_V2", address(0));
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Process V0
        if (itemV0 != address(0)) {
            console2.log("Processing ITEM_V0:", itemV0);
            _processLegacyCollection(itemV0, "V0", deployer);
        }
        
        // Process V1
        if (itemV1 != address(0)) {
            console2.log("Processing ITEM_V1:", itemV1);
            _processLegacyCollection(itemV1, "V1", deployer);
        }
        
        // Process V2
        if (itemV2 != address(0)) {
            console2.log("Processing ITEM_V2:", itemV2);
            _processLegacyCollection(itemV2, "V2", deployer);
        }
        
        vm.stopBroadcast();
        
        console2.log("");
        console2.log("=== Legacy Collection Cleanup Complete ===");
    }
    
    function _processLegacyCollection(address legacyAddr, string memory version, address deployer) internal {
        ILegacyItemMetadata metadata = ILegacyItemMetadata(legacyAddr);
        IERC1155Lite erc1155 = IERC1155Lite(legacyAddr);
        
        // 1. Rename collection
        string memory legacyName = string(abi.encodePacked("Stabilization Items (Legacy ", version, " - DO NOT USE)"));
        string memory legacySymbol = string(abi.encodePacked("ITEMS-", version));
        
        try metadata.setName(legacyName) {
            console2.log("  [OK] Renamed to:", legacyName);
        } catch {
            console2.log("  [WARN] setName() not available or failed");
        }
        
        try metadata.setSymbol(legacySymbol) {
            console2.log("  [OK] Symbol set to:", legacySymbol);
        } catch {
            console2.log("  [WARN] setSymbol() not available or failed");
        }
        
        // 2. Update contractURI (optional)
        string memory legacyContractURI = string(abi.encodePacked("https://xprmint.com/stabilization/legacy-", version, ".json"));
        try metadata.setContractURI(legacyContractURI) {
            console2.log("  [OK] ContractURI set to:", legacyContractURI);
        } catch {
            console2.log("  [WARN] setContractURI() not available or skipped");
        }
        
        // 3. Burn deployer-held items (IDs 0-63)
        console2.log("  Burning deployer-held items...");
        uint256 burnedCount = 0;
        
        for (uint256 id = 0; id < 64; id++) {
            try erc1155.balanceOf(deployer, id) returns (uint256 balance) {
                if (balance > 0) {
                    try erc1155.safeTransferFrom(deployer, DEAD_ADDRESS, id, balance, "") {
                        console2.log("    Burned item", id);
                        console2.log("      Amount:", balance);
                        burnedCount += balance;
                    } catch {
                        console2.log("    [WARN] Failed to burn item", id);
                        console2.log("      Balance was:", balance);
                    }
                }
            } catch {
                // Contract doesn't implement balanceOf, skip
                break;
            }
        }
        
        if (burnedCount > 0) {
            console2.log("  [OK] Total items burned:", burnedCount);
        } else {
            console2.log("  [INFO] No items to burn");
        }
        
        console2.log("");
    }
}

