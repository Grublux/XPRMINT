# Storage Layout Comparison: CraftedV4Positions vs CraftedV5Positions

## Overview

This document compares the storage layout (state variable definitions) between `CraftedV4Positions` and `CraftedV5Positions` to verify compatibility for proxy upgrades.

**Key Finding**: The storage layouts are **IDENTICAL** in order and types. The only difference is that `royaltyRouter` is moved from the ROYALTY STATE section to a later section in V5, but this does not affect storage slot ordering since it's still present in the contract.

---

## Storage Layout Comparison

### A) CraftedV4Positions.sol Storage Layout

```solidity
// ------------------------------------------------------------
// PROXY-SAFE OWNERSHIP
// ------------------------------------------------------------

address public owner;
bool private _initialized;

// ------------------------------------------------------------
// ERC721 STATE
// ------------------------------------------------------------

address public masterCrafter;
uint256 private _nextTokenId = 1;
string private _baseTokenURI;

// ------------------------------------------------------------
// ROYALTY STATE
// ------------------------------------------------------------

address private _royaltyReceiver;
uint96 private _royaltyBps;
address public royaltyRouter; // RoyaltyRouter proxy address (for forwarding)
```

**Total State Variables (in order):**
1. `address public owner;`
2. `bool private _initialized;`
3. `address public masterCrafter;`
4. `uint256 private _nextTokenId = 1;`
5. `string private _baseTokenURI;`
6. `address private _royaltyReceiver;`
7. `uint96 private _royaltyBps;`
8. `address public royaltyRouter;`

---

### B) CraftedV5Positions.sol Storage Layout

```solidity
// ------------------------------------------------------------
// PROXY-SAFE OWNERSHIP
// ------------------------------------------------------------

address public owner;
bool private _initialized;

// ------------------------------------------------------------
// ERC721 STATE
// ------------------------------------------------------------

address public masterCrafter;
uint256 private _nextTokenId = 1;
string private _baseTokenURI;

// ------------------------------------------------------------
// ROYALTY STATE
// ------------------------------------------------------------

address private _royaltyReceiver;  // Kept for backward compatibility, but not used in royaltyInfo
uint96 private _royaltyBps;

// ------------------------------------------------------------
// V5: NPC ROYALTY STATE (APPEND-ONLY)
// ------------------------------------------------------------
// Note: npcCollection is read from MasterCrafter, no new storage needed

// ... (functions and other code) ...

// ------------------------------------------------------------
// ROYALTY FORWARDING (kept for backward compatibility, but not used in V5)
// ------------------------------------------------------------

address public royaltyRouter; // Kept for backward compatibility
```

**Total State Variables (in order):**
1. `address public owner;`
2. `bool private _initialized;`
3. `address public masterCrafter;`
4. `uint256 private _nextTokenId = 1;`
5. `string private _baseTokenURI;`
6. `address private _royaltyReceiver;`
7. `uint96 private _royaltyBps;`
8. `address public royaltyRouter;` *(moved to later section, but same storage slot)*

---

## Side-by-Side Comparison

| Slot | CraftedV4Positions | CraftedV5Positions | Match? |
|------|-------------------|-------------------|--------|
| 1 | `address public owner;` | `address public owner;` | ✅ |
| 2 | `bool private _initialized;` | `bool private _initialized;` | ✅ |
| 3 | `address public masterCrafter;` | `address public masterCrafter;` | ✅ |
| 4 | `uint256 private _nextTokenId = 1;` | `uint256 private _nextTokenId = 1;` | ✅ |
| 5 | `string private _baseTokenURI;` | `string private _baseTokenURI;` | ✅ |
| 6 | `address private _royaltyReceiver;` | `address private _royaltyReceiver;` | ✅ |
| 7 | `uint96 private _royaltyBps;` | `uint96 private _royaltyBps;` | ✅ |
| 8 | `address public royaltyRouter;` | `address public royaltyRouter;` | ✅ |

---

## Analysis

### Storage Layout Compatibility: ✅ SAFE

1. **All state variables are present in both versions** - No variables were removed or added
2. **Variable order is identical** - All variables appear in the same order
3. **Variable types are identical** - All types match exactly
4. **Variable visibility matches** - `public`/`private` modifiers are the same
5. **Initial values match** - `_nextTokenId = 1` is the same in both

### Key Differences (Non-Storage)

1. **`royaltyRouter` location**: 
   - V4: Located in the "ROYALTY STATE" section (line 56)
   - V5: Located in the "ROYALTY FORWARDING" section (line 271)
   - **Impact**: None - The variable still occupies the same storage slot regardless of where it's declared in the code

2. **Comments**:
   - V5 adds comments indicating `_royaltyReceiver` is kept for backward compatibility
   - V5 adds a comment section for "V5: NPC ROYALTY STATE" but no new storage variables

3. **No new storage variables**:
   - V5 does NOT add any new state variables
   - NPC collection is read from MasterCrafter, not stored locally

### Storage Slot Calculation

In Solidity, storage slots are assigned sequentially based on declaration order, not code organization. Since both contracts declare variables in the same order, they will use identical storage slots:

- **Slot 0**: `owner` (address = 20 bytes, fits in 1 slot)
- **Slot 1**: `_initialized` (bool = 1 byte, fits in slot 1 with owner)
- **Slot 2**: `masterCrafter` (address = 20 bytes, new slot)
- **Slot 3**: `_nextTokenId` (uint256 = 32 bytes, new slot)
- **Slot 4**: `_baseTokenURI` (string, dynamic, uses slot for length + data)
- **Slot 5**: `_royaltyReceiver` (address = 20 bytes, new slot)
- **Slot 6**: `_royaltyBps` (uint96 = 12 bytes, fits in slot 6)
- **Slot 7**: `royaltyRouter` (address = 20 bytes, new slot)

---

## Upgrade Safety Verification

✅ **SAFE TO UPGRADE**: The storage layouts are 100% compatible.

### Verification Checklist

- [x] All existing state variables are present in V5
- [x] Variable order is identical
- [x] Variable types match exactly
- [x] No new state variables added (no storage collision risk)
- [x] No state variables removed (no data loss risk)
- [x] Initial values are the same
- [x] Visibility modifiers match

### Proxy Upgrade Impact

When upgrading from `CraftedV4Positions` to `CraftedV5Positions`:

1. **Existing data preserved**: All existing state values will remain intact
2. **No storage collisions**: No new variables added, so no risk of overwriting existing data
3. **No data loss**: All variables from V4 exist in V5
4. **Functionality changes**: Only the `royaltyInfo()` function logic changes (view function, no storage impact)

---

## Notes

- The `royaltyRouter` variable is kept in V5 for backward compatibility but is not used in the new `royaltyInfo()` implementation
- NPC collection address is read dynamically from `MasterCrafterV5.npcCollection()`, so no new storage is needed
- All other functionality remains identical between V4 and V5

---

## Conclusion

**The storage layouts are identical and the upgrade is safe.** The proxy can be upgraded from `CraftedV4Positions` to `CraftedV5Positions` without any risk of storage collisions or data loss.

