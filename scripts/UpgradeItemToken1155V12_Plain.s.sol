// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";

/**
 * @title UpgradeItemToken1155V12_Plain
 * @notice Plain upgrade script for ItemToken1155 V1 → V1.2 (no re-initialization)
 * @dev 
 * WHY THIS SCRIPT EXISTS:
 * - Previous upgrade attempts may have used incorrect broadcast patterns or tried to re-initialize.
 * - The proxy is already initialized, so any attempt to call initialize() would hit the initializer guard and revert.
 * - This script performs a pure implementation swap using upgradeAndCall with EMPTY bytes.
 * 
 * CORRECT PATTERN:
 * - We sign transactions as the EOA deployer (using DEPLOYER_PRIVATE_KEY).
 * - We call ProxyAdminV1 as the TARGET contract (not as the signer).
 * - ProxyAdminV1 then calls the proxy's upgradeToAndCall.
 * 
 * STORAGE LAYOUT:
 * - V1.2 adds only `externalImageBaseURI` at the END of storage (slot 6).
 * - All existing variables remain in the same slots (0-5).
 * - This is a safe, backward-compatible upgrade.
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export PROXY_ADMIN_V1=0xdb8047eD77099626e189316Ced0b25b46Ae0181d
 *   export ITEM_TOKEN_PROXY_V1=0x9C4216d7B56A25b4B8a8eDdEfeBaBa389E05A01E
 *   export ITEM_TOKEN_IMPL_V12=0xD8ac1dc16930Ab8FE62A8e5cF43F874f32e4CA0f
 * 
 *   forge script scripts/UpgradeItemToken1155V12_Plain.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast
 */
contract UpgradeItemToken1155V12_Plain is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        address proxyAdminV1 = vm.envAddress("PROXY_ADMIN_V1");
        address itemTokenProxyV1 = vm.envAddress("ITEM_TOKEN_PROXY_V1");
        address newImpl = vm.envAddress("ITEM_TOKEN_IMPL_V12");

        console2.log("=== Plain Upgrade: ItemToken1155 V1 to V1.2 ===");
        console2.log("Deployer (EOA):", deployer);
        console2.log("ProxyAdminV1 (target contract):", proxyAdminV1);
        console2.log("ItemToken1155 Proxy:", itemTokenProxyV1);
        console2.log("New Implementation (V1.2):", newImpl);
        console2.log("");

        // Verify ProxyAdminV1 ownership
        address adminOwner = ProxyAdmin(proxyAdminV1).owner();
        console2.log("ProxyAdminV1 owner:", adminOwner);
        
        if (adminOwner != deployer) {
            console2.log("[ERROR] Deployer is not the owner of ProxyAdminV1!");
            revert("Not authorized to upgrade");
        }

        // Get the individual proxy admin from the proxy's admin slot
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        address individualProxyAdmin = address(uint160(uint256(vm.load(itemTokenProxyV1, adminSlot))));
        console2.log("Individual Proxy Admin:", individualProxyAdmin);
        
        // Verify the individual proxy admin is owned by ProxyAdminV1 (or deployer)
        address individualAdminOwner = ProxyAdmin(individualProxyAdmin).owner();
        console2.log("Individual Proxy Admin owner:", individualAdminOwner);
        
        // Check if deployer can upgrade
        if (individualAdminOwner != deployer && individualAdminOwner != proxyAdminV1) {
            console2.log("[ERROR] Deployer cannot upgrade this proxy!");
            revert("Not authorized to upgrade");
        }
        
        // Read current state
        ItemToken1155 proxy = ItemToken1155(itemTokenProxyV1);
        console2.log("Current proxy name:", proxy.name());
        console2.log("");

        // IMPORTANT: If individual ProxyAdmin is owned by ProxyAdminV1 (a contract),
        // we cannot call it directly from the deployer EOA.
        // We need to transfer ownership first, then upgrade, then transfer back.
        if (individualAdminOwner == proxyAdminV1) {
            console2.log("[INFO] Individual ProxyAdmin is owned by ProxyAdminV1 (contract)");
            console2.log("[INFO] Need to transfer ownership to deployer first");
            console2.log("");
            
            vm.startBroadcast(deployerPrivateKey);
            
            // Transfer ownership from ProxyAdminV1 to deployer
            // NOTE: This will fail because ProxyAdminV1 is a contract and cannot sign transactions.
            // The individual ProxyAdmin's owner must be an EOA or multi-sig.
            // If ProxyAdminV1 is a multi-sig, submit the transferOwnership transaction through the multi-sig.
            // If ProxyAdminV1 is a regular contract, you may need to use a helper contract approach.
            console2.log("Attempting to transfer ownership...");
            console2.log("[WARNING] This will fail if ProxyAdminV1 is a contract without call capability");
            
            // Try to transfer ownership - this will fail if ProxyAdminV1 is a contract
            try ProxyAdmin(individualProxyAdmin).transferOwnership(deployer) {
                console2.log("Ownership transferred to deployer");
            } catch {
                console2.log("[ERROR] Cannot transfer ownership - ProxyAdminV1 is a contract");
                console2.log("[SOLUTION] Use multi-sig or helper contract to transfer ownership first");
                revert("Ownership transfer required");
            }
            
            // Now upgrade
            console2.log("Upgrading proxy (plain upgrade, no re-init)...");
            ProxyAdmin(individualProxyAdmin).upgradeAndCall(
                ITransparentUpgradeableProxy(itemTokenProxyV1),
                newImpl,
                ""
            );
            
            // Transfer ownership back
            console2.log("Transferring ownership back to ProxyAdminV1...");
            ProxyAdmin(individualProxyAdmin).transferOwnership(proxyAdminV1);
            
            vm.stopBroadcast();
        } else {
            // Individual ProxyAdmin is directly owned by deployer - can upgrade directly
            console2.log("Individual ProxyAdmin is directly owned by deployer");
            
            vm.startBroadcast(deployerPrivateKey);

            // Call the individual ProxyAdmin to upgrade the proxy
            // Note: ProxyAdmin v5.2.0 only has upgradeAndCall, not upgrade.
            // Passing empty bytes performs a plain upgrade without calling any function.
            console2.log("Upgrading proxy (plain upgrade, no re-init)...");
            ProxyAdmin(individualProxyAdmin).upgradeAndCall(
                ITransparentUpgradeableProxy(itemTokenProxyV1),
                newImpl,
                ""
            );
            
            vm.stopBroadcast();
        }

        // Verify upgrade succeeded
        console2.log("");
        console2.log("[OK] Upgrade complete!");
        console2.log("Verification:");
        console2.log("  name:", proxy.name());
        console2.log("  symbol:", proxy.symbol());
        console2.log("  externalImageBaseURI:", proxy.externalImageBaseURI());
        console2.log("  (empty baseURI is expected - will be set in next step)");
        console2.log("");
        console2.log("Next step: Run SetExternalImageBaseURI.s.sol to configure the base URI");
    }
}
