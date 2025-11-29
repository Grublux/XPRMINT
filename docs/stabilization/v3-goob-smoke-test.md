# V3 Goob-Gated Mainnet Smoke Test

This guide explains how to run the full end-to-end smoke test for the V3 Stabilization System on ApeChain mainnet with Goobs gating enabled.

## Purpose

The `GoobGatedV3SmokeTest.s.sol` script performs a comprehensive test of all major V3 stabilization functions:

- Goobs gating configuration verification
- Creature initialization
- Daily item claiming
- Item application
- Item burning for SP
- Vibes sending
- Trait locking (optional)

This is the **canonical** smoke test for verifying V3 functionality on mainnet with Goobs ownership enforcement enabled.

## Prerequisites

1. **Deployer EOA** must own at least one Goob NFT on ApeChain
2. **Environment variables** must be set (see below)
3. **Sufficient ETH** for gas fees on ApeChain

## Required Environment Variables

```bash
export RPC="https://apechain.calderachain.xyz/http"
export DEPLOYER_PRIVATE_KEY=<your_private_key>
export STAB_V3=0xe5fb969eec4985e8EB92334fFE11EA45035467CB
export ITEM_V3=0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8
export GOOBS_721=<goobs_erc721_contract_address>
export GOOB_ID=<token_id_owned_by_deployer>
```

**Important:**
- `GOOBS_721` is the address of the Goobs ERC-721 contract on ApeChain
- `GOOB_ID` must be a token ID that the deployer EOA owns
- The script will verify ownership before proceeding

## Running the Smoke Test

### Command

```bash
forge script scripts/GoobGatedV3SmokeTest.s.sol \
  --rpc-url $RPC \
  --broadcast \
  -vvvv
```

### What the Script Does

The script executes the following steps in order:

#### Step 1: Goobs Gating Configuration
- Reads current `goobs()` address and `enforceGoobsOwnership()` state
- Sets Goobs address if not already configured
- Enables enforcement if not already enabled
- Logs configuration status

#### Step 2: Initialize Creature
- Checks if creature is already initialized
- If not initialized, initializes with:
  - Targets: `50, 50, 50, 50` (Salinity, pH, Temperature, Frequency)
  - Currents: `70, 70, 70, 70` (ensures 5% minimum offset from targets)
- Uses `try/catch` to handle already-initialized creatures gracefully

#### Step 3: Read Creature State
- Calls `getCreatureState(goobId)` and logs all state fields:
  - Target values
  - Current values
  - Locked count
  - Vibes
  - Streak days
  - Last claim/vibes days

#### Step 4: Claim Daily Items
- Calls `claimDailyItems(goobId)`
- Records item balances before and after
- Detects which items were received
- Logs total items received (may be 0 if already claimed today)

#### Step 5: Apply Item
- Finds first available item in deployer's inventory
- Calls `applyItem(goobId, itemId)`
- Compares creature currents before and after to verify item effect

#### Step 6: Burn Item for SP
- Finds first available item in deployer's inventory
- Calls `burnItemForSP(goobId, itemId)`
- Compares wallet SP before and after to verify SP gain

#### Step 7: Send Vibes
- Calls `sendVibes(goobId)`
- Reads updated vibes and streak days

#### Step 8: Lock Trait (Optional)
- Attempts to lock trait index 0 (Salinity)
- Uses `try/catch` since locking may fail if trait is not close enough to target
- Logs warning if lock fails (this is expected in many cases)

#### Final Summary
- Reads final creature state
- Reads final wallet SP
- Logs comprehensive summary of all state

## Expected Output

A successful smoke test will show:

```
=== Goob-Gated V3 Smoke Test ===
Deployer: 0x...
STAB_V3: 0xe5fb969eec4985e8EB92334fFE11EA45035467CB
ITEM_V3: 0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8
GOOBS_721: 0x...
GOOB_ID: 123

[OK] Deployer owns Goob 123

=== Step 1: Goobs Gating Configuration ===
Current goobs address: 0x...
Current enforcement: true
[SKIP] Goobs address already configured
[SKIP] Enforcement already enabled

=== Step 2: Initialize Creature ===
Initializing creature with:
  Targets: 50, 50, 50, 50
  Currents: 70, 70, 70, 70
[OK] Creature initialized

=== Step 3: Creature State ===
Targets: Sal=50 pH=50 Temp=50 Freq=50
Currents: Sal=70 pH=70 Temp=70 Freq=70
...

=== Step 4: Claim Daily Items ===
[OK] Daily items claimed
Items received:
  Item 5: +1
  Item 12: +1
Total items received: 2

=== Step 5: Apply Item ===
Applying item 5
[OK] Item applied
Currents before: Sal=70 pH=70 Temp=70 Freq=70
Currents after:  Sal=73 pH=70 Temp=71 Freq=70

=== Step 6: Burn Item for SP ===
Burning item 12
SP before: 0
[OK] Item burned
SP after: 1
SP gained: 1

=== Step 7: Send Vibes ===
[OK] Vibes sent
Vibes after: 1
Streak days after: 1

=== Step 8: Lock Trait (Optional) ===
[WARN] Lock trait failed (may not be close enough): CreatureStabilizer: trait not close enough

=== Final Summary ===
Creature State:
  Targets: Sal=50 pH=50 Temp=50 Freq=50
  Currents: Sal=73 pH=70 Temp=71 Freq=70
  Locked traits: 0
  Vibes: 1
  Streak days: 1
Wallet SP: 1

=== Smoke Test Complete ===
```

## Troubleshooting

### "Deployer does not own the specified Goob"
- Verify `GOOB_ID` is correct
- Verify deployer EOA actually owns that Goob
- Check `GOOBS_721` address is correct

### "Creature already initialized"
- This is expected if you've run the test before
- The script will skip initialization and continue
- To test initialization on a fresh creature, use a different `GOOB_ID`

### "No new items received"
- This means you've already claimed items today for this creature
- Wait until the next game day or use a different `GOOB_ID`

### "No items available to apply/burn"
- This means the deployer has no items in inventory
- Run `MintAllV3Items.s.sol` first, or wait for daily claims to accumulate items

### "Lock trait failed"
- This is expected if the trait is not within 5% of the target
- The script uses `try/catch` to handle this gracefully
- This is not a test failure

### Transaction reverts with "not Goob owner"
- Verify Goobs gating is configured correctly
- Verify deployer owns the Goob
- Check that `enforceGoobsOwnership()` is enabled (script will enable it if needed)

## Re-Running the Test

The script is designed to be **re-runnable**:

- Already-initialized creatures are detected and skipped
- Already-claimed items are detected (no new items received)
- All operations use `try/catch` to handle expected failures gracefully
- The script will always complete and show a final summary

You can run this script multiple times on the same Goob ID without issues.

## Notes

- The script uses **minimal interfaces** to avoid importing full contracts
- All state-changing operations are wrapped in `try/catch` for safety
- The script verifies Goobs ownership before proceeding
- Gas costs will vary based on which operations succeed/fail



