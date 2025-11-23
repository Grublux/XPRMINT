// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

/**
 * @title PrintItemToken1155UpgradeCast
 * @notice Prints exact cast commands for manually upgrading ItemToken1155 V1 → V1.2
 * @dev This script does NOT broadcast any transactions. It only prints commands.
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export PROXY_ADMIN_V1=0xdb8047eD77099626e189316Ced0b25b46Ae0181d
 *   export ITEM_TOKEN_PROXY_V1=0x9C4216d7B56A25b4B8a8eDdEfeBaBa389E05A01E
 *   export ITEM_TOKEN_IMPL_V12=0xD8ac1dc16930Ab8FE62A8e5cF43F874f32e4CA0f
 * 
 *   forge script scripts/PrintItemToken1155UpgradeCast.s.sol --rpc-url $RPC
 * 
 * Then copy-paste the printed cast commands.
 */
contract PrintItemToken1155UpgradeCast is Script {
    function run() external {
        address proxyAdminV1 = vm.envAddress("PROXY_ADMIN_V1");
        address itemTokenProxyV1 = vm.envAddress("ITEM_TOKEN_PROXY_V1");
        address newImpl = vm.envAddress("ITEM_TOKEN_IMPL_V12");
        string memory rpc = vm.envOr("RPC", string("https://apechain.calderachain.xyz/http"));

        // Get the individual proxy admin from the proxy's admin slot
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        address individualProxyAdmin = address(uint160(uint256(vm.load(itemTokenProxyV1, adminSlot))));

        console2.log("=== Export Variables ===");
        console2.log("export PROXY_ADMIN_V1=", proxyAdminV1);
        console2.log("export INDIVIDUAL_PROXY_ADMIN=", individualProxyAdmin);
        console2.log("export ITEM_TOKEN_PROXY_V1=", itemTokenProxyV1);
        console2.log("export ITEM_TOKEN_IMPL_V12=", newImpl);
        console2.log("export RPC=", rpc);
        console2.log("export PK=$DEPLOYER_PRIVATE_KEY");
        console2.log("");
        console2.log("=== Cast Commands ===");
        console2.log("");
        console2.log("# Step 1: Check ProxyAdminV1 owner");
        console2.log("cast call $PROXY_ADMIN_V1 \"owner()(address)\" --rpc-url $RPC");
        console2.log("");
        console2.log("# Step 2: Check individual ProxyAdmin owner");
        console2.log("cast call $INDIVIDUAL_PROXY_ADMIN \"owner()(address)\" --rpc-url $RPC");
        console2.log("");
        console2.log("# Step 3: Check current implementation (via storage slot)");
        console2.log("cast storage $ITEM_TOKEN_PROXY_V1 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc --rpc-url $RPC");
        console2.log("");
        console2.log("# Step 4: Upgrade implementation");
        console2.log("# Note: ProxyAdmin v5.2.0 only has upgradeAndCall, not upgrade");
        console2.log("# Passing empty bytes (0x) performs a plain upgrade without calling any function");
        console2.log("# The individual ProxyAdmin is the actual admin of the proxy");
        console2.log("cast send $INDIVIDUAL_PROXY_ADMIN \"upgradeAndCall(address,address,bytes)\" $ITEM_TOKEN_PROXY_V1 $ITEM_TOKEN_IMPL_V12 0x \\");
        console2.log("  --rpc-url $RPC \\");
        console2.log("  --private-key $PK");
        console2.log("");
        console2.log("# Step 4: Verify upgrade");
        console2.log("cast call $ITEM_TOKEN_PROXY_V1 \"name()(string)\" --rpc-url $RPC");
        console2.log("cast call $ITEM_TOKEN_PROXY_V1 \"symbol()(string)\" --rpc-url $RPC");
        console2.log("cast call $ITEM_TOKEN_PROXY_V1 \"externalImageBaseURI()(string)\" --rpc-url $RPC");
        console2.log("cast call $ITEM_TOKEN_PROXY_V1 \"uri(uint256)(string)\" 0 --rpc-url $RPC");
    }
}

