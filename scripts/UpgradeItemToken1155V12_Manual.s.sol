// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";

/**
 * @title UpgradeItemToken1155V12_Manual
 * @notice Outputs manual cast commands for upgrading ItemToken1155 V1 → V1.2
 * @dev 
 * WHY MANUAL COMMANDS:
 * - The proxy has an individual ProxyAdmin (0xec45...) owned by ProxyAdminV1 (a contract)
 * - Deployer owns ProxyAdminV1 but cannot directly call the individual ProxyAdmin
 * - ProxyAdminV1 is a contract, not an EOA, so we cannot sign transactions as it
 * - Solution: Manual ownership transfer + upgrade + transfer back
 * 
 * NOTE: This script does NOT execute the upgrade. It only prints the commands.
 * You must run the cast commands manually (or use a multi-sig for ProxyAdminV1).
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export PROXY_ADMIN_V1=0xdb8047eD77099626e189316Ced0b25b46Ae0181d
 *   export ITEM_TOKEN_PROXY_V1=0x9C4216d7B56A25b4B8a8eDdEfeBaBa389E05A01E
 *   export ITEM_TOKEN_IMPL_V12=0xD8ac1dc16930Ab8FE62A8e5cF43F874f32e4CA0f
 * 
 *   forge script scripts/UpgradeItemToken1155V12_Manual.s.sol --rpc-url $RPC
 */
contract UpgradeItemToken1155V12_Manual is Script {
    function run() external {
        address proxyAdminV1 = vm.envAddress("PROXY_ADMIN_V1");
        address itemTokenProxyV1 = vm.envAddress("ITEM_TOKEN_PROXY_V1");
        address newImpl = vm.envAddress("ITEM_TOKEN_IMPL_V12");

        // Get the individual proxy admin
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        address proxyAdmin = address(uint160(uint256(vm.load(itemTokenProxyV1, adminSlot))));
        
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        address deployer = deployerPrivateKey != 0 ? vm.addr(deployerPrivateKey) : address(0);

        console2.log("=== Manual Upgrade Commands for ItemToken1155 V1 to V1.2 ===");
        console2.log("");
        console2.log("PROBLEM:");
        console2.log("  Individual ProxyAdmin:", proxyAdmin);
        console2.log("  Individual ProxyAdmin Owner:", ProxyAdmin(proxyAdmin).owner());
        console2.log("  ProxyAdminV1:", proxyAdminV1);
        console2.log("  ProxyAdminV1 Owner:", ProxyAdmin(proxyAdminV1).owner());
        console2.log("");
        console2.log("  The individual ProxyAdmin is owned by ProxyAdminV1 (a contract),");
        console2.log("  so we cannot sign transactions as it directly.");
        console2.log("");
        console2.log("SOLUTION OPTIONS:");
        console2.log("");
        console2.log("Option 1: Use Multi-Sig (if ProxyAdminV1 is a multi-sig)");
        console2.log("  - Submit transactions through the multi-sig interface");
        console2.log("");
        console2.log("Option 2: Transfer Ownership Temporarily");
        console2.log("  - Requires ProxyAdminV1 to transfer ownership (if it's a contract with call capability)");
        console2.log("  - OR use a helper contract approach (complex)");
        console2.log("");
        console2.log("Option 3: Direct Upgrade (if storage layout allows)");
        console2.log("  - Try upgrading directly - the revert might be for a different reason");
        console2.log("");
        console2.log("=== MANUAL CAST COMMANDS ===");
        console2.log("");
        console2.log("If you have a way to execute as ProxyAdminV1 owner, run these:");
        console2.log("");
        console2.log("Step 1: Transfer ownership of individual ProxyAdmin to deployer");
        console2.log("cast send", proxyAdmin, "transferOwnership(address)", deployer, "--rpc-url $RPC --private-key $DEPLOYER_PRIVATE_KEY");
        console2.log("");
        console2.log("Step 2: Upgrade the proxy");
        console2.log("cast send", proxyAdmin, "upgradeAndCall(address,address,bytes)", itemTokenProxyV1, newImpl, "0x", "--rpc-url $RPC --private-key $DEPLOYER_PRIVATE_KEY");
        console2.log("");
        console2.log("Step 3: Transfer ownership back to ProxyAdminV1");
        console2.log("cast send", proxyAdmin, "transferOwnership(address)", proxyAdminV1, "--rpc-url $RPC --private-key $DEPLOYER_PRIVATE_KEY");
        console2.log("");
        console2.log("=== VERIFICATION ===");
        console2.log("After upgrade, verify:");
        console2.log("cast call", itemTokenProxyV1, "name()(string)", "--rpc-url $RPC");
        console2.log("cast call", itemTokenProxyV1, "externalImageBaseURI()(string)", "--rpc-url $RPC");
        console2.log("cast call", itemTokenProxyV1, "uri(uint256)(string)", "0", "--rpc-url $RPC");
    }
}


