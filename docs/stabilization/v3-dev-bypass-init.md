# V3 Dev Bypass Creature Initializer (Owner-Only Tool)

This guide explains how to use the owner-only dev tool to initialize a creature without Goobs ownership checks.

## Purpose

The `DevBypassCreatureInitV3.s.sol` script is a **development/testing tool** that allows the contract owner to initialize any creature ID, even if they don't own the corresponding Goob NFT. This is useful for:

- Testing creature initialization on arbitrary IDs
- Initializing creatures for testing without needing to own specific Goobs
- Development workflows where you need to quickly set up test creatures

## ⚠️ Warnings

1. **Owner-Only**: This script can only be run by the contract owner (deployer EOA)
2. **Temporary Bypass**: The script temporarily disables Goobs enforcement, then restores it
3. **Development Tool**: This is NOT for production use - it's a dev/testing utility
4. **Re-Runnable**: The script safely handles already-initialized creatures

## Use Case

When you need to initialize a creature for testing but:
- Don't own the corresponding Goob NFT
- Want to test with a specific creature ID
- Need to quickly set up test scenarios

## Required Environment Variables

```bash
export RPC="https://apechain.calderachain.xyz/http"
export DEPLOYER_PRIVATE_KEY=<your_private_key>
export STAB_V3=0xe5fb969eec4985e8EB92334fFE11EA45035467CB
export DEV_CREATURE_ID=<creature_id_to_initialize>
```

**Important:**
- `DEPLOYER_PRIVATE_KEY` must be the owner of `STAB_V3`
- `DEV_CREATURE_ID` can be any uint256 value (doesn't need to correspond to a Goob you own)
- The script will check if the creature is already initialized and skip if so

## Running the Script

### Command

```bash
forge script scripts/DevBypassCreatureInitV3.s.sol \
  --rpc-url $RPC \
  --broadcast \
  -vvvv
```

## What the Script Does

The script performs the following steps:

1. **Verify Ownership**: Checks that deployer is the owner of `STAB_V3`
2. **Check Initialization**: Reads creature state to see if already initialized
3. **Save State**: Reads current `enforceGoobsOwnership()` value
4. **Disable Enforcement**: If enforcement is enabled, temporarily disables it
5. **Initialize Creature**: Calls `initializeCreature()` with:
   - Targets: `50, 50, 50, 50` (Salinity, pH, Temperature, Frequency)
   - Currents: `70, 70, 70, 70` (ensures 5% minimum offset from targets)
6. **Restore Enforcement**: Restores `enforceGoobsOwnership()` to its previous value
7. **Verify**: Confirms creature was initialized and enforcement was restored

## Expected Output

A successful run will show:

```
=== Dev Bypass Creature Initializer ===
Deployer: 0x...
STAB_V3: 0xe5fb969eec4985e8EB92334fFE11EA45035467CB
DEV_CREATURE_ID: 999999

[OK] Deployer is owner of STAB_V3

Current enforceGoobsOwnership: true
Temporarily disabling Goobs enforcement...
[OK] Enforcement disabled

Initializing creature 999999 with:
  Targets: 50, 50, 50, 50
  Currents: 70, 70, 70, 70
[OK] Creature initialized successfully

Restoring Goobs enforcement to previous state...
[OK] Enforcement restored

=== Verification ===
Creature initialized:
  Targets: Sal=50 pH=50 Temp=50 Freq=50
Enforcement restored: YES

=== Dev Bypass Complete ===
```

## If Creature is Already Initialized

If the creature is already initialized, the script will detect this and exit early:

```
[WARN] Creature 999999 is already initialized
Current targets: Sal=50 pH=50 Temp=50 Freq=50
Skipping initialization
```

## Error Handling

The script uses `try/catch` to handle initialization failures:

- If initialization fails, enforcement is still restored
- The script will log the error and exit gracefully
- No state is left in an inconsistent condition

## Enforcement Restoration

**Important**: The script **always** restores the enforcement state, even if initialization fails. This ensures:

- Goobs gating is never left disabled accidentally
- The contract returns to its previous security state
- No manual intervention is needed

## Troubleshooting

### "Deployer is not owner"
- Verify `DEPLOYER_PRIVATE_KEY` corresponds to the owner of `STAB_V3`
- Check that you're using the correct private key

### "Creature already initialized"
- This is expected if the creature was initialized previously
- Use a different `DEV_CREATURE_ID` to initialize a new creature
- Or use the creature as-is (it's already ready for testing)

### Initialization fails with "trait too close"
- The script uses `70, 70, 70, 70` for currents and `50, 50, 50, 50` for targets
- This ensures a 20-point difference (20% of 100), which is well above the 5% minimum
- If this still fails, there may be an issue with the contract state

### "Enforcement state mismatch"
- This should never happen if the script completes successfully
- If you see this warning, manually check and restore enforcement:
  ```bash
  cast send $STAB_V3 "setEnforceGoobsOwnership(bool)" true \
    --rpc-url $RPC \
    --private-key $DEPLOYER_PRIVATE_KEY
  ```

## Notes

- The script is **idempotent**: safe to run multiple times
- Enforcement is restored even if initialization fails
- Uses minimal interface to avoid importing full contracts
- All operations are logged for transparency



