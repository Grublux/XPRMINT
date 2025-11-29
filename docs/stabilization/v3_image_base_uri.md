# V3 Image Base URI Configuration

## Overview

`ItemToken1155V3` supports dual image formats in token metadata to ensure compatibility with marketplaces while preserving on-chain image data:

- **`image`**: HTTP URL (marketplace-friendly, e.g., `https://xprmint.com/items_full/0.png`)
- **`image_data`**: On-chain data URI (base64-encoded PNG from SSTORE2, for purists)

When `externalImageBaseURI` is set, the `uri(uint256 id)` function includes both fields:
- `image`: HTTP URL constructed as `{externalImageBaseURI}{id}.png`
- `image_data`: Always included if available (on-chain PNG data URI)

If `externalImageBaseURI` is empty, `image` falls back to the on-chain data URI.

## Production Configuration

**Base URI:** `https://xprmint.com/items_full/`

This base URI is appended with the item ID and `.png` extension to form the final image URL:
- Item 0: `https://xprmint.com/items_full/0.png`
- Item 1: `https://xprmint.com/items_full/1.png`
- Item 63: `https://xprmint.com/items_full/63.png`

## Setup Commands

### Prerequisites

```bash
export RPC=https://apechain.calderachain.xyz/http
export ITEM_V3=0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8
export DEPLOYER_PRIVATE_KEY=<your_deployer_private_key>
```

### Step 1: Check Current Configuration

**Read current `externalImageBaseURI`:**
```bash
cast call $ITEM_V3 "externalImageBaseURI()(string)" --rpc-url $RPC
```

**Read current token URI for item 0:**
```bash
cast call $ITEM_V3 "uri(uint256)(string)" 0 --rpc-url $RPC
```

The URI will be a base64-encoded JSON. You can decode it to see the current metadata structure.

### Step 2: Set External Image Base URI

**Set the base URI to production URL:**
```bash
cast send $ITEM_V3 "setExternalImageBaseURI(string)" \
  "https://xprmint.com/items_full/" \
  --rpc-url $RPC \
  --private-key $DEPLOYER_PRIVATE_KEY
```

### Step 3: Verify Configuration

**Verify `externalImageBaseURI` was set:**
```bash
cast call $ITEM_V3 "externalImageBaseURI()(string)" --rpc-url $RPC
```

Expected output: `https://xprmint.com/items_full/`

**Verify token URI includes both `image` and `image_data`:**
```bash
cast call $ITEM_V3 "uri(uint256)(string)" 0 --rpc-url $RPC
```

The decoded JSON should include:
```json
{
  "name": "...",
  "description": "...",
  "image": "https://xprmint.com/items_full/0.png",
  "image_data": "data:image/png;base64,...",
  "collection": "Stabilization Items",
  "attributes": [...]
}
```

## Marketplace Compatibility

Marketplaces like Magic Eden and ApeScan will:
1. Use the `image` field (HTTP URL) for display
2. Optionally use `image_data` as a fallback or for verification

The dual format ensures:
- **Fast loading**: HTTP URLs are cached by CDNs and browsers
- **On-chain verification**: `image_data` proves the image is stored on-chain
- **Backward compatibility**: If `externalImageBaseURI` is unset, `image` falls back to `image_data`

## Troubleshooting

**If images don't show on Magic Eden:**
1. Verify `externalImageBaseURI` is set correctly
2. Verify the HTTP URLs are accessible (e.g., `curl https://xprmint.com/items_full/0.png`)
3. Check that the token URI JSON includes the `image` field
4. Ensure images are 1024x1024 PNGs (as per marketplace requirements)

**If `image_data` is missing:**
- This means the item template in `ItemCatalog` doesn't have an `imagePtr` set
- Run `scripts/UploadItemImages.s.sol` to upload images to SSTORE2 and update catalog entries

## Related Documentation

- `docs/stabilization/deploy-v3-mainnet.md`: Full V3 deployment guide
- `docs/stabilization/images-metadata.md`: Image upload and metadata verification



