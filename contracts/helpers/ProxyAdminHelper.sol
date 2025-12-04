// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ProxyAdminHelper
 * @notice Helper contract to transfer ownership of ProxyAdmins
 * @dev This contract can be called by the main ProxyAdmin to transfer ownership
 *      of individual ProxyAdmins to a new owner
 */
contract ProxyAdminHelper {
    /**
     * @notice Transfer ownership of a ProxyAdmin to a new owner
     * @param proxyAdmin Address of the ProxyAdmin to transfer ownership of
     * @param newOwner New owner address
     */
    function transferProxyAdminOwnership(address proxyAdmin, address newOwner) external {
        Ownable(proxyAdmin).transferOwnership(newOwner);
    }
}




