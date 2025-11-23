// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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
        // Bytecode structure:
        //   PUSH2 <length> (3 bytes: 0x61 + 2-byte length)
        //   DUP1 (1 byte: 0x80)
        //   PUSH1 0c (2 bytes: 0x60 0x0c) - offset to data (12 bytes)
        //   PUSH1 00 (2 bytes: 0x60 0x00) - destination offset
        //   CODECOPY (1 byte: 0x39)
        //   PUSH1 00 (2 bytes: 0x60 0x00) - return offset
        //   RETURN (1 byte: 0xf3)
        //   <data>
        // Total header: 12 bytes
        bytes memory bytecode = abi.encodePacked(
            hex"61", // PUSH2
            uint16(imageBytes.length), // Length of data (not +1)
            hex"80", // DUP1
            hex"60", // PUSH1
            hex"0c", // offset to data (12 bytes, not 14)
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


