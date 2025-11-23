// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title OwnershipTransferViaProxy
 * @notice Temporary implementation that transfers ProxyAdmin ownership during initialization
 * @dev Compatible with ItemCatalog's upgradeable pattern
 */
contract OwnershipTransferViaProxy is Initializable, OwnableUpgradeable {
    /**
     * @notice Initialize and transfer ownership of ProxyAdmins
     * @param proxyAdmins Array of ProxyAdmin addresses to transfer ownership of
     * @param newOwner New owner address
     */
    function initialize(address[] calldata proxyAdmins, address newOwner) external initializer {
        __Ownable_init(msg.sender);
        
        for (uint256 i = 0; i < proxyAdmins.length; i++) {
            Ownable(proxyAdmins[i]).transferOwnership(newOwner);
        }
    }
}

