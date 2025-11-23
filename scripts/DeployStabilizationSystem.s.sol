// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ItemCatalog} from "../contracts/stabilization/items/ItemCatalog.sol";
import {ItemImageDeployer} from "../contracts/stabilization/items/ItemImageDeployer.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";
import {CreatureStabilizer} from "../contracts/stabilization/CreatureStabilizer.sol";

/**
 * @title DeployStabilizationSystem
 * @notice Full system deployment script for stabilization contracts
 * @dev Deploys all components and wires them together
 */
contract DeployStabilizationSystem is Script {
    struct DeploymentAddresses {
        address proxyAdmin;
        address itemCatalogImpl;
        address itemCatalogProxy;
        address itemImageDeployer;
        address itemTokenImpl;
        address itemTokenProxy;
        address stabilizerImpl;
        address stabilizerProxy;
    }

    function run() external returns (DeploymentAddresses memory addrs) {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        if (deployerPrivateKey == 0) {
            deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        }
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        console.log("Deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);
        console.log("Chain ID:", block.chainid);

        uint256 daySeconds = vm.envOr("STAB_DAY_SECONDS", vm.envOr("DAY_SECONDS", uint256(86400)));
        bytes32 entropySeed = vm.envOr(
            "STAB_ENTROPY_SEED",
            vm.envOr("ENTROPY_SEED", keccak256("XPRMINT_GLOBAL_ENTROPY_V1"))
        );
        string memory baseURI = vm.envOr(
            "BASE_URI",
            string("https://api.xprmint.com/items/{id}.json")
        );

        addrs.proxyAdmin = _deployProxyAdmin(deployer);
        addrs.itemImageDeployer = _deployImageDeployer();
        (addrs.itemCatalogImpl, addrs.itemCatalogProxy) = _deployCatalog(addrs.proxyAdmin);
        (addrs.itemTokenImpl, addrs.itemTokenProxy) = _deployItemToken(addrs.proxyAdmin, addrs.itemCatalogProxy, baseURI);
        (addrs.stabilizerImpl, addrs.stabilizerProxy) = _deployStabilizer(
            addrs.proxyAdmin,
            addrs.itemTokenProxy,
            addrs.itemCatalogProxy,
            daySeconds,
            entropySeed
        );

        _wireStabilizer(addrs.itemTokenProxy, addrs.stabilizerProxy);

        vm.stopBroadcast();

        _logSummary(addrs);
    }

    function _deployProxyAdmin(address owner) internal returns (address) {
        ProxyAdmin proxyAdmin = new ProxyAdmin(owner);
        address addr = address(proxyAdmin);
        console.log("ProxyAdmin:", addr);
        return addr;
    }

    function _deployImageDeployer() internal returns (address) {
        ItemImageDeployer imageDeployer = new ItemImageDeployer();
        address addr = address(imageDeployer);
        console.log("ItemImageDeployer:", addr);
        return addr;
    }

    function _deployCatalog(address proxyAdminAddr) internal returns (address impl, address proxy) {
        ItemCatalog catalogImpl = new ItemCatalog();
        impl = address(catalogImpl);
        console.log("ItemCatalog impl:", impl);

        bytes memory initData = abi.encodeWithSelector(ItemCatalog.initialize.selector);
        TransparentUpgradeableProxy catalogProxy = new TransparentUpgradeableProxy(
            impl,
            proxyAdminAddr,
            initData
        );
        proxy = address(catalogProxy);
        console.log("ItemCatalog proxy:", proxy);
    }

    function _deployItemToken(
        address proxyAdminAddr,
        address catalogProxy,
        string memory baseURI
    ) internal returns (address impl, address proxy) {
        ItemToken1155 itemTokenImpl = new ItemToken1155();
        impl = address(itemTokenImpl);
        console.log("ItemToken1155 impl:", impl);

        bytes memory initData = abi.encodeWithSelector(
            ItemToken1155.initialize.selector,
            baseURI,
            catalogProxy
        );
        TransparentUpgradeableProxy itemTokenProxy = new TransparentUpgradeableProxy(
            impl,
            proxyAdminAddr,
            initData
        );
        proxy = address(itemTokenProxy);
        console.log("ItemToken1155 proxy:", proxy);
    }

    function _deployStabilizer(
        address proxyAdminAddr,
        address itemTokenProxy,
        address catalogProxy,
        uint256 daySeconds,
        bytes32 entropySeed
    ) internal returns (address impl, address proxy) {
        CreatureStabilizer stabilizerImpl = new CreatureStabilizer();
        impl = address(stabilizerImpl);
        console.log("CreatureStabilizer impl:", impl);

        bytes memory initData = abi.encodeWithSelector(
            CreatureStabilizer.initialize.selector,
            itemTokenProxy,
            catalogProxy,
            daySeconds,
            entropySeed
        );
        TransparentUpgradeableProxy stabilizerProxy = new TransparentUpgradeableProxy(
            impl,
            proxyAdminAddr,
            initData
        );
        proxy = address(stabilizerProxy);
        console.log("CreatureStabilizer proxy:", proxy);
    }

    function _wireStabilizer(address itemTokenProxy, address stabilizerProxy) internal {
        ItemToken1155(itemTokenProxy).setStabilizer(stabilizerProxy);
        console.log("Stabilizer address set in ItemToken1155");
    }

    function _logSummary(DeploymentAddresses memory addrs) internal view {
        console.log("\n=== Deployment Summary ===");
        console.log("ProxyAdmin:", addrs.proxyAdmin);
        console.log("ItemCatalog impl:", addrs.itemCatalogImpl);
        console.log("ItemCatalog proxy:", addrs.itemCatalogProxy);
        console.log("ItemImageDeployer:", addrs.itemImageDeployer);
        console.log("ItemToken1155 impl:", addrs.itemTokenImpl);
        console.log("ItemToken1155 proxy:", addrs.itemTokenProxy);
        console.log("CreatureStabilizer impl:", addrs.stabilizerImpl);
        console.log("CreatureStabilizer proxy:", addrs.stabilizerProxy);

        console.log("\n=== Next Steps ===");
        console.log("1. Populate ItemCatalog using DeployItemCatalog.s.sol");
        console.log("2. Update frontend with these addresses");
        console.log("3. Verify contracts on block explorer");
    }
}
