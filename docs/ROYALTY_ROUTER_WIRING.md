# RoyaltyRouter Wiring Guide

## Overview

This document describes how CraftedV4Positions royalties are wired to the RoyaltyRouter, which routes royalty payments to NPCs based on which NPC crafted each position.

## Architecture

### Contract Flow

1. **CraftedV4Positions** implements ERC2981 and returns `RoyaltyRouter` as the royalty receiver via `royaltyInfo()`
2. When a marketplace or buyer pays royalties, they send tokens to the `RoyaltyRouter` address
3. The `RoyaltyRouter` receives payments and credits them to the appropriate NPC via `creditRoyalty(posId, amount)`
4. NPC owners can claim their accrued royalties via `claimForNpc(npcId)`

### Key Contracts

- **CraftedV4Positions Proxy**: `0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E`
- **RoyaltyRouter Proxy**: `0xbD5A38A8EB70d04F4ba8EFa82F9e85F22EE2784e`
- **MasterCrafterV5 Proxy**: `0xB461b4c9ff5F14fd8CEcF48600B9E95905199a29`
- **NPC Collection**: `0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA`

## On-Chain Verification

### 1. Verify Royalty Receiver

Check that `CraftedV4Positions.royaltyInfo()` returns `RoyaltyRouter` as the receiver:

```bash
# Using cast (Foundry)
cast call 0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E \
  "royaltyInfo(uint256,uint256)(address,uint256)" \
  <TOKEN_ID> \
  1000000000000000000 \
  --rpc-url $RPC_URL_APECHAIN

# Expected output:
# receiver: 0xbD5A38A8EB70d04F4ba8EFa82F9e85F22EE2784e (RoyaltyRouter)
# royaltyAmount: 69000000000000000 (6.9% of 1 APE = 0.069 APE)
```

### 2. Check Per-NPC Royalty Balances

Query the RoyaltyRouter to see accrued royalties for a specific NPC:

```bash
# Check claimable amount for NPC ID 1919
cast call 0xbD5A38A8EB70d04F4ba8EFa82F9e85F22EE2784e \
  "claimableForNpc(uint256)(uint256)" \
  1919 \
  --rpc-url $RPC_URL_APECHAIN

# Or use the public mapping directly
cast call 0xbD5A38A8EB70d04F4ba8EFa82F9e85F22EE2784e \
  "npcClaimable(uint256)(uint256)" \
  1919 \
  --rpc-url $RPC_URL_APECHAIN
```

### 3. Verify Router Configuration

Check that RoyaltyRouter is properly configured:

```bash
# Check positions contract
cast call 0xbD5A38A8EB70d04F4ba8EFa82F9e85F22EE2784e \
  "positions()(address)" \
  --rpc-url $RPC_URL_APECHAIN
# Should return: 0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E

# Check masterCrafter
cast call 0xbD5A38A8EB70d04F4ba8EFa82F9e85F22EE2784e \
  "masterCrafter()(address)" \
  --rpc-url $RPC_URL_APECHAIN
# Should return: 0xB461b4c9ff5F14fd8CEcF48600B9E95905199a29

# Check NPC collection
cast call 0xbD5A38A8EB70d04F4ba8EFa82F9e85F22EE2784e \
  "npcCollection()(address)" \
  --rpc-url $RPC_URL_APECHAIN
# Should return: 0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA

# Check royalty token
cast call 0xbD5A38A8EB70d04F4ba8EFa82F9e85F22EE2784e \
  "royaltyToken()(address)" \
  --rpc-url $RPC_URL_APECHAIN
# Should return the APE/WAPE token address
```

## Manual Testing Flow

### Step 1: Craft a Coin

1. Connect wallet with NGT balance
2. Select an NPC you own
3. Craft a coin using `MasterCrafterV5.craftWithNPC(recipeId, npcId)`
4. Note the resulting `positionId` (token ID)

### Step 2: Verify Royalty Info

```bash
# Replace <POSITION_ID> with the actual token ID
cast call 0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E \
  "royaltyInfo(uint256,uint256)(address,uint256)" \
  <POSITION_ID> \
  1000000000000000000 \
  --rpc-url $RPC_URL_APECHAIN
```

Expected: Receiver should be `0xbD5A38A8EB70d04F4ba8EFa82F9e85F22EE2784e`

### Step 3: Simulate Royalty Payment

In a production environment, royalties are paid automatically by marketplaces. For manual testing:

1. Transfer royalty tokens (APE/WAPE) to the RoyaltyRouter address
2. Call `creditRoyalty(posId, amount)` from the positions contract (requires positions contract to have a hook, or manual call if authorized)

**Note**: The current implementation requires `creditRoyalty` to be called by the positions contract. In production, this would be integrated into the positions contract's royalty receipt flow, or called by an authorized service.

### Step 4: Check NPC Balance

```bash
# Replace <NPC_ID> with the NPC that crafted the coin
cast call 0xbD5A38A8EB70d04F4ba8EFa82F9e85F22EE2784e \
  "claimableForNpc(uint256)(uint256)" \
  <NPC_ID> \
  --rpc-url $RPC_URL_APECHAIN
```

### Step 5: Claim as NPC Owner

As the owner of the NPC that crafted the coin:

```bash
# Using cast send (requires wallet with private key)
cast send 0xbD5A38A8EB70d04F4ba8EFa82F9e85F22EE2784e \
  "claimForNpc(uint256)" \
  <NPC_ID> \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL_APECHAIN
```

Or interact via ApeScan:
1. Go to: https://apescan.io/address/0xbD5A38A8EB70d04F4ba8EFa82F9e85F22EE2784e#writeContract
2. Connect wallet that owns the NPC
3. Call `claimForNpc(uint256)` with the NPC ID
4. Confirm transaction

## Important Notes

### Royalty Credit Mechanism

The `RoyaltyRouter.creditRoyalty(posId, amount)` function:
- Can only be called by the positions contract (`onlyPositions` modifier)
- Looks up the NPC that crafted the position via `MasterCrafterV5.positionNpcIdView(posId)`
- Credits the amount to that NPC's claimable balance

### NPC Ownership

- Only the current owner of an NPC can claim royalties for that NPC
- If an NPC is transferred, the new owner can claim all accrued royalties
- Previous owners lose the ability to claim after transfer

### Royalty Token

The RoyaltyRouter must have the `royaltyToken` address configured. This is the ERC20 token that will be used for royalty payments (typically APE or WAPE on ApeChain).

## Troubleshooting

### RoyaltyInfo returns wrong receiver

If `royaltyInfo()` doesn't return the RoyaltyRouter:
1. Verify the upgrade script was executed successfully
2. Check that `setRoyaltyReceiver()` was called on CraftedV4Positions
3. Verify the caller was the owner of the positions contract

### CreditRoyalty fails

If `creditRoyalty()` reverts:
1. Ensure it's being called from the positions contract address
2. Verify the position exists and has an associated NPC
3. Check that `masterCrafter` and `npcCollection` are set on RoyaltyRouter

### Claim fails

If `claimForNpc()` reverts:
1. Verify the caller owns the NPC (check `npcCollection.ownerOf(npcId)`)
2. Ensure there's a claimable balance (`claimableForNpc(npcId) > 0`)
3. Check that `royaltyToken` is configured on RoyaltyRouter

## Testing

Run the integration tests:

```bash
forge test --match-path test/royalties/RoyaltyRouterIntegration.t.sol -vv
```

This will verify:
- ✅ `royaltyInfo()` returns RoyaltyRouter as receiver
- ✅ Royalties accrue to the correct NPC
- ✅ Only NPC owners can claim
- ✅ NPC transfers update claim permissions correctly

