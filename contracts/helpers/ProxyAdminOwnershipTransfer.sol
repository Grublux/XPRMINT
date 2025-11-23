// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ProxyAdminOwnershipTransfer
 * @notice Helper contract to transfer ownership of ProxyAdmins
 * @dev This contract can be called by the main ProxyAdmin (via upgradeAndCall)
 *      to transfer ownership of individual ProxyAdmins to a new owner
 */
contract ProxyAdminOwnershipTransfer {
    /**
     * @notice Transfer ownership of ProxyAdmins
     * @param proxyAdmins Array of ProxyAdmin addresses
     * @param newOwner New owner address
     */
    function transferOwnerships(address[] calldata proxyAdmins, address newOwner) external {
        for (uint256 i = 0; i < proxyAdmins.length; i++) {
            Ownable(proxyAdmins[i]).transferOwnership(newOwner);
        }
    }
    
    /**
     * @notice Fallback - this contract is only used for ownership transfer
     */
    fallback() external payable {
        revert("ProxyAdminOwnershipTransfer: This contract is only for ownership transfer");
    }
    
    receive() external payable {
        revert("ProxyAdminOwnershipTransfer: This contract is only for ownership transfer");
    }
}


