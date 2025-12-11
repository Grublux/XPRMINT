# CraftedV5Positions Upgrade Runbook

## Overview

This document describes how to upgrade the CraftedV4Positions proxy at `0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E` to the new CraftedV5Positions implementation.

**Key Change**: CraftedV5Positions changes ERC2981 royalties to pay the **CURRENT NPC owner** directly, using `npcId` stored at craft time.

## Preflight Checklist

Before proceeding, ensure:

- [x] All local tests pass (see `test/crafted/CraftedV5PositionsRoyaltyToNPCTest.t.sol`)
- [x] Storage layout compatibility reviewed and confirmed (see `docs/STORAGE_LAYOUT_COMPARISON_CRAFTED_V4_V5.md`)
- [x] You control the owner EOA: `0x634989990acb7F95d07Ac09a6c35491Ac8dFa3Cf`
- [x] You have `APECHAIN_RPC_URL` set in your environment
- [x] You have `DEPLOYER_PRIVATE_KEY` or `PRIVATE_KEY` set (for owner EOA)
- [x] You have sufficient gas on the owner EOA for deployment + upgrade transaction

## Step 1: Dry-run on ApeChain Fork

**Purpose**: Test the upgrade script against a forked ApeChain without affecting mainnet.

### 1.1 Set Environment Variables

```bash
export APECHAIN_RPC_URL="<your_apechain_rpc_url>"
export CRAFTED_V4_POSITIONS_PROXY="0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E"
export DEPLOYER_PRIVATE_KEY="<your_test_private_key_for_fork_only>"
```

> ⚠️ **Important**: Use a test private key for fork testing, NOT your main owner EOA private key.

### 1.2 Run the Upgrade Script Against Fork

```bash
forge script script/UpgradeCraftedPositionsToV5.s.sol:UpgradeCraftedPositionsToV5 \
  --fork-url $APECHAIN_RPC_URL \
  --broadcast \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --slow \
  -vvv
```

**Expected output:**
- Deployment of CraftedV5Positions implementation
- Upgrade transaction to proxy
- Confirmation messages

### 1.3 Verify on Fork

#### 1.3.1 Check Implementation Slot

The proxy's implementation is stored at slot `0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC`.

```bash
cast storage 0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E \
  0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC \
  --rpc-url $APECHAIN_RPC_URL
```

**Expected**: The returned address should match the CraftedV5Positions implementation deployed by the script.

#### 1.3.2 Test royaltyInfo() on Fork

Pick a known position token ID that was crafted with an NPC:

```bash
# Replace <tokenId> with an actual token ID
cast call 0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E \
  "royaltyInfo(uint256,uint256)(address,uint256)" \
  <tokenId> 1000000000000000000 \
  --rpc-url $APECHAIN_RPC_URL
```

**Expected output**: `(address npcOwner, uint256 royaltyAmount)`

**Verify**:
1. The receiver address matches the current owner of the NPC that crafted the position
2. The royalty amount is correct (e.g., 5% of 1 ETH = 0.05 ETH = 50000000000000000)

#### 1.3.3 Verify NPC Owner Lookup

To confirm the NPC owner matches:

```bash
# First, get the npcId for the position from MasterCrafter
# (You may need to call MasterCrafterV5.positionNpcIdView(tokenId))

# Then check NPC owner
cast call 0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA \
  "ownerOf(uint256)(address)" \
  <npcId> \
  --rpc-url $APECHAIN_RPC_URL
```

The returned address should match the receiver from `royaltyInfo()`.

### 1.4 Test NPC Transfer on Fork (Optional but Recommended)

On a low-risk NPC and position:

1. Transfer the NPC from wallet A to wallet B:
   ```bash
   cast send 0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA \
     "transferFrom(address,address,uint256)" \
     <walletA> <walletB> <npcId> \
     --rpc-url $APECHAIN_RPC_URL \
     --private-key <walletA_private_key>
   ```

2. Call `royaltyInfo()` again for that position:
   ```bash
   cast call 0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E \
     "royaltyInfo(uint256,uint256)(address,uint256)" \
     <tokenId> 1000000000000000000 \
     --rpc-url $APECHAIN_RPC_URL
   ```

3. **Verify**: The receiver should now be wallet B (the new NPC owner).

## Step 2: Prepare for Live Upgrade

Before executing on mainnet:

- [ ] Confirm the fork behaves exactly as expected
- [ ] Double-check no unexpected storage changes (owner, masterCrafter, nextTokenId, etc.)
- [ ] Verify gas estimates are acceptable
- [ ] Ensure you are ready to sign a live transaction from the owner EOA
- [ ] Have a rollback plan (though storage layout is identical, so rollback is safe)

## Step 3: Execute Live Upgrade on ApeChain (Manual)

> ⚠️ **WARNING**: Do this ONLY when you are 100% satisfied with tests and fork behavior.

### 3.1 Set Environment Variables for Mainnet

```bash
export APECHAIN_RPC_URL="<your_apechain_rpc_url>"
export CRAFTED_V4_POSITIONS_PROXY="0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E"
export DEPLOYER_PRIVATE_KEY="<OWNER_EOA_PRIVATE_KEY>"
```

> ⚠️ **CRITICAL**: Use the **owner EOA private key** (`0x634989990acb7F95d07Ac09a6c35491Ac8dFa3Cf`), NOT a test key.

### 3.2 Run the Upgrade Script Against Live ApeChain

```bash
forge script script/UpgradeCraftedPositionsToV5.s.sol:UpgradeCraftedPositionsToV5 \
  --rpc-url $APECHAIN_RPC_URL \
  --broadcast \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --slow \
  -vvv
```

**What this does:**
1. Deploys a new `CraftedV5Positions` implementation contract
2. Calls `upgradeTo(newImpl)` on the proxy at `0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E`
3. The upgrade is executed by the owner EOA

### 3.3 Wait for Transaction Confirmation

Monitor the transaction on ApeScan:
- Transaction hash will be printed by `forge script`
- Wait for confirmation (usually 1-2 blocks on ApeChain)
- Verify the transaction succeeded

## Step 4: Post-Upgrade Verification on ApeChain

### 4.1 Verify Implementation Slot

Check that the proxy's implementation slot now points to the new CraftedV5Positions:

```bash
cast storage 0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E \
  0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC \
  --rpc-url $APECHAIN_RPC_URL
```

**Expected**: The returned address should match the CraftedV5Positions implementation deployed by the script.

**Decode the address:**
```bash
# The storage value is a 32-byte word, but the address is in the last 20 bytes
# You can use cast to format it:
cast --to-address <storage_value>
```

### 4.2 Verify Existing Positions Still Work

Pick an existing live crafted position (tokenId):

```bash
# Check that the position still exists and is owned correctly
cast call 0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E \
  "ownerOf(uint256)(address)" \
  <tokenId> \
  --rpc-url $APECHAIN_RPC_URL
```

**Expected**: Returns the position owner (should be unchanged).

### 4.3 Test royaltyInfo() on Live Contract

1. **Determine the position's npcId**:
   - Via MasterCrafter: `MasterCrafterV5.positionNpcIdView(tokenId)`
   - Or use your existing API/view functions

2. **Determine the NPC owner**:
   ```bash
   cast call 0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA \
     "ownerOf(uint256)(address)" \
     <npcId> \
     --rpc-url $APECHAIN_RPC_URL
   ```

3. **Call royaltyInfo() on the live contract**:
   ```bash
   cast call 0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E \
     "royaltyInfo(uint256,uint256)(address,uint256)" \
     <tokenId> 1000000000000000000 \
     --rpc-url $APECHAIN_RPC_URL
   ```

4. **Verify**:
   - ✅ The receiver address matches the NPC owner from step 2
   - ✅ The royalty amount matches expected BPS (e.g., 5% of 1 ETH = 0.05 ETH = 50000000000000000)

### 4.4 (Optional but Recommended) NPC Transfer Test on Live

On a **low-risk** NPC and position:

1. Transfer the NPC from wallet A to wallet B:
   ```bash
   cast send 0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA \
     "transferFrom(address,address,uint256)" \
     <walletA> <walletB> <npcId> \
     --rpc-url $APECHAIN_RPC_URL \
     --private-key <walletA_private_key>
   ```

2. Call `royaltyInfo()` again for that position:
   ```bash
   cast call 0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E \
     "royaltyInfo(uint256,uint256)(address,uint256)" \
     <tokenId> 1000000000000000000 \
     --rpc-url $APECHAIN_RPC_URL
   ```

3. **Verify**: The receiver should now be wallet B (the new NPC owner).

### 4.5 Verify Storage Values Are Preserved

Check that existing storage values are unchanged:

```bash
# Check owner
cast call 0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E \
  "owner()(address)" \
  --rpc-url $APECHAIN_RPC_URL

# Check masterCrafter
cast call 0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E \
  "masterCrafter()(address)" \
  --rpc-url $APECHAIN_RPC_URL

# Check nextTokenId (if you have a view function, or check totalSupply)
```

**Expected**: All values should match pre-upgrade values.

## Step 5: Record the Upgrade

Update any internal documentation to note:

- ✅ Crafted Positions royalties now go directly to the NPC owner via ERC2981
- ✅ RoyaltyRouter is no longer used as the royalty receiver
- ✅ The proxy at `0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E` now points to CraftedV5Positions
- ✅ Upgrade date and transaction hash
- ✅ Implementation contract address

## Troubleshooting

### Issue: "NOT_OWNER" Error

**Cause**: The deployer address doesn't match the proxy owner.

**Solution**: 
- Verify `DEPLOYER_PRIVATE_KEY` corresponds to `0x634989990acb7F95d07Ac09a6c35491Ac8dFa3Cf`
- Check the proxy owner: `cast call 0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E "owner()(address)" --rpc-url $APECHAIN_RPC_URL`

### Issue: "MASTER_CRAFTER_NOT_SET" Error

**Cause**: MasterCrafter address is not configured on the proxy.

**Solution**: 
- Check MasterCrafter: `cast call 0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E "masterCrafter()(address)" --rpc-url $APECHAIN_RPC_URL`
- If zero, set it before upgrading (though this should already be set)

### Issue: royaltyInfo() Returns Wrong Address

**Possible causes**:
1. NPC ID is 0 (old position crafted before NPC system) → Falls back to `_royaltyReceiver`
2. MasterCrafter not set → Falls back to `_royaltyReceiver`
3. NPC collection not set in MasterCrafter → Falls back to `_royaltyReceiver`

**Solution**: Verify the position has an NPC ID and all wiring is correct.

### Issue: Transaction Fails with "Out of Gas"

**Solution**: 
- Increase gas limit: Add `--gas-limit <higher_value>` to forge script command
- Check gas price: ApeChain may require higher gas prices

## Rollback Plan

If something goes wrong, you can rollback by upgrading back to CraftedV4Positions:

1. Deploy CraftedV4Positions implementation
2. Call `upgradeTo(oldImpl)` on the proxy

**Note**: Since storage layouts are identical, rollback is safe and will preserve all data.

## Additional Resources

- Storage Layout Comparison: `docs/STORAGE_LAYOUT_COMPARISON_CRAFTED_V4_V5.md`
- Royalty Documentation: `docs/CRAFTED_V5POSITIONS_ROYALTIES_NPC_OWNER.md`
- Test File: `test/crafted/CraftedV5PositionsRoyaltyToNPCTest.t.sol`
- Upgrade Script: `script/UpgradeCraftedPositionsToV5.s.sol`

## Support

For questions or issues:
- Review the test file for expected behavior
- Check storage layout comparison document
- Verify all environment variables are set correctly
- Ensure you're using the correct private key for the owner EOA

