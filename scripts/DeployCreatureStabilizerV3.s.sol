// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {CreatureStabilizer} from "../contracts/stabilization/CreatureStabilizer.sol";

/**
 * @title DeployCreatureStabilizerV3
 * @notice Deploys CreatureStabilizerV3 proxy using ProxyAdminV3
 * @dev 
 * V3 RULE: Uses ProxyAdminV3 directly as the admin.
 * TransparentUpgradeableProxy does NOT deploy ProxyAdmins - we pass ProxyAdminV3
 * as the admin parameter, ensuring all V3 proxies use the same ProxyAdminV3.
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export PROXY_ADMIN_V3=<proxy_admin_v3_address>
 *   export STAB_IMPL_V2=0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8
 *   export ITEM_CATALOG_PROXY_V1=<catalog_proxy_address>
 *   export DAY_SECONDS_V3=86400
 *   export ENTROPY_SEED_V3=<entropy_seed_bytes32>
 * 
 *   forge script scripts/DeployCreatureStabilizerV3.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast
 */
contract DeployCreatureStabilizerV3 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        address proxyAdminV3 = vm.envAddress("PROXY_ADMIN_V3");
        address impl = vm.envAddress("STAB_IMPL_V2");
        address catalog = vm.envAddress("ITEM_CATALOG_PROXY_V1");
        uint256 daySeconds = vm.envUint("DAY_SECONDS_V3");
        bytes32 entropy = vm.envBytes32("ENTROPY_SEED_V3");

        console2.log("=== Deploy CreatureStabilizerV3 ===");
        console2.log("Deployer:", deployer);
        console2.log("ProxyAdminV3:", proxyAdminV3);
        console2.log("Implementation:", impl);
        console2.log("ItemCatalog V1:", catalog);
        console2.log("DAY_SECONDS:", daySeconds);
        console2.log("ENTROPY_SEED:", vm.toString(entropy));
        console2.log("");

        // Verify ProxyAdminV3 ownership
        ProxyAdmin admin = ProxyAdmin(proxyAdminV3);
        require(admin.owner() == deployer, "ProxyAdminV3 owner is not deployer");

        // Initialize with itemToken = address(0) (we wire later via setItemToken)
        bytes memory initData = abi.encodeWithSelector(
            CreatureStabilizer.initialize.selector,
            address(0),  // _itemToken - will be set via setItemToken after ITEM_V3 is deployed
            catalog,     // _itemCatalog
            daySeconds,  // _daySeconds
            entropy      // _entropySeed
        );

        vm.startBroadcast(deployerPrivateKey);

        // Deploy proxy with ProxyAdminV3 as the admin
        // TransparentUpgradeableProxy constructor takes (implementation, initialOwner, data)
        // We pass ProxyAdminV3 as initialOwner so it becomes the admin
        TransparentUpgradeableProxy stabV3 = new TransparentUpgradeableProxy(
            impl,
            proxyAdminV3,  // ProxyAdminV3 is the admin
            initData
        );
        address stabV3Addr = address(stabV3);
        
        vm.stopBroadcast();

        // Verify ProxyAdminV3 is the admin of the proxy
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        address proxyAdmin = address(uint160(uint256(vm.load(stabV3Addr, adminSlot))));
        
        require(proxyAdmin == proxyAdminV3, "STAB_V3 admin is not ProxyAdminV3");

        console2.log("");
        console2.log("=== CreatureStabilizerV3 Deployment Summary ===");
        console2.log("STAB_V3 deployed at:", stabV3Addr);
        console2.log("STAB_V3 admin:", proxyAdmin);
        console2.log("Expected admin (ProxyAdminV3):", proxyAdminV3);
        console2.log("");
        console2.log("export CREATURE_STABILIZER_PROXY_V3=", stabV3Addr);
        console2.log("");
        console2.log("[OK] STAB_V3 is administered by ProxyAdminV3");
        console2.log("[OK] ProxyAdminV3 is owned by deployer EOA (allows upgrades)");
        console2.log("");
        console2.log("Next: Deploy ItemToken1155V3, then wire STAB_V3 to ITEM_V3");
    }
}

// ============================================================================
// V3 ADMIN INVARIANTS:
// ============================================================================
// - Exactly one ProxyAdminV3 (deployed separately via DeployStabilizationProxyAdminV3.s.sol)
// - ProxyAdminV3.owner == deployer EOA (no contract, no multisig, no nested ProxyAdmin)
// - STAB_V3 admin == ProxyAdminV3
// - ITEM_V3 admin == ProxyAdminV3
// - No nested or per-proxy ProxyAdmins
// - Old V0/V1/V2 proxies are legacy and never upgraded again
//
// LEGACY PATTERNS (DO NOT REPEAT):
// - V0/V1: Proxies used ProxyAdminV1 (contract) as admin, which was owned by another contract
//   → Made upgrades impossible because contracts can't sign transactions
// - V2: Individual ProxyAdmins owned by deployer EOA (correct ownership, but per-proxy admins)
//   → Still created per-proxy admins instead of using single ProxyAdminV3
// - V3: All proxies use single ProxyAdminV3, owned by deployer EOA
//   → Clean architecture with single admin and direct upgradeability
//
// FILES THAT DEPLOY PROXYADMINS (LEGACY):
// - scripts/DeployStabilizationSystem.s.sol (V0 - creates ProxyAdmin per deployment)
// - scripts/DeployStabilizationSystemV1.s.sol (V1 - creates ProxyAdminV1, but proxies create individual admins)
// - scripts/DeployItemToken1155V2.s.sol (V2 - creates individual ProxyAdmin owned by deployer)
// - scripts/DeployCreatureStabilizerV2.s.sol (V2 - creates individual ProxyAdmin owned by deployer)
//
// FILES THAT USE OLD PROXYADMIN ADDRESSES (LEGACY):
// - All V0/V1/V2 scripts reference PROXY_ADMIN_V1 or individual ProxyAdmins
// - V3 scripts ONLY reference PROXY_ADMIN_V3 (deployed separately)
//
// FILES THAT DEPLOY TRANSPARENTUPGRADEABLEPROXY (LEGACY):
// - scripts/DeployStabilizationSystem.s.sol (V0 proxies)
// - scripts/DeployStabilizationSystemV1.s.sol (V1 proxies - nested admin issue)
// - scripts/DeployItemToken1155V2.s.sol (V2 proxy - correct pattern but per-proxy admin)
// - scripts/DeployCreatureStabilizerV3.s.sol (V3 proxy - correct pattern)
// - scripts/DeployItemToken1155V3.s.sol (V3 proxy - correct pattern)

