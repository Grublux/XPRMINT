# Legacy Item Collections

This document catalogs all item collection contracts deployed for the Stabilization System and clearly identifies which version is canonical.

## Overview

The Stabilization System has undergone multiple iterations of item collection contracts. **Only V3 is canonical and actively used.** All previous versions (V0, V1, V2) are legacy and should not be used.

## Collection Versions

### V0 – Experimental Legacy

**Status:** LEGACY – DO NOT USE

- **Purpose:** Early experimental deployment
- **Address:** `ITEM_V0: 0x...` (fill from env / deployment logs)
- **Gameplay:** Not used by stabilizer
- **Minting:** Disabled (no further mints)
- **Notes:** Initial test deployment, superseded by V1

### V1 – Legacy On-Chain Image Version

**Status:** LEGACY – DO NOT USE

- **Purpose:** First production attempt with fully on-chain images (SSTORE2)
- **Address:** `ITEM_V1: 0x9C4216d7B56A25b4B8a8eDdEfeBaBa389E05A01E`
- **Gameplay:** Not used by stabilizer
- **Minting:** Disabled (no further mints)
- **Notes:** 
  - Uses on-chain data URIs for images
  - Visible on Magic Eden but marked as legacy
  - Superseded by V3 for better marketplace compatibility

### V2 – Partial Upgrade Attempt

**Status:** LEGACY – DO NOT USE

- **Purpose:** Attempted upgrade of V1 to add external image base URI support
- **Address:** `ITEM_V2: 0x...` (fill from env / deployment logs if deployed)
- **Gameplay:** Not used by stabilizer
- **Minting:** Disabled (no further mints)
- **Notes:** 
  - Upgrade path had architectural issues (nested ProxyAdmin)
  - Abandoned in favor of clean V3 deployment

### V3 – Canonical Stabilization Items (LIVE)

**Status:** CANONICAL – ACTIVE PRODUCTION

- **Purpose:** Current production item collection with marketplace-friendly image URLs
- **Address:** `ITEM_V3: 0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8`
- **Gameplay:** Used by `STAB_V3` (`CreatureStabilizerV3.itemToken == ITEM_V3`)
- **Minting:** Active (via `CreatureStabilizerV3` and admin functions)
- **Features:**
  - External image base URI: `https://xprmint.com/items_full/`
  - Dual image format: HTTP URLs (`image`) + on-chain data URIs (`image_data`)
  - Clean ProxyAdmin architecture (no nested admins)
  - Full upgradeability via `ProxyAdminV3`
- **Notes:** 
  - This is the **only** collection that should be used going forward
  - All frontends, scripts, and integrations should reference `ITEM_V3`

## Cleanup Process

### What We Did to Clean Up

The script `scripts/MarkLegacyItemCollections.s.sol` was created to:

1. **Rename legacy collections** on-chain:
   - V0/V1/V2 collections are renamed to clearly indicate "LEGACY – DO NOT USE"
   - Symbols are updated to `ITEMS-V0`, `ITEMS-V1`, `ITEMS-V2`
   - Contract URIs are set to legacy placeholder URLs

2. **Burn deployer-held test items**:
   - All items held by the deployer in V0/V1/V2 collections are burned (sent to dead address)
   - Only affects deployer's own balances; user balances are untouched
   - Prevents confusion from test items in legacy collections

3. **Graceful error handling**:
   - Script uses try/catch to handle contracts that may not implement all metadata functions
   - Script continues processing even if individual operations fail

### Running the Cleanup Script

```bash
export RPC=https://apechain.calderachain.xyz/http
export DEPLOYER_PRIVATE_KEY=0x...
export ITEM_V0=0x...  # optional, skip if empty
export ITEM_V1=0x...  # optional, skip if empty
export ITEM_V2=0x...  # optional, skip if empty

forge script scripts/MarkLegacyItemCollections.s.sol \
  --rpc-url $RPC \
  --broadcast \
  --private-key $DEPLOYER_PRIVATE_KEY
```

## Verification

### Verify V3 is Canonical

Use the read-only verification script to confirm V3 metadata:

```bash
export ITEM_V3=0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8

forge script scripts/VerifyV3CanonicalMetadata.s.sol --rpc-url $RPC
```

This will display:
- Collection name (should contain "Stabilization Items")
- Collection symbol (should contain "ITEMS")
- Contract URI
- External image base URI (should be set)

## Important Notes

- **Users should only interact with ITEM_V3**
- Legacy collections (V0/V1/V2) are marked as legacy on-chain to prevent marketplace confusion
- No new items should be minted to legacy collections
- The stabilizer (`STAB_V3`) only uses `ITEM_V3`
- All frontend integrations should reference `ITEM_V3` only

## Related Documentation

- `docs/stabilization/deploy-v3-mainnet.md` - V3 deployment guide
- `docs/stabilization/v3_image_base_uri.md` - V3 image configuration
- `docs/stabilization/smoke-test-mainnet.md` - Testing guide




