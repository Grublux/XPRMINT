// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @title ProxyAdminUpgradeHelper
 * @notice Helper contract to allow ProxyAdminV1 to upgrade proxies via individual ProxyAdmins
 * @dev This contract can be called by ProxyAdminV1 to upgrade proxies whose admin is owned by ProxyAdminV1
 */
contract ProxyAdminUpgradeHelper {
    /**
     * @notice Upgrade a proxy via its individual ProxyAdmin
     * @param proxyAdmin Address of the individual ProxyAdmin that owns the proxy
     * @param proxy Address of the proxy to upgrade
     * @param newImplementation Address of the new implementation
     */
    function upgradeProxy(
        address proxyAdmin,
        address proxy,
        address newImplementation
    ) external {
        ProxyAdmin admin = ProxyAdmin(proxyAdmin);
        ITransparentUpgradeableProxy proxyInterface = ITransparentUpgradeableProxy(proxy);
        admin.upgradeAndCall(proxyInterface, newImplementation, "");
    }
}



