// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

/**
 * @title SmokeTest
 * @notice Utility script that generates cast commands for on-chain smoke testing
 * @dev This script does NOT execute anything - it only prints commands
 */
contract SmokeTest is Script {
    function run() external view {
        // Read addresses from environment variables
        address stabilizer = vm.envOr("CREATURE_STABILIZER_PROXY", vm.envOr("STAB_CREATURE_STABILIZER", address(0)));
        address itemToken = vm.envOr("ITEM_TOKEN_PROXY", vm.envOr("STAB_ITEM_TOKEN", address(0)));
        address catalog = vm.envOr("ITEM_CATALOG_PROXY", vm.envOr("STAB_ITEM_CATALOG", address(0)));
        string memory rpc = vm.envOr("APECHAIN_MAINNET_RPC_URL", string(""));
        
        console.log("\n=== SMOKE TEST CONFIG ===");
        console.log("$STAB=%s", stabilizer);
        console.log("$ITEM=%s", itemToken);
        console.log("$CATALOG=%s", catalog);
        console.log("$RPC=%s", rpc);
        console.log("$PK=<YOUR_PRIVATE_KEY_HERE>");
        console.log("\n");
        console.log("Export these in your shell:");
        console.log("  export STAB=%s", stabilizer);
        console.log("  export ITEM=%s", itemToken);
        console.log("  export CATALOG=%s", catalog);
        console.log("  export RPC=%s", rpc);
        console.log("  export PK=$DEPLOYER_PRIVATE_KEY");
        console.log("\n");
        console.log("Placeholders used in commands:");
        console.log("  <CREATURE_ID> = Creature ID (e.g., 999999 for testing)");
        console.log("  <ITEM_ID> = Item ID (e.g., 0 for first item)");
        console.log("  <TRAIT_INDEX> = Trait index (0=Salinity, 1=pH, 2=Temp, 3=Freq)");
        console.log("\n");
        
        console.log("========================================");
        console.log("  STATE-CHANGING OPERATIONS");
        console.log("========================================\n");
        
        // 1. initializeCreature
        console.log("1. Initialize Creature:");
        console.log("   cast send $STAB \\");
        console.log("     \"initializeCreature(uint256,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16)\" \\");
        console.log("     <CREATURE_ID> 1000 1000 1000 1000 0 0 0 0 \\");
        console.log("     --rpc-url $RPC \\");
        console.log("     --private-key $PK\n");
        
        // 2. claimDailyItems
        console.log("2. Claim Daily Items:");
        console.log("   cast send $STAB \\");
        console.log("     \"claimDailyItems(uint256)\" \\");
        console.log("     <CREATURE_ID> \\");
        console.log("     --rpc-url $RPC \\");
        console.log("     --private-key $PK\n");
        
        // 3. claimDailyItemsBatch
        console.log("3. Claim Daily Items (Batch):");
        console.log("   cast send $STAB \\");
        console.log("     \"claimDailyItemsBatch(uint256[])\" \\");
        console.log("     \"[<CREATURE_ID>]\" \\");
        console.log("     --rpc-url $RPC \\");
        console.log("     --private-key $PK\n");
        
        // 4. applyItem
        console.log("4. Apply Item:");
        console.log("   cast send $STAB \\");
        console.log("     \"applyItem(uint256,uint256)\" \\");
        console.log("     <CREATURE_ID> <ITEM_ID> \\");
        console.log("     --rpc-url $RPC \\");
        console.log("     --private-key $PK\n");
        
        // 5. burnItemForSP
        console.log("5. Burn Item for SP:");
        console.log("   cast send $STAB \\");
        console.log("     \"burnItemForSP(uint256,uint256)\" \\");
        console.log("     <CREATURE_ID> <ITEM_ID> \\");
        console.log("     --rpc-url $RPC \\");
        console.log("     --private-key $PK\n");
        
        // 6. lockTrait
        console.log("6. Lock Trait:");
        console.log("   cast send $STAB \\");
        console.log("     \"lockTrait(uint256,uint8)\" \\");
        console.log("     <CREATURE_ID> <TRAIT_INDEX> \\");
        console.log("     --rpc-url $RPC \\");
        console.log("     --private-key $PK\n");
        
        // 7. sendVibes
        console.log("7. Send Vibes:");
        console.log("   cast send $STAB \\");
        console.log("     \"sendVibes(uint256,uint256)\" \\");
        console.log("     <CREATURE_ID> 100 \\");
        console.log("     --rpc-url $RPC \\");
        console.log("     --private-key $PK\n");
        
        console.log("========================================");
        console.log("  READ OPERATIONS");
        console.log("========================================\n");
        
        // getCreatureState
        console.log("1. Get Creature State:");
        console.log("   cast call $STAB \\");
        console.log("     \"getCreatureState(uint256)\" \\");
        console.log("     <CREATURE_ID> \\");
        console.log("     --rpc-url $RPC\n");
        
        // getItemBalances
        console.log("2. Get Item Balance:");
        console.log("   cast call $ITEM \\");
        console.log("     \"balanceOf(address,uint256)\" \\");
        console.log("     $YOUR_ADDRESS <ITEM_ID> \\");
        console.log("     --rpc-url $RPC\n");
        
        // getTemplateCount
        console.log("3. Get Template Count:");
        console.log("   cast call $CATALOG \\");
        console.log("     \"templateCount()(uint256)\" \\");
        console.log("     --rpc-url $RPC\n");
        
        // getTemplate
        console.log("4. Get Template:");
        console.log("   cast call $CATALOG \\");
        console.log("     \"getTemplate(uint256)\" \\");
        console.log("     <ITEM_ID> \\");
        console.log("     --rpc-url $RPC\n");
        
        // getDailyItems
        console.log("5. Get Daily Items:");
        console.log("   cast call $STAB \\");
        console.log("     \"getDailyItems(uint256)\" \\");
        console.log("     <CREATURE_ID> \\");
        console.log("     --rpc-url $RPC\n");
        
        // getEntropy
        console.log("6. Get Entropy:");
        console.log("   cast call $STAB \\");
        console.log("     \"getEntropy(uint256,uint256)\" \\");
        console.log("     <CREATURE_ID> 0 \\");
        console.log("     --rpc-url $RPC\n");
        
        // walletSP
        console.log("7. Get Wallet SP:");
        console.log("   cast call $STAB \\");
        console.log("     \"walletSP(address)(uint32)\" \\");
        console.log("     $YOUR_ADDRESS \\");
        console.log("     --rpc-url $RPC\n");
        
        // lastClaimDay
        console.log("8. Get Last Claim Day:");
        console.log("   cast call $STAB \\");
        console.log("     \"lastClaimDay(uint256)(uint32)\" \\");
        console.log("     <CREATURE_ID> \\");
        console.log("     --rpc-url $RPC\n");
        
        // lastVibesDay
        console.log("9. Get Last Vibes Day:");
        console.log("   cast call $STAB \\");
        console.log("     \"lastVibesDay(uint256)(uint32)\" \\");
        console.log("     <CREATURE_ID> \\");
        console.log("     --rpc-url $RPC\n");
        
        console.log("========================================");
        console.log("  ADMIN OPERATIONS");
        console.log("========================================\n");
        
        // setGoobs
        console.log("1. Set Goobs Contract:");
        console.log("   cast send $STAB \\");
        console.log("     \"setGoobs(address)\" \\");
        console.log("     $GOOBS_CONTRACT_ADDRESS \\");
        console.log("     --rpc-url $RPC \\");
        console.log("     --private-key $PK\n");
        
        // setEnforceGoobsOwnership
        console.log("2. Set Enforce Goobs Ownership:");
        console.log("   cast send $STAB \\");
        console.log("     \"setEnforceGoobsOwnership(bool)\" \\");
        console.log("     true \\");
        console.log("     --rpc-url $RPC \\");
        console.log("     --private-key $PK\n");
        
        // setDaySeconds
        console.log("3. Set Day Seconds:");
        console.log("   cast send $STAB \\");
        console.log("     \"setDaySeconds(uint256)\" \\");
        console.log("     86400 \\");
        console.log("     --rpc-url $RPC \\");
        console.log("     --private-key $PK\n");
        
        // read enforceGoobsOwnership
        console.log("4. Read Enforce Goobs Ownership:");
        console.log("   cast call $STAB \\");
        console.log("     \"enforceGoobsOwnership()(bool)\" \\");
        console.log("     --rpc-url $RPC\n");
        
        // read goobs
        console.log("5. Read Goobs Address:");
        console.log("   cast call $STAB \\");
        console.log("     \"goobs()(address)\" \\");
        console.log("     --rpc-url $RPC\n");
        
        // read daySeconds
        console.log("6. Read Day Seconds:");
        console.log("   cast call $STAB \\");
        console.log("     \"DAY_SECONDS()(uint256)\" \\");
        console.log("     --rpc-url $RPC\n");
        
        console.log("========================================");
        console.log("  ERC-1155 OPERATIONS");
        console.log("========================================\n");
        
        // balanceOfBatch
        console.log("1. Get Multiple Balances (Batch):");
        console.log("   cast call $ITEM \\");
        console.log("     \"balanceOfBatch(address[],uint256[])\" \\");
        console.log("     \"[$YOUR_ADDRESS]\" \"[0,1,2]\" \\");
        console.log("     --rpc-url $RPC\n");
        
        // uri
        console.log("2. Get Token URI:");
        console.log("   cast call $ITEM \\");
        console.log("     \"uri(uint256)\" \\");
        console.log("     <ITEM_ID> \\");
        console.log("     --rpc-url $RPC\n");
        
        // adminMint
        console.log("3. Admin Mint (Owner Only):");
        console.log("   cast send $ITEM \\");
        console.log("     \"adminMint(address,uint256,uint256)\" \\");
        console.log("     $RECIPIENT_ADDRESS <ITEM_ID> 1 \\");
        console.log("     --rpc-url $RPC \\");
        console.log("     --private-key $PK\n");
        
        console.log("========================================");
        console.log("  CATALOG OPERATIONS");
        console.log("========================================\n");
        
        // getTemplateIdsByRarity
        console.log("1. Get Templates by Rarity:");
        console.log("   cast call $CATALOG \\");
        console.log("     \"getTemplateIdsByRarity(uint8)\" \\");
        console.log("     0 \\");
        console.log("     --rpc-url $RPC\n");
        console.log("   (0=Common, 1=Uncommon, 2=Rare, 3=Epic)\n");
        
        // updateTemplateImage (if upgraded)
        console.log("2. Update Template Image (Owner Only):");
        console.log("   cast send $CATALOG \\");
        console.log("     \"updateTemplateImage(uint256,address)\" \\");
        console.log("     <ITEM_ID> $SSTORE2_IMAGE_ADDRESS \\");
        console.log("     --rpc-url $RPC \\");
        console.log("     --private-key $PK\n");
        
        console.log("========================================");
        console.log("  QUICK SMOKE TEST SEQUENCE");
        console.log("========================================\n");
        console.log("# Step 1: Disable Goobs ownership enforcement");
        console.log("cast send $STAB \"setGoobs(address)\" 0x0000000000000000000000000000000000000000 --rpc-url $RPC --private-key $PK");
        console.log("cast send $STAB \"setEnforceGoobsOwnership(bool)\" false --rpc-url $RPC --private-key $PK\n");
        console.log("# Step 2: Optionally shorten DAY_SECONDS (e.g., 300 seconds for testing)");
        console.log("cast send $STAB \"setDaySeconds(uint256)\" 300 --rpc-url $RPC --private-key $PK\n");
        console.log("# Step 3: Initialize a test creature (example uses 999999)");
        console.log("cast send $STAB \"initializeCreature(uint256,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16)\" 999999 50 50 50 50 70 70 70 70 --rpc-url $RPC --private-key $PK\n");
        console.log("# Step 4: Read its state");
        console.log("cast call $STAB \"getCreatureState(uint256)\" 999999 --rpc-url $RPC\n");
        console.log("# Step 5: Claim items");
        console.log("cast send $STAB \"claimDailyItems(uint256)\" 999999 --rpc-url $RPC --private-key $PK\n");
        console.log("# Step 6: Check balances");
        console.log("cast call $ITEM \"balanceOf(address,uint256)\" $YOUR_WALLET <ITEM_ID> --rpc-url $RPC\n");
        console.log("# Step 7: Apply an item you just received");
        console.log("cast send $STAB \"applyItem(uint256,uint256)\" 999999 <ITEM_ID> --rpc-url $RPC --private-key $PK\n");
        console.log("# Step 8: Read state again to see trait movement");
        console.log("cast call $STAB \"getCreatureState(uint256)\" 999999 --rpc-url $RPC\n");
        console.log("# Step 9: Burn an item for SP (optional)");
        console.log("cast send $STAB \"burnItemForSP(uint256,uint256)\" 999999 <ITEM_ID> --rpc-url $RPC --private-key $PK\n");
        console.log("# Step 10: Lock a trait when within band (optional)");
        console.log("cast send $STAB \"lockTrait(uint256,uint8)\" 999999 <TRAIT_INDEX> --rpc-url $RPC --private-key $PK\n");
        console.log("\n");
    }
}

