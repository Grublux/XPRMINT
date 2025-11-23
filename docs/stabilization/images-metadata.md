# Item Images and Metadata

This guide explains how to wire up item images for the Stabilization System and verify that metadata is correctly surfaced.

## Prerequisites

Before uploading images, ensure:

1. **ItemCatalog proxy is upgraded** - The `updateTemplateImage()` function is only available in the upgraded implementation. The catalog proxy must be upgraded to the new implementation (address: `0x256A7b1ca99661290B4375818a47eAD91faBaABC`) before images can be uploaded.
2. **catalog.json is generated and correct** - The catalog must already exist at `docs/stabilization_script/sim/items/output/catalog.json`
3. **PNG files are named correctly** - Each PNG must be named using the `image_key` from catalog.json (e.g., `item_0.png`, `item_1.png`, etc.)
4. **PNG files are in the correct directory** - By default, images should be in `public/items/`, but you can use a custom directory via `ITEM_IMAGE_DIR`

## Step 1: Verify Local Images

Before uploading, verify that all catalog entries have corresponding PNG files:

```bash
ITEM_IMAGE_DIR=public/items python3 docs/stabilization_script/sim/items/verify_images.py
```

Or if using a custom directory:

```bash
ITEM_IMAGE_DIR=assets/items python3 docs/stabilization_script/sim/items/verify_images.py
```

The script will:
- Check that each template in catalog.json has a corresponding PNG file
- Verify files are not zero-length
- Print a summary: `Images OK: 64/64 present` or list missing/invalid entries
- Exit with non-zero status if any images are missing (useful for CI)

**Example output:**
```
Images OK: 64/64 present
```

If images are missing, the script will list them:
```
Missing images:
  Template 0: item_0 -> public/items/item_0.png
  Template 5: item_5 -> public/items/item_5.png
```

## Step 2: Upgrade ItemCatalog (Required First)

**IMPORTANT:** The `updateTemplateImage()` function is only available in the upgraded ItemCatalog implementation. You must upgrade the catalog proxy first:

1. Ensure ProxyAdmin ownership is transferred (see `scripts/OWNERSHIP_TRANSFER_GUIDE.md`)
2. Run the upgrade script:
   ```bash
   forge script scripts/UpgradeContracts.s.sol \
     --rpc-url $APECHAIN_MAINNET_RPC_URL \
     --broadcast
   ```

This upgrades the catalog proxy to the new implementation that includes `updateTemplateImage()`.

## Step 3: Upload Images to On-Chain

Once the catalog is upgraded and images are verified locally, upload them via SSTORE2 and update the ItemCatalog:

### Environment Variables

Set these environment variables:

- `ITEM_CATALOG_PROXY` - Address of ItemCatalog proxy (same as `$CATALOG` from smoke tests)
- `ITEM_IMAGE_DEPLOYER` - Address of ItemImageDeployer contract
- `APECHAIN_MAINNET_RPC_URL` - RPC URL for ApeChain mainnet
- `ITEM_IMAGE_DIR` - Base directory for item PNGs (default: `public/items`)
- `DEPLOYER_PRIVATE_KEY` - Private key of the catalog owner

### Run the Upload Script

```bash
forge script scripts/UploadItemImages.s.sol \
  --rpc-url $APECHAIN_MAINNET_RPC_URL \
  --broadcast
```

The script will:
1. Read `catalog.json` from `docs/stabilization_script/sim/items/output/catalog.json`
2. For each template:
   - Read the PNG file from `ITEM_IMAGE_DIR/{image_key}.png`
   - Deploy it to SSTORE2 via `ItemImageDeployer.deployImage()`
   - Update the template's `imagePtr` using `ItemCatalog.updateTemplateImage()`
3. Print progress for each item: `Uploaded public/items/item_0.png -> 0x... (template 0)`

**Note:** The script is idempotent - you can re-run it to update image pointers if needed.

## Step 4: Verify Metadata URIs

After uploading, verify that metadata URIs are correctly generated:

```bash
# Set your environment variables
export STAB=0x...  # CreatureStabilizer proxy
export ITEM=0x...  # ItemToken1155 proxy
export CATALOG=0x...  # ItemCatalog proxy
export RPC=$APECHAIN_MAINNET_RPC_URL

# Check a few item URIs
cast call $ITEM "uri(uint256)(string)" 0 --rpc-url $RPC
cast call $ITEM "uri(uint256)(string)" 1 --rpc-url $RPC
cast call $ITEM "uri(uint256)(string)" 46 --rpc-url $RPC
```

The `uri()` function returns a JSON string with:
- `name` - Item name
- `description` - Item description
- `image` - Base64-encoded data URI (e.g., `data:image/png;base64,...`)
- `attributes` - Array of trait attributes including item name

**Example output:**
```json
{
  "name": "Rust-Flake Calibrator",
  "description": "A thumb-sized brass dial...",
  "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "collection": "Stabilization Items",
  "attributes": [
    {"trait_type": "Rarity", "value": "Common"},
    {"trait_type": "Item Name", "value": "Rust-Flake Calibrator"},
    ...
  ]
}
```

You can paste the returned JSON into a JSON viewer or use `jq` to format it:

```bash
cast call $ITEM "uri(uint256)(string)" 0 --rpc-url $RPC | jq .
```

## How It Works

1. **ItemToken1155.uri()** reads metadata from `ItemCatalog.getTemplate()`
2. **ItemCatalog.getTemplate()** returns the template including the `imagePtr` (SSTORE2 address)
3. **ItemCatalog.getImageDataUri()** reads bytes from SSTORE2 and encodes them as a base64 data URI
4. The metadata JSON is assembled with the image data URI included

**Important:** Only the `imagePtr` field is updated by the upload script. All other template fields (name, description, deltas, rarity) remain unchanged and come from the original catalog.json.

## Troubleshooting

- **"Image file not found"** - Check that `ITEM_IMAGE_DIR` is set correctly and PNGs exist
- **"OwnableUnauthorizedAccount"** - The deployer must be the owner of ItemCatalog
- **"ItemCatalog: invalid templateId"** - Template ID doesn't exist in catalog
- **Images not showing in marketplace** - Verify the metadata URI returns valid JSON with base64 image data

## Notes

- This process does **not** modify any game mechanics, rarity, deltas, or SP behavior
- Images are stored on-chain via SSTORE2, so they're permanently available
- The upload script only updates `imagePtr` - it does not modify other template fields
- ItemToken1155 already builds metadata from ItemCatalog templates; updating `imagePtr` is sufficient for images to appear in marketplaces

