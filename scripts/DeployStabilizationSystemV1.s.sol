// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ItemCatalog} from "../contracts/stabilization/items/ItemCatalog.sol";
import {ItemImageDeployer} from "../contracts/stabilization/items/ItemImageDeployer.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";
import {CreatureStabilizer} from "../contracts/stabilization/CreatureStabilizer.sol";

/**
 * @title DeployStabilizationSystemV1
 * @notice Clean v1 deployment with single central ProxyAdminV1 owned by deployer
 * @dev Deploys all v1 components with proper upgradeability topology
 */
contract DeployStabilizationSystemV1 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        console2.log("Deployer:", deployer);
        console2.log("Deployer balance:", deployer.balance);
        console2.log("Chain ID:", block.chainid);

        // Read configuration from env
        uint256 daySeconds = vm.envOr("STAB_DAY_SECONDS", vm.envOr("DAY_SECONDS", uint256(86400)));
        bytes32 entropySeed = vm.envOr(
            "STAB_ENTROPY_SEED",
            vm.envOr("ENTROPY_SEED", keccak256("XPRMINT_GLOBAL_ENTROPY_V1"))
        );
        string memory baseURI = vm.envOr(
            "BASE_URI",
            string("https://api.xprmint.com/items/{id}.json")
        );

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Deploy single central ProxyAdminV1 owned by deployer
        address proxyAdminV1Addr = _deployProxyAdminV1(deployer);

        // Step 2: Deploy ItemImageDeployerV1
        address imageDeployerV1Addr = _deployImageDeployerV1();

        // Step 3: Deploy ItemCatalog implementation and proxy
        address catalogProxyAddr = _deployCatalogV1(proxyAdminV1Addr);

        // Step 4: Deploy ItemToken1155 implementation and proxy
        address itemTokenProxyAddr = _deployItemTokenV1(proxyAdminV1Addr, catalogProxyAddr, baseURI);

        // Step 5: Deploy CreatureStabilizer implementation and proxy
        address stabilizerProxyAddr = _deployStabilizerV1(
            proxyAdminV1Addr,
            itemTokenProxyAddr,
            catalogProxyAddr,
            daySeconds,
            entropySeed
        );

        // Step 6: Wire ItemToken1155 to CreatureStabilizer
        _wireStabilizerV1(itemTokenProxyAddr, stabilizerProxyAddr);

        vm.stopBroadcast();

        // Print summary for easy copy-paste
        console2.log("\n=== V1 DEPLOYMENT SUMMARY ===");
        console2.log("export STAB_V1=", stabilizerProxyAddr);
        console2.log("export ITEM_V1=", itemTokenProxyAddr);
        console2.log("export CATALOG_V1=", catalogProxyAddr);
        console2.log("export PROXY_ADMIN_V1=", proxyAdminV1Addr);
        console2.log("export ITEM_IMAGE_DEPLOYER_V1=", imageDeployerV1Addr);
    }

    function _deployProxyAdminV1(address owner) internal returns (address) {
        ProxyAdmin proxyAdminV1 = new ProxyAdmin(owner);
        address addr = address(proxyAdminV1);
        console2.log("ProxyAdminV1:", addr);
        return addr;
    }

    function _deployImageDeployerV1() internal returns (address) {
        ItemImageDeployer imageDeployerV1 = new ItemImageDeployer();
        address addr = address(imageDeployerV1);
        console2.log("ItemImageDeployerV1:", addr);
        return addr;
    }

    function _deployCatalogV1(address proxyAdminV1Addr) internal returns (address) {
        ItemCatalog catalogImpl = new ItemCatalog();
        address catalogImplAddr = address(catalogImpl);
        console2.log("ItemCatalog impl:", catalogImplAddr);

        bytes memory catalogInitData = abi.encodeWithSelector(ItemCatalog.initialize.selector);
        TransparentUpgradeableProxy catalogProxy = new TransparentUpgradeableProxy(
            catalogImplAddr,
            proxyAdminV1Addr,
            catalogInitData
        );
        address catalogProxyAddr = address(catalogProxy);
        console2.log("ItemCatalogProxyV1:", catalogProxyAddr);
        return catalogProxyAddr;
    }

    function _deployItemTokenV1(
        address proxyAdminV1Addr,
        address catalogProxyAddr,
        string memory baseURI
    ) internal returns (address) {
        ItemToken1155 itemTokenImpl = new ItemToken1155();
        address itemTokenImplAddr = address(itemTokenImpl);
        console2.log("ItemToken1155 impl:", itemTokenImplAddr);

        bytes memory itemTokenInitData = abi.encodeWithSelector(
            ItemToken1155.initialize.selector,
            baseURI,
            catalogProxyAddr
        );
        TransparentUpgradeableProxy itemTokenProxy = new TransparentUpgradeableProxy(
            itemTokenImplAddr,
            proxyAdminV1Addr,
            itemTokenInitData
        );
        address itemTokenProxyAddr = address(itemTokenProxy);
        console2.log("ItemTokenProxyV1:", itemTokenProxyAddr);
        return itemTokenProxyAddr;
    }

    function _deployStabilizerV1(
        address proxyAdminV1Addr,
        address itemTokenProxyAddr,
        address catalogProxyAddr,
        uint256 daySeconds,
        bytes32 entropySeed
    ) internal returns (address) {
        CreatureStabilizer stabilizerImpl = new CreatureStabilizer();
        address stabilizerImplAddr = address(stabilizerImpl);
        console2.log("CreatureStabilizer impl:", stabilizerImplAddr);

        bytes memory stabilizerInitData = abi.encodeWithSelector(
            CreatureStabilizer.initialize.selector,
            itemTokenProxyAddr,
            catalogProxyAddr,
            daySeconds,
            entropySeed
        );
        TransparentUpgradeableProxy stabilizerProxy = new TransparentUpgradeableProxy(
            stabilizerImplAddr,
            proxyAdminV1Addr,
            stabilizerInitData
        );
        address stabilizerProxyAddr = address(stabilizerProxy);
        console2.log("CreatureStabilizerProxyV1:", stabilizerProxyAddr);
        return stabilizerProxyAddr;
    }

    function _wireStabilizerV1(address itemTokenProxyAddr, address stabilizerProxyAddr) internal {
        ItemToken1155 itemToken = ItemToken1155(itemTokenProxyAddr);
        itemToken.setStabilizer(stabilizerProxyAddr);
        console2.log("Wired ItemToken1155.setStabilizer to CreatureStabilizer");
    }
}

