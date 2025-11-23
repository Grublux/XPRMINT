// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";

/**
 * @title UpgradeItemToken1155V3_CollectionLabel
 * @notice Upgrades ITEM_V3 to new implementation with V3 collection label in tokenURI
 * @dev This is a cosmetic metadata-only upgrade. No gameplay logic changes.
 * 
 * Usage:
 *   export RPC="https://apechain.calderachain.xyz/http"
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export ITEM_V3=0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8
 * 
 * Note: PROXY_ADMIN_V3 env var is optional (for reference only).
 * The script automatically reads the individual ProxyAdmin from the proxy's admin slot.
 * 
 *   forge script scripts/UpgradeItemToken1155V3_CollectionLabel.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast \
 *     -vvvv
 */
contract UpgradeItemToken1155V3_CollectionLabel is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address itemV3 = vm.envAddress("ITEM_V3");
        
        console2.log("=== Upgrading ITEM_V3 Collection Label ===");
        console2.log("Deployer:", deployer);
        console2.log("ITEM_V3:", itemV3);
        console2.log("");
        
        // Get the individual ProxyAdmin from the proxy's admin slot (ERC-1967)
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        address individualProxyAdmin = address(uint160(uint256(vm.load(itemV3, adminSlot))));
        console2.log("Individual ProxyAdmin:", individualProxyAdmin);
        
        // Verify individual ProxyAdmin ownership
        ProxyAdmin admin = ProxyAdmin(individualProxyAdmin);
        require(admin.owner() == deployer, "Deployer is not individual ProxyAdmin owner");
        
        // Get current implementation from storage slot (ERC-1967)
        bytes32 implSlot = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
        address currentImpl = address(uint160(uint256(vm.load(itemV3, implSlot))));
        console2.log("Current implementation:", currentImpl);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy new implementation
        ItemToken1155 newImpl = new ItemToken1155();
        console2.log("New implementation:", address(newImpl));
        
        // Upgrade via individual ProxyAdmin (using upgradeAndCall with empty data for plain upgrade)
        ITransparentUpgradeableProxy proxy = ITransparentUpgradeableProxy(itemV3);
        admin.upgradeAndCall(proxy, address(newImpl), "");
        console2.log("Upgrade transaction sent");
        
        vm.stopBroadcast();
        
        // Verify upgrade
        address updatedImpl = address(uint160(uint256(vm.load(itemV3, implSlot))));
        require(updatedImpl == address(newImpl), "Upgrade failed - implementation not updated");
        console2.log("Verified new implementation:", updatedImpl);
        
        // Check tokenURI collection label
        console2.log("");
        console2.log("=== Verifying Collection Label ===");
        string memory uri = ItemToken1155(itemV3).uri(0);
        console2.log("Item 0 URI (first 200 chars):");
        bytes memory uriBytes = bytes(uri);
        if (uriBytes.length > 200) {
            console2.log(string(abi.encodePacked(substring(uri, 0, 200), "...")));
        } else {
            console2.log(uri);
        }
        
        // Note: We can't decode base64 in Solidity easily, so we just log the URI
        // The actual verification should be done off-chain with cast call
        
        console2.log("");
        console2.log("=== Upgrade Complete ===");
        console2.log("Verify collection label with:");
        console2.log("  cast call $ITEM_V3 \"uri(uint256)(string)\" 0 --rpc-url $RPC");
        console2.log("Then decode the base64 JSON and check for:");
        console2.log("  \"collection\":\"Stabilization Items V3\"");
    }
    
    function substring(string memory str, uint256 start, uint256 end) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(end - start);
        for (uint256 i = start; i < end && i < strBytes.length; i++) {
            result[i - start] = strBytes[i];
        }
        return string(result);
    }
}

