// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";
import {CreatureStabilizer} from "../contracts/stabilization/CreatureStabilizer.sol";

/**
 * @title DeployStabilizationSystemV3
 * @notice Orchestrates complete V3 deployment with single ProxyAdminV3 architecture
 * @dev 
 * V3 RULE: Exactly one ProxyAdminV3, owned by deployer EOA.
 * All V3 proxies use deployer EOA as initialOwner, creating individual ProxyAdmins
 * owned by deployer (not by ProxyAdminV3). This allows direct upgrades.
 * 
 * ProxyAdminV3 serves as central management for future governance/multi-sig.
 * 
 * LEGACY: V0/V1/V2 proxies remain on-chain but are NEVER upgraded again.
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export CATALOG_V1=0x06266255ee081AcA64328dE8fcc939923eE6e8c8
 *   export DAY_SECONDS_V3=86400
 *   export ENTROPY_SEED_V3=<bytes32_entropy_seed>
 * 
 *   # Dry-run:
 *   forge script scripts/DeployStabilizationSystemV3.s.sol --rpc-url $RPC
 * 
 *   # Deploy:
 *   forge script scripts/DeployStabilizationSystemV3.s.sol --rpc-url $RPC --broadcast
 */
contract DeployStabilizationSystemV3 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        address catalogV1 = vm.envAddress("CATALOG_V1");
        uint256 daySeconds = vm.envOr("DAY_SECONDS_V3", vm.envOr("DAY_SECONDS", uint256(86400)));
        bytes32 entropySeed = vm.envOr(
            "ENTROPY_SEED_V3",
            vm.envOr("ENTROPY_SEED", keccak256("XPRMINT_GLOBAL_ENTROPY_V3"))
        );
        string memory baseURI = vm.envOr(
            "BASE_URI_V3",
            string("https://api.xprmint.com/items/{id}.json")
        );

        console2.log("=== Deploy Stabilization System V3 ===");
        console2.log("Deployer:", deployer);
        console2.log("Catalog V1:", catalogV1);
        console2.log("DAY_SECONDS:", daySeconds);
        console2.log("ENTROPY_SEED:", vm.toString(entropySeed));
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Deploy ProxyAdminV3
        address proxyAdminV3Addr = _deployProxyAdminV3(deployer);

        // Step 2-3: Deploy ITEM_V3
        address itemV3Addr = _deployItemV3(deployer, catalogV1, baseURI);

        // Step 4-5: Deploy STAB_V3
        address stabV3Addr = _deployStabV3(deployer, itemV3Addr, catalogV1, daySeconds, entropySeed);

        // Step 6: Wire ITEM_V3 to STAB_V3
        _wireItemToStab(itemV3Addr, stabV3Addr);

        vm.stopBroadcast();

        // Step 7: Verify V3 invariants
        console2.log("Step 7: Verifying V3 invariants...");
        _verifyV3Invariants(deployer, proxyAdminV3Addr, itemV3Addr, stabV3Addr);
        console2.log("");

        // Step 8: Print export lines
        console2.log("=== V3 Deployment Summary ===");
        console2.log("export PROXY_ADMIN_V3=", proxyAdminV3Addr);
        console2.log("export ITEM_V3=", itemV3Addr);
        console2.log("export STAB_V3=", stabV3Addr);
        console2.log("");
        console2.log("[OK] V3 deployment complete!");
        console2.log("[OK] All invariants verified");
        console2.log("");
        console2.log("Next steps:");
        console2.log("1. Set externalImageBaseURI on ITEM_V3 (if needed)");
        console2.log("2. Run smoke tests to verify gameplay");
        console2.log("3. Verify contracts on ApeScan");
    }

    function _deployProxyAdminV3(address deployer) internal returns (address) {
        console2.log("Step 1: Deploying ProxyAdminV3...");
        ProxyAdmin proxyAdminV3 = new ProxyAdmin(deployer);
        address addr = address(proxyAdminV3);
        console2.log("ProxyAdminV3 deployed at:", addr);
        require(proxyAdminV3.owner() == deployer, "V3: ProxyAdminV3 owner is not deployer EOA");
        console2.log("ProxyAdminV3 owner:", proxyAdminV3.owner());
        console2.log("");
        return addr;
    }

    function _deployItemV3(
        address deployer,
        address catalogV1,
        string memory baseURI
    ) internal returns (address) {
        console2.log("Step 2: Deploying ItemToken1155 V3 implementation...");
        ItemToken1155 itemImpl = new ItemToken1155();
        address itemImplAddr = address(itemImpl);
        console2.log("ItemToken1155 V3 impl:", itemImplAddr);
        console2.log("");

        console2.log("Step 3: Deploying ITEM_V3 proxy...");
        bytes memory itemInitData = abi.encodeWithSelector(
            ItemToken1155.initialize.selector,
            baseURI,
            catalogV1
        );
        
        TransparentUpgradeableProxy itemV3 = new TransparentUpgradeableProxy(
            itemImplAddr,
            deployer,
            itemInitData
        );
        address itemV3Addr = address(itemV3);
        console2.log("ITEM_V3 proxy deployed at:", itemV3Addr);
        console2.log("");
        return itemV3Addr;
    }

    function _deployStabV3(
        address deployer,
        address itemV3Addr,
        address catalogV1,
        uint256 daySeconds,
        bytes32 entropySeed
    ) internal returns (address) {
        console2.log("Step 4: Deploying CreatureStabilizer V3 implementation...");
        CreatureStabilizer stabImpl = new CreatureStabilizer();
        address stabImplAddr = address(stabImpl);
        console2.log("CreatureStabilizer V3 impl:", stabImplAddr);
        console2.log("");

        console2.log("Step 5: Deploying STAB_V3 proxy...");
        bytes memory stabInitData = abi.encodeWithSelector(
            CreatureStabilizer.initialize.selector,
            itemV3Addr,
            catalogV1,
            daySeconds,
            entropySeed
        );
        
        TransparentUpgradeableProxy stabV3 = new TransparentUpgradeableProxy(
            stabImplAddr,
            deployer,
            stabInitData
        );
        address stabV3Addr = address(stabV3);
        console2.log("STAB_V3 proxy deployed at:", stabV3Addr);
        console2.log("");
        return stabV3Addr;
    }

    function _wireItemToStab(address itemV3Addr, address stabV3Addr) internal {
        console2.log("Step 6: Wiring ItemToken1155.setStabilizer to CreatureStabilizerV3...");
        ItemToken1155(itemV3Addr).setStabilizer(stabV3Addr);
        console2.log("Wired ItemToken1155.setStabilizer to CreatureStabilizerV3");
        console2.log("");
    }

    function _verifyV3Invariants(
        address deployer,
        address proxyAdminV3,
        address itemV3,
        address stabV3
    ) internal view {
        // Verify ProxyAdminV3 owner is deployer EOA
        ProxyAdmin admin = ProxyAdmin(proxyAdminV3);
        require(admin.owner() == deployer, "V3: ProxyAdminV3 owner is not deployer EOA");
        console2.log("[OK] ProxyAdminV3.owner() == deployer EOA");

        // Verify ITEM_V3 owner is deployer EOA
        ItemToken1155 item = ItemToken1155(itemV3);
        require(item.owner() == deployer, "V3: ITEM_V3 owner is not deployer EOA");
        console2.log("[OK] ITEM_V3.owner() == deployer EOA");

        // Verify STAB_V3 owner is deployer EOA
        CreatureStabilizer stab = CreatureStabilizer(stabV3);
        require(stab.owner() == deployer, "V3: STAB_V3 owner is not deployer EOA");
        console2.log("[OK] STAB_V3.owner() == deployer EOA");

        // Verify ITEM_V3 individual ProxyAdmin is owned by deployer
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        address itemProxyAdmin = address(uint160(uint256(vm.load(itemV3, adminSlot))));
        require(ProxyAdmin(itemProxyAdmin).owner() == deployer, "V3: ITEM_V3 ProxyAdmin owner is not deployer");
        console2.log("[OK] ITEM_V3 ProxyAdmin.owner() == deployer EOA");

        // Verify STAB_V3 individual ProxyAdmin is owned by deployer
        address stabProxyAdmin = address(uint160(uint256(vm.load(stabV3, adminSlot))));
        require(ProxyAdmin(stabProxyAdmin).owner() == deployer, "V3: STAB_V3 ProxyAdmin owner is not deployer");
        console2.log("[OK] STAB_V3 ProxyAdmin.owner() == deployer EOA");

        // Verify STAB_V3 is wired to ITEM_V3
        require(stab.itemToken() == itemV3, "V3: STAB_V3.itemToken() != ITEM_V3");
        console2.log("[OK] STAB_V3.itemToken() == ITEM_V3");
    }
}

// ============================================================================
// V3 ADMIN INVARIANTS:
// ============================================================================
// - Exactly one ProxyAdminV3 (owned by deployer EOA)
// - ITEM_V3 ProxyAdmin.owner == deployer EOA (allows direct upgrades)
// - STAB_V3 ProxyAdmin.owner == deployer EOA (allows direct upgrades)
// - ITEM_V3.owner == deployer EOA
// - STAB_V3.owner == deployer EOA
// - STAB_V3.itemToken == ITEM_V3
// - No nested ProxyAdmins (no contracts owning ProxyAdmins)
// - Old V0/V1/V2 proxies are legacy and never upgraded again
//
// LEGACY PATTERNS (DO NOT REPEAT):
// - V0/V1: Proxies used ProxyAdminV1 (contract) as initialOwner
//   → Created ProxyAdmins owned by ProxyAdminV1 (contract)
//   → Made upgrades impossible because contracts can't sign transactions
// - V2: Individual ProxyAdmins owned by deployer EOA (correct ownership)
//   → But still created per-proxy admins instead of single ProxyAdminV3
// - V3: Individual ProxyAdmins owned by deployer EOA, ProxyAdminV3 for central management
//   → Clean architecture with direct upgradeability

