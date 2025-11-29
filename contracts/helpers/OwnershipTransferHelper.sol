// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title OwnershipTransferHelper
 * @notice Helper contract to transfer ownership of ProxyAdmins
 * @dev This contract can be called by ProxyAdmin through upgradeAndCall
 *      to transfer ownership of individual ProxyAdmins
 */
contract OwnershipTransferHelper {
    /**
     * @notice Transfer ownership of multiple ProxyAdmins
     * @param proxyAdmins Array of ProxyAdmin addresses
     * @param newOwner New owner address
     */
    function transferOwnerships(address[] calldata proxyAdmins, address newOwner) external {
        for (uint256 i = 0; i < proxyAdmins.length; i++) {
            Ownable(proxyAdmins[i]).transferOwnership(newOwner);
        }
    }
    
    /**
     * @notice Receive function to allow ProxyAdmin to call this through upgradeAndCall
     */
    receive() external payable {}
}



