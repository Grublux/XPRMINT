// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {ItemImageDeployer} from "../../contracts/stabilization/items/ItemImageDeployer.sol";

/**
 * @title ItemImageDeployerTest
 * @notice Test SSTORE2 write/read functionality
 */
contract ItemImageDeployerTest is Test {
    ItemImageDeployer public deployer;

    function setUp() public {
        deployer = new ItemImageDeployer();
    }

    function test_DeployImage_ReadsBackCorrectly() public {
        bytes memory testData = hex"01020304";
        
        // Deploy image to SSTORE2
        address imagePtr = deployer.deployImage(testData);
        
        // Verify pointer is non-zero
        assertNotEq(imagePtr, address(0), "imagePtr should not be zero");
        
        // Verify SSTORE2 contract has code
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(imagePtr)
        }
        assertGt(codeSize, 0, "SSTORE2 contract should have code");
        
        // Read back the bytes
        bytes memory readData = deployer.readImage(imagePtr);
        
        // Verify data matches
        assertEq(readData.length, testData.length, "Read data length should match");
        assertEq(keccak256(readData), keccak256(testData), "Read data should match original");
    }

    function test_DeployImage_WithLargerData() public {
        bytes memory testData = new bytes(1000);
        for (uint256 i = 0; i < 1000; i++) {
            testData[i] = bytes1(uint8(i % 256));
        }
        
        address imagePtr = deployer.deployImage(testData);
        assertNotEq(imagePtr, address(0), "imagePtr should not be zero");
        
        bytes memory readData = deployer.readImage(imagePtr);
        assertEq(readData.length, testData.length, "Read data length should match");
        assertEq(keccak256(readData), keccak256(testData), "Read data should match original");
    }

    function test_ReadImage_ReturnsEmptyForZeroAddress() public {
        bytes memory readData = deployer.readImage(address(0));
        assertEq(readData.length, 0, "Should return empty bytes for zero address");
    }
}




