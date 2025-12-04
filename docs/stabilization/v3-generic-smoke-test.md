# V3 Generic Smoke Test (Non-Goob-Gated)

This guide explains how to run the generic, non-Goob-gated smoke test for the V3 Stabilization System on any deployed network.

## Purpose

The `GenericV3SmokeTest.s.sol` script performs a comprehensive test of all major V3 stabilization functions **without requiring Goobs ownership**:

- Goobs enforcement disabling (if present)
- Creature initialization
- Daily item claiming
- Item application
- Item burning for SP
- Vibes sending
- Trait locking (optional)

This is the **generic** smoke test for verifying V3 functionality on any network where `STAB_V3` and `ITEM_V3` are deployed, regardless of Goobs gating configuration.

## Prerequisites

1. **Foundry installed** and configured
2. **V3 contracts deployed** (`STAB_V3`, `ITEM_V3`) on target network
3. **Deployer EOA** with sufficient ETH for gas fees
4. **No Goobs ownership required** - this test uses an arbitrary creature ID (999999)

## Required Environment Variables

```bash
export RPC="https://apechain.calderachain.xyz/http"
export DEPLOYER_PRIVATE_KEY=<your_private_key>
export STAB_V3=0xe5fb969eec4985e8EB92334fFE11EA45035467CB
export ITEM_V3=0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8
```

**Important:**
- `STAB_V3` is the address of the CreatureStabilizer V3 proxy
- `ITEM_V3` is the address of the ItemToken1155 V3 proxy
- The script uses a hardcoded creature ID of `999999` (not tied to any Goob)
- The script will attempt to disable Goobs enforcement if present

## Running the Smoke Test

### Command

```bash
forge script scripts/GenericV3SmokeTest.s.sol \
  --rpc-url $RPC \
  --broadcast \
  -vvvv
```

### What the Script Does

The script executes the following steps in order:

#### Step 1: Disable Goobs Enforcement
- Attempts to read `enforceGoobsOwnership()` state
- If enforcement is enabled, calls `setEnforceGoobsOwnership(false)`
- Logs whether enforcement was disabled or already off
- If the function doesn't exist, logs a skip message

#### Step 2: Initialize Creature
- Initializes creature ID `999999` with:
  - Targets: 50, 50, 50, 50 (Salinity, pH, Temperature, Frequency)
  - Currents: 70, 70, 70, 70
- If already initialized, logs a skip message and continues

#### Step 3: Claim Daily Items
- Calls `claimDailyItems(999999)`
- Checks balances for all 64 item IDs (0-63) before and after
- Logs which items were received
- If no new items (already claimed today), logs a warning

#### Step 4: Apply First Item
- Finds the first item ID with balance > 0
- Logs current trait values before applying
- Calls `applyItem(999999, itemId)`
- Logs updated trait values after applying
- If no items available, skips this step

#### Step 5: Burn Item for SP
- Finds the second item ID with balance > 0 (skips the first one)
- Logs wallet SP before burning
- Calls `burnItemForSP(999999, itemId)`
- Logs wallet SP after burning and SP gained
- If no second item available, skips this step

#### Step 6: Send Vibes
- Calls `sendVibes(999999)`
- If it reverts due to cooldown (already sent today), logs a warning
- Logs final vibes count and streak days

#### Step 7: Lock Trait (Optional)
- Attempts to lock trait index 0 (Salinity) via `lockTrait(999999, 0)`
- If it reverts because the trait is not within the 5% lock band, logs a warning (this is expected)
- If successful, logs confirmation

#### Step 8: Final Summary
- Reloads creature state and wallet SP
- Logs a clean summary:
  - Targets: (Sal, pH, Temp, Freq)
  - Currents: (Sal, pH, Temp, Freq)
  - Vibes count
  - Locked count
  - Streak days
  - Locked flags (Sal, pH, Temp, Freq)
  - Wallet SP

## Interpreting the Output

### Successful Run

A healthy run should show:

```
=== Generic V3 Smoke Test ===
Deployer: 0x...
STAB_V3: 0x...
ITEM_V3: 0x...
CREATURE_ID: 999999

=== Step 1: Disable Goobs Enforcement ===
[OK] Goobs enforcement disabled
  OR
[SKIP] Goobs enforcement already disabled
  OR
[SKIP] Goobs enforcement not present in contract

=== Step 2: Initialize Creature ===
[OK] Creature initialized
  OR
[SKIP] Creature already initialized

=== Step 3: Claim Daily Items ===
[OK] Daily items claimed
Items received:
  Item 0 - balance: 1
  Item 1 - balance: 1
  ...

=== Step 4: Apply First Item ===
Applying item 0
Currents before: Sal=70 pH=70 Temp=70 Freq=70
[OK] Item applied
Currents after:  Sal=67 pH=70 Temp=69 Freq=70

=== Step 5: Burn Item for SP ===
Burning item 1 for SP
SP before: 0
[OK] Item burned
SP after: 1
SP gained: 1

=== Step 6: Send Vibes ===
[OK] Vibes sent
  OR
[WARN] Send vibes failed: CreatureStabilizer: already sent vibes today
Vibes after: 9
Streak days after: 0

=== Step 7: Lock Trait (Optional) ===
[WARN] Lock trait failed (may not be close enough): CreatureStabilizer: not lockable
  OR
[OK] Trait locked (Salinity)

=== Final Summary ===
Targets: Sal=50 pH=50 Temp=50 Freq=50
Currents: Sal=67 pH=70 Temp=69 Freq=70
Vibes: 9
Locked count: 0
Streak days: 0
Locks: Sal=false pH=false Temp=false Freq=false
Wallet SP: 1

=== Smoke Test Complete ===
```

### Expected Behaviors

- **Goobs enforcement**: Should be disabled or already off
- **Initialization**: Either succeeds or is already done
- **Daily claim**: May show "already claimed today" if run multiple times in one day
- **Item application**: Currents should move toward targets (e.g., Sal 70→67, Temp 70→69)
- **SP burning**: Wallet SP should increase by 1 (for common items)
- **Vibes**: May fail if already sent today (cooldown)
- **Lock trait**: Usually fails because currents are not within 5% of targets (expected)

## Troubleshooting

### Common Issues

#### "Contract calls revert" or "addresses are zero"
- **Cause**: Incorrect environment variables
- **Fix**: Verify `STAB_V3` and `ITEM_V3` match your deployed contracts
- **Check**: Run `cast code $STAB_V3 --rpc-url $RPC` to verify contract exists

#### "No new items received"
- **Cause**: Daily items already claimed today for creature 999999
- **Fix**: Wait until next day, or use a different creature ID (modify script)
- **Note**: Script will continue and attempt to use existing items

#### "No items available to apply/burn"
- **Cause**: No items in wallet for creature 999999
- **Fix**: Ensure daily items were claimed, or manually mint items to deployer wallet
- **Note**: Script will skip these steps gracefully

#### "Send vibes failed: already sent vibes today"
- **Cause**: Vibes cooldown (one per day per creature)
- **Fix**: This is expected behavior - wait until next day
- **Note**: Script continues normally

#### "Lock trait failed: not lockable"
- **Cause**: Current trait value is not within 5% of target
- **Fix**: This is expected - apply more items to move currents closer to targets
- **Note**: Script continues normally

#### "Failed to disable enforcement"
- **Cause**: Deployer is not the owner of `STAB_V3`
- **Fix**: Ensure `DEPLOYER_PRIVATE_KEY` corresponds to the contract owner
- **Note**: Script will continue, but Goobs gating may block operations

### Using a Different Network

To run on a different network:

1. Update `RPC` to your network's RPC endpoint
2. Update `STAB_V3` and `ITEM_V3` to the deployed addresses on that network
3. Ensure deployer wallet has sufficient native tokens for gas

### Using a Different Creature ID

To test with a different creature ID:

1. Edit `scripts/GenericV3SmokeTest.s.sol`
2. Change the constant: `uint256 constant CREATURE_ID = 999999;` to your desired ID
3. Recompile and run

## Differences from Goob-Gated Test

This generic test differs from `GoobGatedV3SmokeTest.s.sol` in:

- **No Goobs requirement**: Uses arbitrary creature ID (999999)
- **Disables enforcement**: Attempts to turn off Goobs gating automatically
- **Simpler setup**: No need for `GOOBS_721` or `GOOB_ID` env vars
- **More portable**: Works on any network where V3 contracts are deployed

Use this test when:
- Testing on networks without Goobs deployed
- Verifying V3 functionality without Goobs ownership
- Running automated tests in CI/CD
- Testing on testnets or local networks

Use `GoobGatedV3SmokeTest.s.sol` when:
- Testing the full Goobs-gated flow on mainnet
- Verifying Goobs ownership checks
- Testing with real Goob NFTs



