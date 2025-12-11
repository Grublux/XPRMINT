# Royalty Payment Automation

## The Problem

When a marketplace sells a CraftedV4Positions token:
1. Marketplace calls `royaltyInfo(tokenId, salePrice)` → gets `(RoyaltyRouter, amount)`
2. Marketplace transfers `amount` tokens directly to RoyaltyRouter
3. **But RoyaltyRouter doesn't know which `tokenId` the payment is for**

The `creditRoyalty(posId, amount)` function needs the `tokenId` to look up which NPC crafted it, but ERC2981 doesn't provide this context in the transfer.

## Solution: Off-Chain Automation

Since we can't force marketplaces to call a function, we need an off-chain service that:

1. **Monitors Transfer events** from the royalty token to RoyaltyRouter
2. **Monitors Transfer events** for CraftedV4Positions (when tokens are sold)
3. **Matches them up** by timestamp/block and calls `creditRoyalty()`

## Implementation Options

### Option 1: Event-Based Matching (Recommended)

**How it works:**
- Service watches `Transfer(address,address,uint256)` events on CraftedV4Positions
- Service watches `Transfer(address,address,uint256)` events on royalty token where `to == RoyaltyRouter`
- When a position is transferred (sale), look for a recent royalty token transfer to router
- Call `creditRoyalty(tokenId, amount)` from the positions contract

**Challenges:**
- Need to match transfers by timing (same block or recent blocks)
- Multiple sales could happen in same block
- Need to verify the amount matches `royaltyInfo()` calculation

### Option 2: Add Optional Helper Function

Add a function to CraftedV4Positions that marketplaces can optionally call:

```solidity
function onRoyaltyPaid(uint256 tokenId, uint256 amount) external {
    // Verify payment was made to router
    // Call router.creditRoyalty(tokenId, amount)
}
```

**Pros:** Simple, marketplaces can integrate if they want  
**Cons:** Can't force them to use it, still need fallback automation

### Option 3: Change Architecture (Major Change)

Make CraftedV4Positions the royalty receiver, then forward to router:

```solidity
// In CraftedV4Positions
receive() external payable {
    // But this doesn't tell us which tokenId...
}

// Or use ERC20 transfer hook (if supported)
function onERC20Received(address, uint256 amount, bytes calldata data) external {
    uint256 tokenId = abi.decode(data, (uint256));
    // Forward to router
}
```

**Pros:** Automatic, no off-chain needed  
**Cons:** Requires contract upgrade, ERC20 hooks aren't standard

## Recommended Approach: Hybrid

1. **Add optional helper function** to CraftedV4Positions (for marketplaces that want to integrate)
2. **Run off-chain automation service** as fallback (catches all sales)
3. **Monitor and alert** if royalties aren't credited within X blocks

## Off-Chain Service Implementation

### Pseudo-code:

```javascript
// Watch for position transfers (sales)
positionsContract.on('Transfer', (from, to, tokenId) => {
  if (from !== ZERO_ADDRESS) { // Not a mint
    // This is a sale
    const blockNumber = event.blockNumber;
    
    // Look for royalty payment in same/similar block
    royaltyTokenContract.queryFilter(
      royaltyTokenContract.filters.Transfer(null, ROYALTY_ROUTER, null),
      blockNumber - 1, // Check previous block too
      blockNumber + 1
    ).then(transfers => {
      // Match by amount
      const royaltyInfo = await positionsContract.royaltyInfo(tokenId, salePrice);
      const matchingTransfer = transfers.find(t => t.args.value === royaltyInfo.amount);
      
      if (matchingTransfer) {
        // Call creditRoyalty from positions contract
        await positionsContract.creditRoyalty(tokenId, royaltyInfo.amount);
      }
    });
  }
});
```

### Service Requirements:

- Monitor both contracts continuously
- Match transfers by block/timing
- Handle edge cases (multiple sales, failed matches)
- Retry logic for failed transactions
- Alerting for unmatched royalties

## Current State

Right now, `creditRoyalty()` can only be called by the positions contract (`onlyPositions` modifier). For the automation service to work, we'd need to either:

1. **Add a function to CraftedV4Positions** that calls `creditRoyalty()` (recommended)
2. **Or change `creditRoyalty()` to allow authorized callers** (less secure)

## Next Steps

1. Add `forwardRoyalty(uint256 tokenId, uint256 amount)` to CraftedV4Positions
2. Deploy off-chain automation service
3. Test with real marketplace sales
4. Monitor and alert on unmatched royalties

