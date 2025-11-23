// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title OwnershipTransferUpgrade
 * @notice Temporary upgrade contract that transfers ProxyAdmin ownership
 * @dev This contract is used as a temporary implementation during upgrade
 *      to transfer ownership of ProxyAdmins, then immediately upgraded away
 */
contract OwnershipTransferUpgrade {
    address[] public proxyAdmins;
    address public newOwner;
    bool public ownershipTransferred;
    
    /**
     * @notice Initialize and transfer ownership
     * @param _proxyAdmins Array of ProxyAdmin addresses
     * @param _newOwner New owner address
     */
    function initialize(address[] calldata _proxyAdmins, address _newOwner) external {
        require(!ownershipTransferred, "Already transferred");
        proxyAdmins = _proxyAdmins;
        newOwner = _newOwner;
        
        for (uint256 i = 0; i < _proxyAdmins.length; i++) {
            Ownable(_proxyAdmins[i]).transferOwnership(_newOwner);
        }
        
        ownershipTransferred = true;
    }
}


