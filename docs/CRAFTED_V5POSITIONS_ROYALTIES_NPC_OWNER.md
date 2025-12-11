# CraftedV5Positions: NPC-Owner-Based Royalties

## Overview

`CraftedV5Positions` is an upgraded implementation of `CraftedV4Positions` that changes how ERC2981 royalties are distributed. Instead of routing royalties through a `RoyaltyRouter` contract, royalties now go **directly to the CURRENT owner of the NPC that crafted the position**.

## Key Changes

### Royalty Receiver Logic

In `CraftedV5Positions`, the `royaltyInfo(uint256 tokenId, uint256 salePrice)` function:

1. **Looks up the NPC ID** that crafted the position via `MasterCrafterV5.positionNpcIdView(tokenId)`
2. **Gets the current owner** of that NPC via `NPC_ERC721.ownerOf(npcId)`
3. **Returns the NPC owner** as the royalty receiver, along with the calculated royalty amount

### Lookup Chain

```
tokenId (position)
  ↓
MasterCrafterV5.positionNpcIdView(tokenId) → npcId
  ↓
NPC_ERC721.ownerOf(npcId) → current NPC owner
  ↓
royaltyInfo returns (current NPC owner, royaltyAmount)
```

### Dynamic Royalty Receiver

The royalty receiver **dynamically updates** when NPC ownership changes:

- If Alice crafts a position using NPC #1 (owned by Alice), royalties go to Alice
- If Alice transfers NPC #1 to Bob, royalties for that position now go to Bob
- The position itself remains unchanged - only the royalty receiver updates

## Example

### Scenario

1. Alice owns NPC #1
2. Alice crafts a position (token ID 100) using NPC #1
3. Position 100 is later sold for 10 ETH on a marketplace

### Royalty Calculation

- Sale price: 10 ETH
- Royalty BPS: 500 (5%)
- Royalty amount: `10 ETH * 500 / 10_000 = 0.5 ETH`

### Royalty Receiver

- Marketplace calls `royaltyInfo(100, 10e18)`
- Contract looks up: `positionNpcIdView(100)` → returns `1` (NPC #1)
- Contract checks: `NPC_ERC721.ownerOf(1)` → returns Alice's address
- Marketplace sends 0.5 ETH directly to Alice

### After NPC Transfer

- Alice transfers NPC #1 to Bob
- Position 100 is sold again for 10 ETH
- Marketplace calls `royaltyInfo(100, 10e18)` again
- Contract checks: `NPC_ERC721.ownerOf(1)` → now returns Bob's address
- Marketplace sends 0.5 ETH directly to Bob (not Alice)

## Fallback Behavior

`CraftedV5Positions` includes fallback logic for edge cases:

1. **If `masterCrafter` is not set**: Falls back to the original `_royaltyReceiver` address
2. **If `npcId` is 0** (e.g., old positions crafted before NPC system): Falls back to `_royaltyReceiver`
3. **If NPC collection is not set in MasterCrafter**: Falls back to `_royaltyReceiver`

This ensures backward compatibility with any edge cases.

## RoyaltyRouter Status

The `RoyaltyRouter` contract remains deployed on-chain but is **no longer used** for ERC2981 royalties. It may still be used for other internal reward flows if desired, but marketplaces will receive the NPC owner's address directly from `royaltyInfo()`.

## Storage Layout

`CraftedV5Positions` preserves the **exact storage layout** of `CraftedV4Positions`:

- All existing state variables remain in the same order
- No new storage variables are added (NPC collection is read from MasterCrafter)
- This ensures safe proxy upgrades without storage collisions

## Upgrade Process

### Prerequisites

1. ✅ All tests in `CraftedV5PositionsRoyaltyToNPCTest.t.sol` pass
2. ✅ Storage layout compatibility verified
3. ✅ Code review completed
4. ✅ User approval obtained

### Upgrade Script

The upgrade script `script/UpgradeCraftedPositionsToV5.s.sol` will:

1. Deploy `CraftedV5Positions` as a new implementation contract
2. Call `upgradeTo(newImpl)` on the existing proxy at `0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E`
3. No additional wiring needed (MasterCrafter and NPC collection are already configured)

### Manual Execution

**IMPORTANT**: The upgrade script is a template and must be run manually after review:

```bash
# Set environment variables
export CRAFTED_V4_POSITIONS_PROXY=0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E
export DEPLOYER_PRIVATE_KEY=<your_deployer_private_key>

# Run the upgrade script
forge script script/UpgradeCraftedPositionsToV5.s.sol:UpgradeCraftedPositionsToV5 \
  --rpc-url <apechain_rpc_url> \
  --broadcast \
  --verify
```

### Post-Upgrade Verification

After upgrading, verify:

1. **Proxy implementation address** has changed on ApeScan
2. **royaltyInfo()** returns NPC owner addresses for positions
3. **Existing positions** continue to function normally
4. **No storage collisions** occurred

## Testing

Comprehensive tests are available in `test/crafted/CraftedV5PositionsRoyaltyToNPCTest.t.sol`:

- ✅ `test_RoyaltyInfoPointsToCurrentNPCOwner`: Verifies royalties follow NPC ownership
- ✅ `test_RoyaltyInfoDoesNotReturnRouter`: Confirms RoyaltyRouter is not used
- ✅ `test_RoyaltyInfoFallbackWhenMasterCrafterNotSet`: Tests fallback behavior
- ✅ `test_RoyaltyInfoWithDifferentSalePrices`: Tests various sale prices
- ✅ `test_RoyaltyInfoAfterMultipleNPCTransfers`: Tests multiple ownership changes

Run tests with:

```bash
forge test --match-path test/crafted/CraftedV5PositionsRoyaltyToNPCTest.t.sol -vv
```

## Contract Addresses

- **CraftedV4Positions Proxy**: `0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E` (ApeChain)
- **NPC_ERC721 Collection**: `0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA` (ApeChain)
- **MasterCrafterV5 Proxy**: `0xB461b4c9ff5F14fd8CEcF48600B9E95905199a29` (ApeChain)

## Benefits

1. **Direct Payments**: NPC owners receive royalties directly from marketplaces
2. **No Middleware**: No need for RoyaltyRouter or off-chain automation
3. **Dynamic Updates**: Royalties automatically follow NPC ownership changes
4. **ERC2981 Compliant**: Standard royalty interface, works with all major marketplaces
5. **Backward Compatible**: Fallback behavior ensures old positions still work

## Security Considerations

- ✅ Storage layout preserved (no collisions)
- ✅ Fallback logic for edge cases
- ✅ View-only function (no state changes)
- ✅ Comprehensive test coverage
- ✅ Proxy upgrade pattern (UUPS) with owner-only upgrade

## Questions?

For questions or issues, refer to:
- Test file: `test/crafted/CraftedV5PositionsRoyaltyToNPCTest.t.sol`
- Implementation: `contracts/crafted/CraftedV5Positions.sol`
- Upgrade script: `script/UpgradeCraftedPositionsToV5.s.sol`

