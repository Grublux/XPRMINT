# External Image Base URI - Implementation Summary

## Overview

The Stabilization System now supports marketplace-friendly HTTP image URLs while preserving fully on-chain data URIs for purists. This allows Magic Eden, OpenSea, and other marketplaces to display item images correctly while maintaining the on-chain guarantee.

## What Was Changed

### Contract Changes (`ItemToken1155.sol`)

1. **New Storage Variable** (appended at end - backward compatible):
   ```solidity
   string public externalImageBaseURI;
   ```

2. **New Owner-Only Setter**:
   ```solidity
   function setExternalImageBaseURI(string calldata base) external onlyOwner;
   ```

3. **Updated `uri()` Function**:
   - Returns JSON with both `image` and `image_data` fields
   - `image`: HTTP URL when `externalImageBaseURI` is set, otherwise data URI (backward compatible)
   - `image_data`: Always the on-chain data URI (for purists)

### Frontend Changes

- **64 full-res PNGs** (1024x1024) copied to `public/items_full/`
- **Normalized filenames**: `item_0.png` → `0.png` (0-63)
- **Ready for Vercel**: Files will be served at `https://<vercel-domain>/items_full/{id}.png`

### Tests

- **New test suite**: `ItemExternalImageURI.t.sol` (5 tests, all passing)
- **Full test suite**: 44/44 tests passing (no regressions)

## Deployment Files

1. **`scripts/DeployItemToken1155V1_2.s.sol`**
   - Deploys new ItemToken1155 implementation
   - Output: Implementation address

2. **`scripts/UpgradeItemToken1155V1.s.sol`**
   - Upgrades V1 proxy to new implementation
   - Uses ProxyAdminV1
   - Verifies ownership and current implementation

3. **`scripts/SetExternalImageBaseURI.s.sol`**
   - Sets the external image base URI
   - Configures marketplace-friendly URLs

4. **`scripts/VerifyExternalImageURI.s.sol`**
   - Verifies upgrade and configuration
   - Checks metadata includes both image fields

## Quick Deployment Guide

### Prerequisites

```bash
export RPC=https://apechain.calderachain.xyz/http
export DEPLOYER_PRIVATE_KEY=<your_key>
export PROXY_ADMIN_V1=0xdb8047eD77099626e189316Ced0b25b46Ae0181d
export ITEM_TOKEN_PROXY_V1=0x9c4216d7b56a25b4b8a8eddefebaba389e05a01e
```

### Step 1: Deploy Implementation

```bash
forge script scripts/DeployItemToken1155V1_2.s.sol \
  --rpc-url $RPC \
  --broadcast

# Save the implementation address
export ITEM_TOKEN_IMPL_V1_2=<address_from_output>
```

### Step 2: Upgrade Proxy

```bash
forge script scripts/UpgradeItemToken1155V1.s.sol \
  --rpc-url $RPC \
  --broadcast
```

### Step 3: Set Base URI

```bash
export EXTERNAL_IMAGE_BASE_URI="https://xprmint.com/items_full/"

forge script scripts/SetExternalImageBaseURI.s.sol \
  --rpc-url $RPC \
  --broadcast
```

### Step 4: Verify

```bash
forge script scripts/VerifyExternalImageURI.s.sol --rpc-url $RPC
```

Or manually:

```bash
# Check base URI
cast call $ITEM_TOKEN_PROXY_V1 "externalImageBaseURI()(string)" --rpc-url $RPC

# Check metadata
cast call $ITEM_TOKEN_PROXY_V1 "uri(uint256)(string)" 0 --rpc-url $RPC | \
  sed 's/data:application\/json;base64,//' | base64 -d | jq .
```

## Metadata Structure

After upgrade and configuration, token metadata JSON includes:

```json
{
  "name": "Rust-Flake Calibrator",
  "description": "...",
  "image": "https://xprmint.com/items_full/0.png",
  "image_data": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "attributes": [...]
}
```

- **`image`**: HTTP URL (used by Magic Eden, OpenSea, etc.)
- **`image_data`**: On-chain data URI (for purists and our frontend)

## Backward Compatibility

- If `externalImageBaseURI` is not set (empty), behavior is identical to before:
  - `image` = data URI (same as `image_data`)
  - `image_data` = data URI
- Storage layout is preserved (new variable appended at end)
- All existing functionality remains unchanged

## Files Modified/Created

### Contracts
- `contracts/stabilization/items/ItemToken1155.sol` (modified)

### Tests
- `test/stabilization/ItemExternalImageURI.t.sol` (new)

### Scripts
- `scripts/DeployItemToken1155V1_2.s.sol` (new)
- `scripts/UpgradeItemToken1155V1.s.sol` (new)
- `scripts/SetExternalImageBaseURI.s.sol` (new)
- `scripts/VerifyExternalImageURI.s.sol` (new)

### Documentation
- `docs/stabilization/items_static_serving.md` (new)
- `docs/stabilization/EXTERNAL_IMAGE_URI_SUMMARY.md` (this file)
- `scripts/UPGRADE_V1_2_GUIDE.md` (new)

### Frontend
- `public/items_full/0.png` through `63.png` (64 files, new)

## Testing

All tests passing:
- ✅ 5 new tests in `ItemExternalImageURI.t.sol`
- ✅ 44 total tests in full suite
- ✅ No regressions

## Next Steps After Deployment

1. **Wait for Magic Eden refresh** (24-48 hours typically)
2. **Verify images appear** on Magic Eden and other marketplaces
3. **Monitor metadata** for any issues
4. **Update frontend** to use HTTP URLs for better performance (optional)

## Troubleshooting

See `scripts/UPGRADE_V1_2_GUIDE.md` for detailed troubleshooting steps.

Common issues:
- **Images not showing**: Verify base URI is set and files exist on Vercel
- **Upgrade fails**: Check ProxyAdminV1 ownership
- **Metadata incorrect**: Verify implementation upgrade succeeded



