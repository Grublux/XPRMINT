// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ItemToken1155} from "../../contracts/stabilization/items/ItemToken1155.sol";
import {ItemCatalog} from "../../contracts/stabilization/items/ItemCatalog.sol";
import {CreatureStabilizer} from "../../contracts/stabilization/CreatureStabilizer.sol";

/**
 * @title DeployUpgradable
 * @notice Deployment script for upgradeable stabilization system
 */
contract DeployUpgradable is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        console.log("Deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);

        // Deploy ProxyAdmin
        ProxyAdmin proxyAdmin = new ProxyAdmin();
        console.log("ProxyAdmin deployed at:", address(proxyAdmin));

        // Deploy ItemCatalog implementation
        ItemCatalog itemCatalogImpl = new ItemCatalog();
        console.log("ItemCatalog impl deployed at:", address(itemCatalogImpl));

        // Deploy ItemCatalog proxy
        bytes memory catalogInitData = abi.encodeWithSelector(
            ItemCatalog.initialize.selector
        );
        TransparentUpgradeableProxy itemCatalogProxy = new TransparentUpgradeableProxy(
            address(itemCatalogImpl),
            address(proxyAdmin),
            catalogInitData
        );
        console.log("ItemCatalog proxy deployed at:", address(itemCatalogProxy));

        // Deploy ItemToken1155 implementation
        ItemToken1155 itemTokenImpl = new ItemToken1155();
        console.log("ItemToken1155 impl deployed at:", address(itemTokenImpl));

        // Deploy ItemToken1155 proxy
        bytes memory initData = abi.encodeWithSelector(
            ItemToken1155.initialize.selector,
            "https://api.xprmint.com/items/{id}.json",
            address(itemCatalogProxy)
        );
        TransparentUpgradeableProxy itemTokenProxy = new TransparentUpgradeableProxy(
            address(itemTokenImpl),
            address(proxyAdmin),
            initData
        );
        console.log("ItemToken1155 proxy deployed at:", address(itemTokenProxy));

        // Deploy CreatureStabilizer implementation
        CreatureStabilizer stabilizerImpl = new CreatureStabilizer();
        console.log("CreatureStabilizer impl deployed at:", address(stabilizerImpl));

        // Deploy CreatureStabilizer proxy
        bytes memory stabilizerInitData = abi.encodeWithSelector(
            CreatureStabilizer.initialize.selector,
            address(itemTokenProxy),
            address(itemCatalogProxy),
            86400, // 1 day in seconds
            keccak256("XPRMINT_GLOBAL_ENTROPY_V1")
        );
        TransparentUpgradeableProxy stabilizerProxy = new TransparentUpgradeableProxy(
            address(stabilizerImpl),
            address(proxyAdmin),
            stabilizerInitData
        );
        console.log("CreatureStabilizer proxy deployed at:", address(stabilizerProxy));

        // Set stabilizer address in ItemToken1155
        ItemToken1155(address(itemTokenProxy)).setStabilizer(
            address(stabilizerProxy)
        );
        console.log("Stabilizer address set in ItemToken1155");

        vm.stopBroadcast();

        console.log("\n=== Deployment Summary ===");
        console.log("ProxyAdmin:", address(proxyAdmin));
        console.log("ItemCatalog impl:", address(itemCatalogImpl));
        console.log("ItemCatalog proxy:", address(itemCatalogProxy));
        console.log("ItemToken1155 impl:", address(itemTokenImpl));
        console.log("ItemToken1155 proxy:", address(itemTokenProxy));
        console.log("CreatureStabilizer impl:", address(stabilizerImpl));
        console.log("CreatureStabilizer proxy:", address(stabilizerProxy));
    }
}

