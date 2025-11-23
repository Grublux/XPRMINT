// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";

/**
 * @title DeployItemToken1155V1_2
 * @notice Deploy new ItemToken1155 implementation with externalImageBaseURI support
 * @dev This implementation adds marketplace-friendly image URLs while preserving on-chain data URIs
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 * 
 *   forge script scripts/DeployItemToken1155V1_2.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast
 */
contract DeployItemToken1155V1_2 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        console2.log("=== Deploy ItemToken1155 V1.2 Implementation ===");
        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new implementation
        ItemToken1155 newImpl = new ItemToken1155();
        address implAddr = address(newImpl);

        vm.stopBroadcast();

        console2.log("[OK] New ItemToken1155 implementation deployed!");
        console2.log("Implementation address:", implAddr);
        console2.log("");
        console2.log("Export for upgrade script:");
        console2.log("export ITEM_TOKEN_IMPL_V1_2=", implAddr);
        console2.log("");
        console2.log("Next step: Run UpgradeItemToken1155V1.s.sol to upgrade the proxy");
    }
}

