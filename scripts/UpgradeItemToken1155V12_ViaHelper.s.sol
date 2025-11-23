// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ProxyAdminUpgradeHelper} from "../contracts/helpers/ProxyAdminUpgradeHelper.sol";
import {ItemToken1155} from "../contracts/stabilization/items/ItemToken1155.sol";

/**
 * @title UpgradeItemToken1155V12_ViaHelper
 * @notice Upgrade ItemToken1155 V1 → V1.2 using a helper contract
 * @dev 
 * WHY THIS APPROACH:
 * - The proxy has an individual ProxyAdmin (0xec45...) owned by ProxyAdminV1
 * - Deployer owns ProxyAdminV1 but cannot directly call the individual ProxyAdmin
 * - Solution: Deploy a helper contract, have ProxyAdminV1 call it, which then calls the individual ProxyAdmin
 * 
 * Usage:
 *   export RPC=https://apechain.calderachain.xyz/http
 *   export DEPLOYER_PRIVATE_KEY=<your_private_key>
 *   export PROXY_ADMIN_V1=0xdb8047eD77099626e189316Ced0b25b46Ae0181d
 *   export ITEM_TOKEN_PROXY_V1=0x9C4216d7B56A25b4B8a8eDdEfeBaBa389E05A01E
 *   export ITEM_TOKEN_IMPL_V12=0xD8ac1dc16930Ab8FE62A8e5cF43F874f32e4CA0f
 * 
 *   forge script scripts/UpgradeItemToken1155V12_ViaHelper.s.sol \
 *     --rpc-url $RPC \
 *     --broadcast
 */
contract UpgradeItemToken1155V12_ViaHelper is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", vm.envOr("PRIVATE_KEY", uint256(0)));
        require(deployerPrivateKey != 0, "DEPLOYER_PRIVATE_KEY not set");
        
        address deployer = vm.addr(deployerPrivateKey);
        address proxyAdminV1 = vm.envAddress("PROXY_ADMIN_V1");
        address itemTokenProxyV1 = vm.envAddress("ITEM_TOKEN_PROXY_V1");
        address newImpl = vm.envAddress("ITEM_TOKEN_IMPL_V12");

        console2.log("=== Upgrade ItemToken1155 V1 to V1.2 (via Helper) ===");
        console2.log("Deployer:", deployer);
        console2.log("ProxyAdminV1:", proxyAdminV1);
        console2.log("ItemToken1155 Proxy:", itemTokenProxyV1);
        console2.log("New Implementation (V1.2):", newImpl);
        console2.log("");

        // Verify ProxyAdminV1 ownership
        ProxyAdmin adminV1 = ProxyAdmin(proxyAdminV1);
        address adminV1Owner = adminV1.owner();
        console2.log("ProxyAdminV1 owner:", adminV1Owner);
        
        if (adminV1Owner != deployer) {
            console2.log("[ERROR] Deployer is not the owner of ProxyAdminV1!");
            revert("Not authorized");
        }

        // Get the individual proxy admin
        bytes32 adminSlot = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
        address proxyAdmin = address(uint160(uint256(vm.load(itemTokenProxyV1, adminSlot))));
        console2.log("Individual Proxy Admin:", proxyAdmin);
        
        ProxyAdmin individualAdmin = ProxyAdmin(proxyAdmin);
        address individualAdminOwner = individualAdmin.owner();
        console2.log("Individual Proxy Admin owner:", individualAdminOwner);
        
        if (individualAdminOwner != proxyAdminV1) {
            console2.log("[ERROR] ProxyAdminV1 does not own the individual ProxyAdmin!");
            revert("Invalid admin structure");
        }

        vm.startBroadcast(deployerPrivateKey);

        // Deploy helper contract that ProxyAdminV1 can call
        console2.log("Deploying ProxyAdminUpgradeHelper...");
        ProxyAdminUpgradeHelper helper = new ProxyAdminUpgradeHelper();
        console2.log("Helper deployed at:", address(helper));
        console2.log("");

        // Use ProxyAdminV1 to call helper via a temporary proxy upgrade
        // Actually, simpler: use cast send to call helper directly as ProxyAdminV1
        // But we can't do that in a script. Instead, we'll use a different approach:
        // Call the helper's upgradeProxy function, which will be called by ProxyAdminV1
        // But ProxyAdminV1 can't call arbitrary contracts...
        
        // SOLUTION: Use ProxyAdminV1's upgradeAndCall on a temporary proxy that calls helper
        // OR: Manually transfer ownership via cast send (outside this script)
        
        // For now, let's try a direct approach: use vm.prank to impersonate ProxyAdminV1
        // But prank doesn't work with broadcast...
        
        // ACTUAL SOLUTION: We need to use cast send manually, OR
        // Create a script that outputs the exact cast commands needed
        
        console2.log("[INFO] Cannot upgrade directly because ProxyAdminV1 (contract) owns individual ProxyAdmin");
        console2.log("[INFO] Manual steps required:");
        console2.log("");
        console2.log("1. Transfer ownership of individual ProxyAdmin to deployer:");
        console2.log("   cast send", proxyAdmin, "transferOwnership(address)", deployer, "--rpc-url $RPC --private-key $PROXY_ADMIN_V1_PK");
        console2.log("");
        console2.log("2. Upgrade the proxy:");
        console2.log("   cast send", proxyAdmin, "upgradeAndCall(address,address,bytes)", itemTokenProxyV1, newImpl, "0x", "--rpc-url $RPC --private-key $DEPLOYER_PRIVATE_KEY");
        console2.log("");
        console2.log("3. Transfer ownership back:");
        console2.log("   cast send", proxyAdmin, "transferOwnership(address)", proxyAdminV1, "--rpc-url $RPC --private-key $DEPLOYER_PRIVATE_KEY");
        
        revert("Use manual cast commands above");

        // Verify upgrade
        ItemToken1155 proxy = ItemToken1155(itemTokenProxyV1);
        string memory newName = proxy.name();
        string memory baseURI = proxy.externalImageBaseURI();
        
        console2.log("");
        console2.log("[OK] Upgrade complete!");
        console2.log("Verification:");
        console2.log("  name:", newName);
        console2.log("  externalImageBaseURI:", baseURI);
        console2.log("");
        console2.log("Next step: Run SetExternalImageBaseURI.s.sol to configure the base URI");
    }
}

