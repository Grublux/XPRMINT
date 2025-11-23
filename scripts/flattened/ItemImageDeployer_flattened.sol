Compiling 1 files with Solc 0.8.24
Solc 0.8.24 finished in 68.07ms
Compiler run successful!
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// contracts/stabilization/items/ItemImageDeployer.sol

/**
 * @title ItemImageDeployer
 * @notice Helper contract for deploying SSTORE2 image blobs
 * @dev Uses SSTORE2 pattern to store arbitrary bytes and return pointer address
 */
contract ItemImageDeployer {
    /**
     * @notice Deploy image bytes to SSTORE2 and return pointer address
     * @param imageBytes Raw image bytes (PNG, SVG, etc.)
     * @return imagePtr Address of deployed SSTORE2 contract containing image bytes
     */
    function deployImage(
        bytes calldata imageBytes
    ) external returns (address imagePtr) {
        // SSTORE2 pattern: deploy a minimal contract with the bytes as code
        bytes memory bytecode = abi.encodePacked(
            hex"61", // PUSH2
            uint16(imageBytes.length + 1),
            hex"80", // DUP1
            hex"60", // PUSH1
            hex"0e", // offset to data
            hex"60", // PUSH1
            hex"00", // offset
            hex"39", // CODECOPY
            hex"60", // PUSH1
            hex"00", // offset
            hex"f3", // RETURN
            imageBytes
        );

        assembly {
            imagePtr := create(0, add(bytecode, 0x20), mload(bytecode))
        }

        require(imagePtr != address(0), "ItemImageDeployer: deployment failed");
    }

    /**
     * @notice Read bytes from SSTORE2 pointer
     * @param imagePtr SSTORE2 address
     * @return imageBytes Raw image bytes
     */
    function readImage(
        address imagePtr
    ) external view returns (bytes memory imageBytes) {
        if (imagePtr == address(0)) {
            return "";
        }
        
        assembly {
            let size := extcodesize(imagePtr)
            imageBytes := mload(0x40)
            mstore(0x40, add(imageBytes, and(add(add(size, 0x20), 0x1f), not(0x1f))))
            mstore(imageBytes, size)
            extcodecopy(imagePtr, add(imageBytes, 0x20), 0, size)
        }
    }
}

