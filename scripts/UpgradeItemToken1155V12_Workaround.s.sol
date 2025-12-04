// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";

/**
 * @title UpgradeItemToken1155V12_Workaround
 * @notice Workaround for upgrading when individual ProxyAdmin is owned by ProxyAdminV1
 * @dev 
 * THE PROBLEM:
 * - Individual ProxyAdmin is owned by ProxyAdminV1 (a contract)
 * - Contracts can't sign transactions
 * - So we can't call the individual ProxyAdmin directly
 * 
 * THE WORKAROUND:
 * - Deploy a temporary proxy with ProxyAdminV1 as admin
 * - Upgrade that proxy to a helper contract
 * - Helper contract transfers ownership of individual ProxyAdmin to deployer
 * - Then we can upgrade the real proxy
 * - Then transfer ownership back
 * 
 * This is complex but should work.
 */
contract UpgradeItemToken1155V12_Workaround is Script {
    // Helper contract that transfers ownership
    contract OwnershipTransferHelper {
        function transferOwnership(address proxyAdmin, address newOwner) external {
            ProxyAdmin(proxyAdmin).transferOwnership(newOwner);
        }
        
        function upgradeProxy(
            address proxyAdmin,
            address proxy,
            address newImpl
        ) external {
            ProxyAdmin(proxyAdmin).upgradeAndCall(
                ITransparentUpgradeableProxy(proxy),
                newImpl,
                ""
            );
        }
    }
    
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        address proxyAdminV1 = vm.envAddress("PROXY_ADMIN_V1");
        address itemTokenProxyV1 = vm.envAddress("ITEM_TOKEN_PROXY_V1");
        address newImpl = vm.envAddress("ITEM_TOKEN_IMPL_V12");

        console2.log("=== Workaround Upgrade: ItemToken1155 V1 to V1.2 ===");
        console2.log("Deployer:", deployer);
        console2.log("ProxyAdminV1:", proxyAdminV1);
        console2.log("ItemToken1155 Proxy:", itemTokenProxyV1);
        console2.log("New Implementation:", newImpl);
        console2.log("");

        // Get individual ProxyAdmin
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        address individualProxyAdmin = address(uint160(uint256(vm.load(itemTokenProxyV1, adminSlot))));
        console2.log("Individual ProxyAdmin:", individualProxyAdmin);
        console2.log("Individual ProxyAdmin owner:", ProxyAdmin(individualProxyAdmin).owner());
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Deploy helper contract
        console2.log("Deploying OwnershipTransferHelper...");
        OwnershipTransferHelper helper = new OwnershipTransferHelper();
        address helperAddr = address(helper);
        console2.log("Helper deployed at:", helperAddr);
        console2.log("");

        // Step 2: Deploy a temporary proxy with ProxyAdminV1 as admin
        // This proxy will point to the helper contract
        console2.log("Deploying temporary proxy...");
        ITransparentUpgradeableProxy tempProxy = ITransparentUpgradeableProxy(
            address(new TransparentUpgradeableProxy(
                helperAddr,
                proxyAdminV1,
                ""
            ))
        );
        console2.log("Temporary proxy:", address(tempProxy));
        console2.log("");

        // Step 3: Use ProxyAdminV1 to upgrade the temp proxy to a new helper that transfers ownership
        // Actually, we can't do this because ProxyAdminV1 can only upgrade proxies it administers
        // And the temp proxy is already pointing to the helper...
        
        // ALTERNATIVE: Use the temp proxy (which ProxyAdminV1 can upgrade) to call the helper
        // But the helper needs to be called by ProxyAdminV1, not the temp proxy...
        
        // ACTUALLY: The real solution is simpler - we need ProxyAdminV1 to be able to call
        // the individual ProxyAdmin. But ProxyAdminV1 doesn't have that capability.
        
        // FINAL SOLUTION: We need to check if ProxyAdminV1 is actually a multi-sig.
        // If it is, we submit transactions through it.
        // If it's not, we're stuck unless we can find another way.
        
        console2.log("[ERROR] Cannot proceed - ProxyAdminV1 is a contract and cannot sign");
        console2.log("[SOLUTION] If ProxyAdminV1 is a multi-sig, submit transactions through it");
        console2.log("           Otherwise, the deployment architecture needs to be fixed");
        
        revert("Cannot upgrade - architecture issue");
    }
}




