// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";

/**
 * @title UpgradeItemToken1155V1
 * @notice Upgrade the V1 ItemToken1155 proxy to the new implementation with externalImageBaseURI
 * @dev Uses the single central ProxyAdminV1 to upgrade the proxy
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export PROXY_ADMIN_V1=0xdb8047eD77099626e189316Ced0b25b46Ae0181d
 *   export ITEM_TOKEN_PROXY_V1=0x9c4216d7b56a25b4b8a8eddefebaba389e05a01e
 *   export ITEM_TOKEN_IMPL_V1_2=<new_implementation_address>
 * 
 *   forge script scripts/UpgradeItemToken1155V1.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast
 */
contract UpgradeItemToken1155V1 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        address proxyAdminV1 = vm.envAddress("PROXY_ADMIN_V1");
        address itemTokenProxyV1 = vm.envAddress("ITEM_TOKEN_PROXY_V1");
        address newImpl = vm.envAddress("ITEM_TOKEN_IMPL_V1_2");

        console2.log("=== Upgrade ItemToken1155 V1 Proxy ===");
        console2.log("Deployer:", deployer);
        console2.log("ProxyAdminV1:", proxyAdminV1);
        console2.log("ItemToken1155 Proxy:", itemTokenProxyV1);
        console2.log("New Implementation:", newImpl);
        console2.log("");

        // Verify ProxyAdmin ownership
        ProxyAdmin admin = ProxyAdmin(proxyAdminV1);
        address adminOwner = admin.owner();
        console2.log("ProxyAdminV1 owner:", adminOwner);
        
        if (adminOwner != deployer) {
            console2.log("[ERROR] Deployer is not the owner of ProxyAdminV1!");
            console2.log("   Owner:", adminOwner);
            console2.log("   Deployer:", deployer);
            revert("Not authorized to upgrade");
        }

        vm.startBroadcast(deployerPrivateKey);

        // Upgrade the proxy
        console2.log("Upgrading proxy...");
        ITransparentUpgradeableProxy proxy = ITransparentUpgradeableProxy(itemTokenProxyV1);
        admin.upgradeAndCall(proxy, newImpl, "");
        
        vm.stopBroadcast();

        console2.log("");
        console2.log("[OK] Upgrade complete!");
        console2.log("New implementation:", newImpl);
        console2.log("");
        console2.log("Next step: Run SetExternalImageBaseURI.s.sol to configure the base URI");
    }
}

