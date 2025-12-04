# V1 Image Deployment - Execution Commands

## Pre-Deployment Validation

All 64 images validated:
- ✅ Dimensions: 222×222 pixels
- ✅ File sizes: All <24KB
- ✅ Files exist: 64/64

## Deployment Command

```bash
# Set environment variables
export RPC=https://apechain.calderachain.xyz/http
export DEPLOYER_PRIVATE_KEY=<your_private_key>
export ITEM_CATALOG_PROXY_V1=0x06266255ee081aca64328de8fcc939923ee6e8c8
export ITEM_IMAGE_DEPLOYER_V1_2=0x2f3b1E18d5cEf4a487D0e31f0aCf77CA20F4d905
export ITEM_IMAGE_DIR=assets/items

# Deploy all 64 images
forge script scripts/UploadItemImages.s.sol \
  --rpc-url $RPC \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --slow \
  -vvv
```

## Post-Deployment Verification Commands

### 1. Verify SSTORE2 Code Size for Template 0

```bash
# Get imagePtr for template 0
TEMPLATE_0_PTR=$(cast call $ITEM_CATALOG_PROXY_V1 \
  "templates(uint256)" 0 \
  --rpc-url $RPC | \
  sed 's/0x//' | \
  grep -oE "[a-fA-F0-9]{40}" | \
  tail -1 | \
  sed 's/^/0x/')

echo "Template 0 imagePtr: $TEMPLATE_0_PTR"

# Check code size (should be >1000 bytes)
cast code $TEMPLATE_0_PTR --rpc-url $RPC | wc -c
# Expected: >1000 bytes (not just 3 bytes)
```

### 2. Verify Image Data URI

```bash
# Get image data URI
cast call $ITEM_CATALOG_PROXY_V1 \
  "getImageDataUri(address,string)" \
  $TEMPLATE_0_PTR "image/png" \
  --rpc-url $RPC

# Expected: String starting with "data:image/png;base64,..."
```

### 3. Verify Full ERC-1155 Token URI

```bash
export ITEM_V1=0x9c4216d7b56a25b4b8a8eddefebaba389e05a01e

# Get token URI and decode
cast call $ITEM_V1 "uri(uint256)(string)" 0 --rpc-url $RPC | \
  sed 's/^"//;s/"$//' | \
  sed 's/data:application\/json;base64,//' | \
  base64 -d | \
  python3 -m json.tool

# Expected JSON with:
# - "name": "..."
# - "description": "..."
# - "image": "data:image/png;base64,..." (with actual base64 data)
# - "attributes": [...]
```

### 4. Extract PNG from Token URI for Visual Inspection

```bash
# Extract and save PNG
cast call $ITEM_V1 "uri(uint256)(string)" 0 --rpc-url $RPC | \
  sed 's/^"//;s/"$//' | \
  sed 's/data:application\/json;base64,//' | \
  base64 -d | \
  python3 -c "import json, sys, base64; data = json.load(sys.stdin); img_data = data['image'].replace('data:image/png;base64,', ''); open('item_0_verification.png', 'wb').write(base64.b64decode(img_data))"

# View the image
open item_0_verification.png  # macOS
# or: xdg-open item_0_verification.png  # Linux
```

### 5. Verify Multiple Templates (Spot Check)

```bash
# Check templates 0, 10, 32, 57
for ID in 0 10 32 57; do
  echo "=== Template $ID ==="
  
  # Get imagePtr
  PTR=$(cast call $ITEM_CATALOG_PROXY_V1 \
    "templates(uint256)" $ID \
    --rpc-url $RPC | \
    sed 's/0x//' | \
    grep -oE "[a-fA-F0-9]{40}" | \
    tail -1 | \
    sed 's/^/0x/')
  
  echo "  imagePtr: $PTR"
  
  # Check code size
  CODE_SIZE=$(cast code $PTR --rpc-url $RPC 2>/dev/null | wc -c)
  echo "  Code size: $CODE_SIZE bytes"
  
  if [ "$CODE_SIZE" -gt 1000 ]; then
    echo "  ✅ Has image data"
  else
    echo "  ❌ No image data"
  fi
  echo ""
done
```

### 6. Verify All 64 Templates

```bash
# Count templates with valid images
TOTAL=0
WITH_IMAGE=0

for i in $(seq 0 63); do
  PTR=$(cast call $ITEM_CATALOG_PROXY_V1 \
    "templates(uint256)" $i \
    --rpc-url $RPC | \
    sed 's/0x//' | \
    grep -oE "[a-fA-F0-9]{40}" | \
    tail -1)
  
  if [ "$PTR" != "0000000000000000000000000000000000000000" ]; then
    CODE_SIZE=$(cast code "0x$PTR" --rpc-url $RPC 2>/dev/null | wc -c)
    if [ "$CODE_SIZE" -gt 1000 ]; then
      WITH_IMAGE=$((WITH_IMAGE + 1))
    fi
  fi
  TOTAL=$((TOTAL + 1))
  
  if [ $((i % 10)) -eq 0 ]; then
    echo "Progress: $i/63 checked..."
  fi
done

echo ""
echo "Templates with images: $WITH_IMAGE / $TOTAL"
echo "Expected: 64 / 64"
```

## Magic Eden Verification

After deployment, Magic Eden should automatically pick up the images from the token URIs. However, there may be caching delays:

1. **Wait 5-10 minutes** after deployment for Magic Eden to refresh
2. **Check token URI directly** using the commands above
3. **Verify base64 image data** is present in the JSON
4. **If images don't appear**, Magic Eden may need to re-index the collection

## Expected Output from Deployment

```
Deployer: 0x...
Catalog proxy: 0x06266255ee081aca64328de8fcc939923ee6e8c8
Image deployer: 0x2f3b1E18d5cEf4a487D0e31f0aCf77CA20F4d905
Total entries: 64

Uploaded assets/items/item_0.png -> 0x... (template 0)
Updated template 0 imagePtr to 0x...
...
Uploaded assets/items/item_63.png -> 0x... (template 63)
Updated template 63 imagePtr to 0x...

Successfully uploaded images for 64 templates
```

## Troubleshooting

### If SSTORE2 contracts have no code:
- Verify `ItemImageDeployerV1_2` bytecode is correct
- Check file sizes are actually <24KB
- Review transaction reverts on ApeScan

### If updateTemplateImage fails:
- Verify deployer is owner of catalog proxy
- Check catalog proxy has `updateTemplateImage` function
- Verify catalog is initialized

### If images don't appear in Magic Eden:
- Wait 5-10 minutes for cache refresh
- Verify token URIs include valid base64 images
- Check Magic Eden's collection page for re-index option




