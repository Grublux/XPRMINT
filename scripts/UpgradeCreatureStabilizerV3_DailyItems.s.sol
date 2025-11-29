// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import {CreatureStabilizer} from "contracts/stabilization/CreatureStabilizer.sol";

/// @dev Minimal interface for the ProxyAdmin contract that controls the STAB_V3 proxy.
interface IProxyAdmin {
    function owner() external view returns (address);
    function upgradeAndCall(address proxy, address implementation, bytes calldata data) external;
}

/// @notice Upgrade script for STAB_V3 to the implementation that includes getDailyItems() and
///         the internal _previewDailyItems() helper. This script:
///         - Reads the proxy's admin from the EIP-1967 admin slot
///         - Asserts the deployer is the ProxyAdmin owner
///         - Deploys a new CreatureStabilizer implementation
///         - Calls upgradeAndCall(proxy, newImpl, "")
///         - Performs a light sanity check by calling getDailyItems() via the proxy
contract UpgradeCreatureStabilizerV3_DailyItems is Script {
    // EIP-1967 admin slot: keccak256("eip1967.proxy.admin") - 1
    bytes32 internal constant _ADMIN_SLOT = bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1);

    function run() external {
        // --- 1. Load env ---
        address stabProxy = vm.envAddress("STAB_V3");
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        console2.log("[STAB_V3 UPGRADE] Proxy:", stabProxy);
        console2.log("[STAB_V3 UPGRADE] Deployer:", deployer);

        // --- 2. Read admin from EIP-1967 admin slot ---
        bytes32 raw = vm.load(stabProxy, _ADMIN_SLOT);
        address proxyAdminAddr = address(uint160(uint256(raw)));
        console2.log("[STAB_V3 UPGRADE] ProxyAdmin:", proxyAdminAddr);
        require(proxyAdminAddr != address(0), "CreatureStabilizerV3: admin slot is zero");

        IProxyAdmin proxyAdmin = IProxyAdmin(proxyAdminAddr);
        address adminOwner = proxyAdmin.owner();
        console2.log("[STAB_V3 UPGRADE] ProxyAdmin.owner():", adminOwner);
        require(adminOwner == deployer, "CreatureStabilizerV3: deployer is not ProxyAdmin owner");

        // --- 3. Optional: log current implementation (via standard EIP-1967 impl slot) ---
        bytes32 implSlot = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
        bytes32 rawImpl = vm.load(stabProxy, implSlot);
        address oldImpl = address(uint160(uint256(rawImpl)));
        console2.log("[STAB_V3 UPGRADE] Current implementation:", oldImpl);

        vm.startBroadcast(deployerPk);

        // --- 4. Deploy new implementation ---
        CreatureStabilizer newImpl = new CreatureStabilizer();
        address newImplAddr = address(newImpl);
        console2.log("[STAB_V3 UPGRADE] New implementation:", newImplAddr);

        if (newImplAddr == oldImpl) {
            console2.log("[STAB_V3 UPGRADE] New implementation matches current implementation. No upgrade performed.");
            vm.stopBroadcast();
            return;
        }

        // --- 5. Upgrade via ProxyAdmin ---
        // NOTE: We pass empty data because the proxy is already initialized. No re-initializer.
        proxyAdmin.upgradeAndCall(stabProxy, newImplAddr, "");

        vm.stopBroadcast();

        // --- 6. Verify implementation changed ---
        bytes32 rawImplAfter = vm.load(stabProxy, implSlot);
        address implAfter = address(uint160(uint256(rawImplAfter)));
        console2.log("[STAB_V3 UPGRADE] Implementation after upgrade:", implAfter);
        require(implAfter == newImplAddr, "CreatureStabilizerV3: implementation did not update");

        // --- 7. Post-upgrade sanity check: try calling getDailyItems() via proxy ---
        CreatureStabilizer stab = CreatureStabilizer(stabProxy);
        uint256 testCreatureId = 999999; // arbitrary ID; likely uninitialized, so revert is OK

        try stab.getDailyItems(testCreatureId) returns (
            uint32 day,
            uint256[] memory templateIds,
            uint256[] memory amounts
        ) {
            console2.log("[STAB_V3 UPGRADE] getDailyItems() succeeded for creatureId", testCreatureId);
            console2.log("[STAB_V3 UPGRADE]   day:", day);
            console2.log("[STAB_V3 UPGRADE]   templateIds.length:", templateIds.length);
            console2.log("[STAB_V3 UPGRADE]   amounts.length:", amounts.length);
        } catch {
            console2.log(
                "[STAB_V3 UPGRADE] getDailyItems() reverted for creatureId",
                testCreatureId,
                "(this is expected if creature is uninitialized)"
            );
        }

        console2.log("[STAB_V3 UPGRADE] Upgrade completed successfully.");
    }
}


