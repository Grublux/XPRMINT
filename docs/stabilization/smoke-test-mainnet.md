# Smoke Testing on ApeChain Mainnet

This guide explains how to perform on-chain smoke tests of the deployed Stabilization System on ApeChain mainnet.

## Prerequisites

The contracts are already deployed on ApeChain mainnet. Before running smoke tests, you need to set the following environment variables:

- `CREATURE_STABILIZER_PROXY` - Address of the CreatureStabilizer proxy contract
- `ITEM_TOKEN_PROXY` - Address of the ItemToken1155 proxy contract
- `ITEM_CATALOG_PROXY` - Address of the ItemCatalog proxy contract
- `APECHAIN_MAINNET_RPC_URL` - Your ApeChain mainnet RPC endpoint
- `DEPLOYER_PRIVATE_KEY` - Your private key for testing (⚠️ **DO NOT commit this to version control**)

**Note:** If your environment uses different variable names (e.g., `STAB_CREATURE_STABILIZER`, `STAB_ITEM_TOKEN`, `STAB_ITEM_CATALOG`), the script will attempt to read those as fallbacks.

## Running the Smoke Test Script

The `SmokeTest.s.sol` script generates ready-to-use `cast` commands for testing. It does **not** execute any transactions—it only prints commands that you can copy and run.

```bash
forge script scripts/SmokeTest.s.sol --rpc-url $APECHAIN_MAINNET_RPC_URL
```

## Script Output

The script prints:

1. **Configuration Header** - Resolved contract addresses and RPC URL:
   ```
   === SMOKE TEST CONFIG ===
   $STAB=0x...
   $ITEM=0x...
   $CATALOG=0x...
   $RPC=https://...
   $PK=<YOUR_PRIVATE_KEY_HERE>
   ```

2. **Export Commands** - Shell commands to set up your environment:
   ```bash
   export STAB=0x...
   export ITEM=0x...
   export CATALOG=0x...
   export RPC=$APECHAIN_MAINNET_RPC_URL
   export PK=$DEPLOYER_PRIVATE_KEY
   ```

3. **Command Groups** - Organized by operation type:
   - **State-Changing Operations** - `initializeCreature`, `claimDailyItems`, `applyItem`, `burnItemForSP`, `lockTrait`, `sendVibes`
   - **Read Operations** - `getCreatureState`, `walletSP`, `lastClaimDay`, `lastVibesDay`, `balanceOf`, `templateCount`, etc.
   - **Admin Operations** - `setGoobs`, `setEnforceGoobsOwnership`, `setDaySeconds`
   - **ERC-1155 Operations** - `balanceOf`, `balanceOfBatch`, `uri`, `adminMint`
   - **Catalog Operations** - `getTemplate`, `getTemplateIdsByRarity`, `updateTemplateImage`

4. **Quick Smoke Test Sequence** - A recommended flow to verify the system end-to-end

## Placeholders

All commands use placeholders that you must replace:

- `$STAB` - CreatureStabilizer proxy address
- `$ITEM` - ItemToken1155 proxy address
- `$CATALOG` - ItemCatalog proxy address
- `$RPC` - RPC URL
- `$PK` - Private key
- `<CREATURE_ID>` - Creature ID (e.g., `999999` for testing)
- `<ITEM_ID>` - Item ID (e.g., `0` for the first item)
- `<TRAIT_INDEX>` - Trait index (`0`=Salinity, `1`=pH, `2`=Temperature, `3`=Frequency)
- `$YOUR_ADDRESS` or `$YOUR_WALLET` - Your wallet address

## Recommended Smoke Test Flow

Follow this sequence to verify the system is working:

1. **Disable Goobs ownership enforcement** (for testing):
   ```bash
   cast send $STAB "setGoobs(address)" 0x0000000000000000000000000000000000000000 --rpc-url $RPC --private-key $PK
   cast send $STAB "setEnforceGoobsOwnership(bool)" false --rpc-url $RPC --private-key $PK
   ```

2. **Optionally shorten DAY_SECONDS** (for faster testing):
   ```bash
   cast send $STAB "setDaySeconds(uint256)" 300 --rpc-url $RPC --private-key $PK
   ```

3. **Initialize a test creature**:
   ```bash
   cast send $STAB "initializeCreature(uint256,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16)" 999999 50 50 50 50 70 70 70 70 --rpc-url $RPC --private-key $PK
   ```
   Parameters: `creatureId`, `targetSal`, `targetPH`, `targetTemp`, `targetFreq`, `currSal`, `currPH`, `currTemp`, `currFreq`

4. **Read creature state**:
   ```bash
   cast call $STAB "getCreatureState(uint256)" 999999 --rpc-url $RPC
   ```

5. **Claim daily items**:
   ```bash
   cast send $STAB "claimDailyItems(uint256)" 999999 --rpc-url $RPC --private-key $PK
   ```

6. **Check item balances**:
   ```bash
   cast call $ITEM "balanceOf(address,uint256)" $YOUR_WALLET <ITEM_ID> --rpc-url $RPC
   ```

7. **Apply an item**:
   ```bash
   cast send $STAB "applyItem(uint256,uint256)" 999999 <ITEM_ID> --rpc-url $RPC --private-key $PK
   ```

8. **Read state again** to verify trait changes:
   ```bash
   cast call $STAB "getCreatureState(uint256)" 999999 --rpc-url $RPC
   ```

9. **Burn an item for SP** (optional):
   ```bash
   cast send $STAB "burnItemForSP(uint256,uint256)" 999999 <ITEM_ID> --rpc-url $RPC --private-key $PK
   ```

10. **Lock a trait** when within the 5% band (optional):
    ```bash
    cast send $STAB "lockTrait(uint256,uint8)" 999999 <TRAIT_INDEX> --rpc-url $RPC --private-key $PK
    ```

## Notes

- The script does **not** execute any transactions—it only generates commands.
- Replace all placeholders (`$STAB`, `<CREATURE_ID>`, etc.) with actual values before running commands.
- Use a test creature ID (e.g., `999999`) that doesn't conflict with real creatures.
- For faster testing, consider setting `DAY_SECONDS` to a shorter value (e.g., 300 seconds = 5 minutes).
- Admin functions (`setGoobs`, `setEnforceGoobsOwnership`, `setDaySeconds`) require contract ownership.
- The `adminMint` function in ItemToken1155 is owner-only and should be used sparingly.

## Troubleshooting

- **"execution reverted"** - Check that you're using the correct contract addresses and that your wallet has the necessary permissions.
- **"OwnableUnauthorizedAccount"** - You're not the owner of the contract. Admin functions require ownership.
- **"CreatureStabilizer: not Goob owner"** - Goobs ownership enforcement is enabled. Disable it for testing or use a creature you own.
- **"Catalog is empty"** - The catalog hasn't been populated yet. Run `DeployItemCatalog.s.sol` first.

## Related Documentation

- [Deployment Checklist](../stabilization/deployment-checklist.md)
- [Stabilization Spec](../stabilization/stabilization-spec.md)
- [Developer Guide](../stabilization/DEVELOPER_GUIDE.md)

