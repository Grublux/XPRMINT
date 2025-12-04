# Item Image Static Serving

This document explains how item images are served via static HTTP URLs for marketplace compatibility.

## Overview

The Stabilization System supports two image delivery methods:

1. **On-chain data URIs** (`image_data`): Fully on-chain PNG images stored via SSTORE2, embedded as `data:image/png;base64,...` in metadata
2. **External HTTP URLs** (`image`): Marketplace-friendly HTTP URLs pointing to static files served by Vercel

Both fields are included in token metadata JSON, allowing marketplaces to use the HTTP URL while preserving on-chain data for purists.

## Static File Structure

Full-resolution item images (1024x1024 PNG) are stored in the frontend repository under:

```
public/items_full/
├── 0.png
├── 1.png
├── ...
└── 63.png
```

Each file corresponds to a template ID (0-63) in the `ItemCatalog`.

## Vercel Deployment

When deployed to Vercel, these files are automatically served at:

```
https://<vercel-domain>/items_full/0.png
https://<vercel-domain>/items_full/1.png
...
https://<vercel-domain>/items_full/63.png
```

## On-Chain Configuration

The `ItemToken1155` contract exposes an `externalImageBaseURI` storage variable that can be set by the owner:

```solidity
function setExternalImageBaseURI(string calldata base) external onlyOwner;
```

### Setting the Base URI

After deployment, the owner should set the base URI to match the Vercel domain:

```bash
export RPC=https://apechain.calderachain.xyz/http
export DEPLOYER_PRIVATE_KEY=<your_key>
export ITEM_TOKEN_PROXY_V1=0x9c4216d7b56a25b4b8a8eddefebaba389e05a01e
export EXTERNAL_IMAGE_BASE_URI="https://xprmint.com/items_full/"

forge script scripts/SetExternalImageBaseURI.s.sol \
  --rpc-url $RPC \
  --broadcast
```

**Important**: The base URI must end with a trailing slash (`/`) and should not include the filename. The contract appends `{id}.png` automatically.

## Metadata Structure

After setting `externalImageBaseURI`, token metadata JSON includes both fields:

```json
{
  "name": "Rust-Flake Calibrator",
  "description": "...",
  "image": "https://xprmint.com/items_full/0.png",
  "image_data": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "attributes": [...]
}
```

- `image`: HTTP URL (used by Magic Eden, OpenSea, etc.)
- `image_data`: On-chain data URI (for purists and our own frontend)

## Backward Compatibility

If `externalImageBaseURI` is not set (empty string), the contract falls back to fully on-chain behavior:

- `image` = `data:image/png;base64,...` (same as `image_data`)
- `image_data` = `data:image/png;base64,...`

This ensures the system remains self-contained even if static files are unavailable.

## Verification

After setting the base URI, verify metadata:

```bash
cast call $ITEM_V1 "uri(uint256)(string)" 0 --rpc-url $RPC
```

Decode the base64 JSON and confirm:
- `image` field contains the HTTP URL
- `image_data` field contains the on-chain data URI
- Both fields are present and valid

## File Management

### Adding New Images

When adding new item templates:
1. Add the full-res PNG to `public/items_full/{templateId}.png`
2. Commit and push to trigger Vercel deployment
3. The image will be available at `https://<vercel-domain>/items_full/{templateId}.png`
4. No on-chain changes needed (existing `externalImageBaseURI` will work for new IDs)

### Updating Existing Images

To update an item's image:
1. Replace the PNG file in `public/items_full/{id}.png`
2. Commit and push to trigger Vercel deployment
3. Marketplaces will pick up the new image on their next metadata refresh

**Note**: The on-chain `image_data` field will still point to the old SSTORE2 image until the catalog is updated via `updateTemplateImage()`.

## Troubleshooting

### Images Not Showing on Magic Eden

1. Verify the base URI is set correctly:
   ```bash
   cast call $ITEM_V1 "externalImageBaseURI()(string)" --rpc-url $RPC
   ```

2. Verify the file exists on Vercel:
   ```bash
   curl https://xprmint.com/items_full/0.png
   ```

3. Check metadata includes the HTTP URL:
   ```bash
   cast call $ITEM_V1 "uri(uint256)(string)" 0 --rpc-url $RPC | \
     sed 's/data:application\/json;base64,//' | base64 -d | jq .image
   ```

4. Magic Eden may cache metadata. Wait 24-48 hours or contact Magic Eden support to force a refresh.

### Images Showing as Broken

- Ensure the base URI ends with `/`
- Ensure the Vercel domain matches the base URI exactly
- Verify the PNG files are valid and not corrupted
- Check Vercel deployment logs for any build errors




