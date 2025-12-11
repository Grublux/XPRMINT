# MasterCrafterV5 Upgrade Summary

## Overview
MasterCrafterV5 fixes destruction logic, adds team fee support, global destruction pause, rich destroy events, and a quote helper function.

## Key Changes

### 1. Fixed Destruction Logic
- **Always records stats consistently**: `feeAmount = 10%`, `returnAmount = 90%` for NPCStats
- **Crafter destroys own coin**: 
  - Transfers 100% - teamFee to destroyer (team fee still applies if configured)
  - NPC fee (10%) is paid to themselves (no transfer needed)
  - Records 90% return + 10% fee in stats for consistency
- **Non-crafter destroys**: 
  - Transfers 10% to NPC owner, teamFee to team recipient (if configured), remaining to destroyer
  - Records same stats (90% return, 10% fee)
- **Always increments `destroys` counter** in NPCStats

### 2. Team Destruction Fee (Append-Only Storage)
- `address public teamDestroyFeeRecipient` - Address to receive team fees
- `uint16 public teamDestroyFeeBps` - Team fee in basis points (0 = disabled, max 1000 = 10%)
- Team fee is applied **on top of** NPC fee (10%)
- Team fee applies to **both** crafter and non-crafter destroys
- Default: `teamDestroyFeeBps = 0` (no-op behavior)

### 3. Global Destruction Pause
- `bool public destructionPaused` - Global pause flag for all destruction operations
- `setDestructionPaused(bool paused)` - Owner-only function to pause/unpause
- When paused: `destroyPosition` reverts with `"DESTRUCTION_PAUSED"`
- `getDestroyQuote` is **not** gated by pause (remains callable for frontend preview)

### 3. Rich Destroy Event
```solidity
event PositionDestroyed(
    uint256 indexed positionId,
    uint256 indexed npcId,
    address indexed destroyer,
    uint256 totalLocked,
    uint256 npcFee,
    uint256 teamFee,
    uint256 refundToDestroyer
);
```

### 4. Quote Helper Function
```solidity
function getDestroyQuote(uint256 posId, address destroyer) 
    external 
    view 
    returns (
        uint256 totalLocked,
        uint256 npcFee,
        uint256 teamFee,
        uint256 refund
    )
```

## Storage Layout
- **No changes to existing storage order**
- **Only appends** new storage variables:
  - `teamDestroyFeeRecipient` (after `positionForge` mapping)
  - `teamDestroyFeeBps` (after `teamDestroyFeeRecipient`)

## Behavior Examples

### Example 1: Crafter Destroys Own Coin (1000 NGT locked, no team fee)
- **Transfer**: 1000 NGT to destroyer (single transfer, no NPC fee transfer needed)
- **Stats Recorded**: 
  - `totalNGTReturned = 900` (90%)
  - `totalNGTFee = 100` (10%)
  - `destroys += 1`

### Example 2: Crafter Destroys Own Coin (1000 NGT locked, 2% team fee)
- **Transfers**: 
  - 20 NGT to team fee recipient
  - 980 NGT to destroyer
- **Stats Recorded**: Same as Example 1 (team fee not tracked in NPCStats)

### Example 3: Non-Crafter Destroys (1000 NGT locked, no team fee)
- **Transfers**: 
  - 100 NGT to NPC owner (10% fee)
  - 900 NGT to destroyer
- **Stats Recorded**: Same as Example 1

### Example 4: Non-Crafter Destroys (1000 NGT locked, 2% team fee)
- **Transfers**: 
  - 100 NGT to NPC owner (10% fee)
  - 20 NGT to team fee recipient (2% fee)
  - 880 NGT to destroyer
- **Stats Recorded**: Same as Example 1 (team fee not tracked in NPCStats)

## Upgrade Path
1. Deploy `MasterCrafterV5` implementation
2. Call `upgradeTo(newImplementation)` on MasterCrafterV4 proxy
3. (Optional) Set team fee: `setTeamDestroyFeeBps(uint16)` and `setTeamDestroyFeeRecipient(address)`
4. (Optional) Pause destruction if needed: `setDestructionPaused(true)`

## Using getDestroyQuote

The `getDestroyQuote` function allows the frontend to preview destruction outcomes before executing:

```solidity
(uint256 totalLocked, uint256 npcFee, uint256 teamFee, uint256 refund) = 
    masterCrafter.getDestroyQuote(positionId, destroyerAddress);
```

**Important**: The quote function:
- Returns the exact values that `destroyPosition` would use
- Accounts for whether destroyer is the crafter (different refund calculation)
- Includes team fee if configured
- Can be called even when `destructionPaused = true` (for UI preview)
- Will revert with same validation errors as `destroyPosition` (invalid position, wrong owner, still locked)

## Testing
See `test/crafted/MasterCrafterV5.destroy.t.sol` for comprehensive test coverage:
- Crafter destroying own coin
- Non-crafter destroying
- Team fee application
- Quote helper function
- Event emission

## Files Changed
- `contracts/crafted/MasterCrafterV5.sol` - New implementation
- `test/crafted/MasterCrafterV5.destroy.t.sol` - Test suite

## Backward Compatibility
- ✅ All existing function signatures unchanged
- ✅ Storage layout compatible (append-only)
- ✅ Existing `Destroyed` event still emitted
- ✅ No breaking changes to metadata or external interfaces

