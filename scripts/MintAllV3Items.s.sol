// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";

/**
 * @title MintAllV3Items
 * @notice Mints 1 of each item (IDs 0-63) from ITEM_V3 to deployer wallet
 * @dev Uses adminMint function, owner-only. Ensures items are clearly owned by deployer for Magic Eden visibility.
 * 
 * Usage:
 *   export RPC="https://apechain.calderachain.xyz/http"
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export ITEM_V3=0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8
 * 
 *   forge script scripts/MintAllV3Items.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast \
 *     -vvvv
 */
contract MintAllV3Items is Script {
    function run() external {
        // Load environment variables
        address itemV3 = vm.envAddress("ITEM_V3");
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Safety guards
        require(itemV3 != address(0), "ITEM_V3 env var missing");
        
        console2.log("=== Minting All V3 Items ===");
        console2.log("ITEM_V3:", itemV3);
        console2.log("Deployer:", deployer);
        console2.log("Items to mint: 0-63 (64 items, 1 each)");
        console2.log("");
        
        ItemToken1155 itemToken = ItemToken1155(itemV3);
        
        // Verify deployer is owner
        require(itemToken.owner() == deployer, "MintAllV3Items: deployer is not owner");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Mint 1 of each item (0-63) to deployer
        for (uint256 id = 0; id < 64; id++) {
            itemToken.adminMint(deployer, id, 1);
            console2.log("Minted item", id, "to deployer");
        }
        
        vm.stopBroadcast();
        
        console2.log("");
        console2.log("=== Minting Complete ===");
        console2.log("Minted 64 items (0-63) to deployer");
        console2.log("");
        
        // Verification: Check balances for spot-check IDs
        console2.log("=== Balance Verification (Spot Checks) ===");
        uint256[] memory checkIds = new uint256[](4);
        checkIds[0] = 0;
        checkIds[1] = 7;
        checkIds[2] = 31;
        checkIds[3] = 63;
        
        for (uint256 i = 0; i < checkIds.length; i++) {
            uint256 id = checkIds[i];
            uint256 balance = itemToken.balanceOf(deployer, id);
            console2.log("Item", id, "balance:", balance);
            require(balance >= 1, "Balance verification failed");
        }
        
        console2.log("");
        console2.log("=== URI Verification (Sample) ===");
        uint256[] memory uriCheckIds = new uint256[](3);
        uriCheckIds[0] = 0;
        uriCheckIds[1] = 7;
        uriCheckIds[2] = 31;
        
        for (uint256 i = 0; i < uriCheckIds.length; i++) {
            uint256 id = uriCheckIds[i];
            string memory tokenURI = itemToken.uri(id);
            console2.log("Item", id, "URI length:", bytes(tokenURI).length);
            require(bytes(tokenURI).length > 0, "URI verification failed");
        }
        
        console2.log("");
        console2.log("=== All Items Minted and Verified ===");
        console2.log("Deployer wallet:", deployer);
        console2.log("Items should now be visible on Magic Eden");
    }
}

