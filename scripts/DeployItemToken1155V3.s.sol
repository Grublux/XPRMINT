// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";

/**
 * @title DeployItemToken1155V3
 * @notice Deploys ItemToken1155V3 proxy using ProxyAdminV3
 * @dev 
 * V3 RULE: Uses ProxyAdminV3 directly as the admin.
 * TransparentUpgradeableProxy does NOT deploy ProxyAdmins - we pass ProxyAdminV3
 * as the admin parameter, ensuring all V3 proxies use the same ProxyAdminV3.
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export PROXY_ADMIN_V3=<proxy_admin_v3_address>
 *   export ITEM_IMPL_V2=<item_token_implementation_address>
 *   export ITEM_CATALOG_PROXY_V1=<catalog_proxy_address>
 *   export CREATURE_STABILIZER_PROXY_V3=<stabilizer_v3_proxy_address>
 * 
 *   forge script scripts/DeployItemToken1155V3.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast
 */
contract DeployItemToken1155V3 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        address proxyAdminV3 = vm.envAddress("PROXY_ADMIN_V3");
        address impl = vm.envAddress("ITEM_IMPL_V2");
        address catalog = vm.envAddress("ITEM_CATALOG_PROXY_V1");
        address stabilizerV3 = vm.envAddress("CREATURE_STABILIZER_PROXY_V3");

        console2.log("=== Deploy ItemToken1155V3 ===");
        console2.log("Deployer:", deployer);
        console2.log("ProxyAdminV3:", proxyAdminV3);
        console2.log("Implementation:", impl);
        console2.log("ItemCatalog V1:", catalog);
        console2.log("CreatureStabilizer V3:", stabilizerV3);
        console2.log("");

        // Verify ProxyAdminV3 ownership
        ProxyAdmin admin = ProxyAdmin(proxyAdminV3);
        require(admin.owner() == deployer, "ProxyAdminV3 owner is not deployer");

        // Initialize with baseURI and catalog
        // Note: ItemToken1155.initialize(string memory baseURI, address _itemCatalog)
        // Name and symbol are set in initialize() to "Stabilization Items V1" and "ITEMS"
        // We can update these later if needed via owner functions
        string memory baseURI = vm.envOr(
            "BASE_URI_V3",
            string("https://api.xprmint.com/items/{id}.json")
        );
        
        bytes memory initData = abi.encodeWithSelector(
            ItemToken1155.initialize.selector,
            baseURI,
            catalog
        );

        vm.startBroadcast(deployerPrivateKey);

        // Deploy proxy with ProxyAdminV3 as the admin
        // TransparentUpgradeableProxy constructor takes (implementation, initialOwner, data)
        // We pass ProxyAdminV3 as initialOwner so it becomes the admin
        TransparentUpgradeableProxy itemV3 = new TransparentUpgradeableProxy(
            impl,
            proxyAdminV3,  // ProxyAdminV3 is the admin
            initData
        );
        address itemV3Addr = address(itemV3);
        
        // Wire ItemToken1155 to CreatureStabilizerV3
        console2.log("Wiring ItemToken1155.setStabilizer to CreatureStabilizerV3...");
        ItemToken1155(itemV3Addr).setStabilizer(stabilizerV3);
        console2.log("Wired ItemToken1155.setStabilizer to CreatureStabilizerV3");
        
        vm.stopBroadcast();

        // Verify ProxyAdminV3 is the admin of the proxy
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        address proxyAdmin = address(uint160(uint256(vm.load(itemV3Addr, adminSlot))));
        
        require(proxyAdmin == proxyAdminV3, "ITEM_V3 admin is not ProxyAdminV3");

        console2.log("");
        console2.log("=== ItemToken1155V3 Deployment Summary ===");
        console2.log("ITEM_V3 deployed at:", itemV3Addr);
        console2.log("ITEM_V3 admin:", proxyAdmin);
        console2.log("Expected admin (ProxyAdminV3):", proxyAdminV3);
        console2.log("");
        console2.log("export ITEM_TOKEN_PROXY_V3=", itemV3Addr);
        console2.log("");
        console2.log("[OK] ITEM_V3 is administered by ProxyAdminV3");
        console2.log("[OK] ProxyAdminV3 is owned by deployer EOA (allows upgrades)");
        console2.log("");
        console2.log("Next: Wire CreatureStabilizerV3 to ITEM_V3, then set externalImageBaseURI");
    }
}

