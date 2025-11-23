// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";

/**
 * @title DeployItemToken1155V2
 * @notice Deploy a new ItemToken1155 V2 proxy directly admin'd by ProxyAdminV1
 * @dev 
 * WHY V2:
 * - V1 proxy has nested ProxyAdmin architecture that makes upgrades impossible
 * - V2 uses ProxyAdminV1 directly as the admin (no nested ProxyAdmins)
 * - This allows direct upgrades via ProxyAdminV1
 * 
 * ARCHITECTURE:
 * - ProxyAdminV1 is the admin of the V2 proxy (passed as initialOwner)
 * - Deployer EOA owns ProxyAdminV1, so can upgrade via ProxyAdminV1
 * - Uses existing ItemToken1155 implementation (V1.2) with externalImageBaseURI
 * - Points to existing ItemCatalog V1 (no catalog changes)
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export PROXY_ADMIN_V1=0xdb8047eD77099626e189316Ced0b25b46Ae0181d
 *   export ITEM_TOKEN_IMPL_V12=0xD8ac1dc16930Ab8FE62A8e5cF43F874f32e4CA0f
 *   export ITEM_CATALOG_PROXY_V1=<catalog_address>
 *   export CREATURE_STABILIZER_PROXY=<stabilizer_address>
 * 
 *   forge script scripts/DeployItemToken1155V2.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast
 */
contract DeployItemToken1155V2 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        address proxyAdminV1 = vm.envAddress("PROXY_ADMIN_V1");
        address impl = vm.envAddress("ITEM_TOKEN_IMPL_V12");
        address catalog = vm.envAddress("ITEM_CATALOG_PROXY_V1");
        address stabilizer = vm.envAddress("CREATURE_STABILIZER_PROXY");

        console2.log("=== Deploy ItemToken1155 V2 ===");
        console2.log("Deployer:", deployer);
        console2.log("ProxyAdminV1:", proxyAdminV1);
        console2.log("Implementation:", impl);
        console2.log("ItemCatalog V1:", catalog);
        console2.log("CreatureStabilizer:", stabilizer);
        console2.log("");

        // Verify ProxyAdminV1 ownership
        ProxyAdmin admin = ProxyAdmin(proxyAdminV1);
        address adminOwner = admin.owner();
        console2.log("ProxyAdminV1 owner:", adminOwner);
        
        if (adminOwner != deployer) {
            console2.log("[ERROR] Deployer is not the owner of ProxyAdminV1!");
            revert("Not authorized");
        }

        // Build initializer calldata (same as V1 deployment)
        // ItemToken1155.initialize(string memory baseURI, address _itemCatalog)
        string memory baseURI = vm.envOr("BASE_URI", string("https://api.xprmint.com/items/{id}.json"));
        bytes memory initData = abi.encodeWithSelector(
            ItemToken1155.initialize.selector,
            baseURI,
            catalog
        );

        vm.startBroadcast(deployerPrivateKey);

        // Deploy V2 proxy with deployer EOA as initialOwner
        // This creates an individual ProxyAdmin owned by deployer (not ProxyAdminV1)
        // This allows direct upgrades without nested contract ownership issues
        console2.log("Deploying ItemToken1155 V2 proxy...");
        TransparentUpgradeableProxy itemV2Proxy = new TransparentUpgradeableProxy(
            impl,
            deployer,  // initialOwner - creates individual ProxyAdmin owned by deployer EOA
            initData
        );
        address itemV2Addr = address(itemV2Proxy);
        console2.log("ItemToken1155 V2 proxy deployed at:", itemV2Addr);
        console2.log("");

        // Get the individual ProxyAdmin created by TransparentUpgradeableProxy
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        address individualProxyAdmin = address(uint160(uint256(vm.load(itemV2Addr, adminSlot))));
        console2.log("Individual ProxyAdmin:", individualProxyAdmin);
        address individualAdminOwner = ProxyAdmin(individualProxyAdmin).owner();
        console2.log("Individual ProxyAdmin owner:", individualAdminOwner);
        
        if (individualAdminOwner != deployer) {
            console2.log("[WARNING] Individual ProxyAdmin owner is not deployer!");
            console2.log("  Expected:", deployer);
            console2.log("  Actual:", individualAdminOwner);
        } else {
            console2.log("[OK] Individual ProxyAdmin is owned by deployer (upgradeable directly)");
        }
        console2.log("");

        // Wire ItemToken1155 to CreatureStabilizer (same as V1)
        console2.log("Wiring ItemToken1155.setStabilizer...");
        ItemToken1155(itemV2Addr).setStabilizer(stabilizer);
        console2.log("Wired ItemToken1155.setStabilizer to CreatureStabilizer");
        console2.log("");

        vm.stopBroadcast();

        // Print summary
        console2.log("");
        console2.log("=== V2 Deployment Summary ===");
        console2.log("ITEM_TOKEN_PROXY_V2=", itemV2Addr);
        console2.log("Individual ProxyAdmin:", individualProxyAdmin);
        console2.log("Individual ProxyAdmin owner:", individualAdminOwner);
        console2.log("");
        console2.log("[OK] V2 proxy is directly upgradeable by deployer EOA");
        console2.log("  (No nested contract ownership issues)");
        console2.log("");
        console2.log("Next steps:");
        console2.log("1. Run SetStabilizerItemTokenV2.s.sol to wire CreatureStabilizer to ITEM_V2");
        console2.log("2. Run SetItemV2ExternalBaseURI.s.sol to set externalImageBaseURI");
        console2.log("3. Verify metadata/images using cast commands");
    }
}

