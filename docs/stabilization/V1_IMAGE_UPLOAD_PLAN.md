# V1 Image Upload Pipeline - Final Execution Plan

## PRE-FLIGHT CHECKLIST

### ✅ Image Files (64/64)
- All files exist: `assets/items/item_0.png` → `item_63.png`
- All dimensions: 222×222 pixels
- All file sizes: 5KB - 23KB (all <24KB limit)
- **STATUS: READY**

### ✅ Required Files
- `scripts/UploadItemImages.s.sol` - ✅ Exists
- `contracts/stabilization/items/ItemImageDeployer.sol` - ✅ Exists (bytecode fixed)
- `docs/stabilization_script/sim/items/output/catalog.json` - ✅ Exists

### ✅ Code Verification
- `ItemImageDeployer.sol`: Bytecode uses correct length and offset (0x0c)
- `UploadItemImages.s.sol`: Supports V1_2 deployer, correct function calls

---

## C) LINE-BY-LINE EXECUTION PLAN

### Step 1: Set Environment Variables
```bash
export RPC=https://apechain.calderachain.xyz/http
export DEPLOYER_PRIVATE_KEY=<your_private_key>
export ITEM_CATALOG_PROXY_V1=0x06266255ee081aca64328de8fcc939923ee6e8c8
export ITEM_IMAGE_DEPLOYER_V1_2=0x2f3b1E18d5cEf4a487D0e31f0aCf77CA20F4d905
export ITEM_IMAGE_DIR=assets/items
```

### Step 2: Verify Environment
```bash
# Check RPC connectivity
cast block-number --rpc-url $RPC

# Verify catalog proxy exists
cast code $ITEM_CATALOG_PROXY_V1 --rpc-url $RPC

# Verify image deployer exists
cast code $ITEM_IMAGE_DEPLOYER_V1_2 --rpc-url $RPC
```

### Step 3: Dry Run (Simulation)
```bash
forge script scripts/UploadItemImages.s.sol \
  --rpc-url $RPC \
  -vvv
```

**Expected output:**
- Deployer address logged
- Catalog proxy address logged
- Image deployer address logged
- "Total entries: 64"
- Simulation of 64 `deployImage` calls
- Simulation of 64 `updateTemplateImage` calls
- No errors

### Step 4: Broadcast (Actual Deployment)
```bash
forge script scripts/UploadItemImages.s.sol \
  --rpc-url $RPC \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  -vvv
```

**Expected output:**
- Same as dry run, but with actual transactions
- Transaction hashes for each image deployment
- "Successfully uploaded images for 64 templates"
- Total gas used: ~30-40M gas (estimate)

### Step 5: Wait for Confirmations
- Wait for all transactions to be confirmed (check ApeScan)
- Verify no failed transactions

---

## D) FINAL FORGE COMMAND (BROADCAST-READY)

```bash
forge script scripts/UploadItemImages.s.sol \
  --rpc-url $RPC \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --slow \
  -vvv
```

**Flags:**
- `--rpc-url $RPC`: ApeChain mainnet RPC
- `--private-key $DEPLOYER_PRIVATE_KEY`: Deployer wallet
- `--broadcast`: Actually send transactions
- `--slow`: Add delays between transactions (recommended for 64 txs)
- `-vvv`: Verbose output for debugging

---

## E) POST-UPLOAD VERIFICATION STEPS

### 1. Verify SSTORE2 Contracts Have Code
```bash
# Get imagePtr for template 0
TEMPLATE_0_PTR=$(cast call $ITEM_CATALOG_PROXY_V1 \
  "templates(uint256)" 0 \
  --rpc-url $RPC | \
  sed 's/0x//' | \
  grep -oE "[a-fA-F0-9]{40}" | \
  tail -1 | \
  sed 's/^/0x/')

# Check code size (should be >100 bytes for real image)
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

# Get token URI
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

### 4. Verify Multiple Templates
```bash
# Check a few more templates (1, 10, 50, 63)
for ID in 1 10 50 63; do
  echo "Template $ID:"
  cast call $ITEM_CATALOG_PROXY_V1 \
    "templates(uint256)" $ID \
    --rpc-url $RPC | \
    grep -oE "0x[a-fA-F0-9]{40}" | \
    tail -1 | \
    xargs -I {} cast code {} --rpc-url $RPC | \
    wc -c
done

# All should show >1000 bytes
```

### 5. Verify All 64 Templates
```bash
# Count templates with non-zero imagePtr
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
    if [ "$CODE_SIZE" -gt 100 ]; then
      WITH_IMAGE=$((WITH_IMAGE + 1))
    fi
  fi
  TOTAL=$((TOTAL + 1))
done

echo "Templates with images: $WITH_IMAGE / $TOTAL"
# Expected: 64 / 64
```

---

## EXPECTED GAS COSTS

- Per image deployment: ~400K - 600K gas
- Per catalog update: ~50K - 100K gas
- **Total (64 images): ~30M - 40M gas**
- At 25 gwei: ~0.75 - 1.0 ETH

---

## TROUBLESHOOTING

### If SSTORE2 contracts have no code:
- Check `ItemImageDeployer` bytecode is correct
- Verify file sizes are actually <24KB
- Check transaction reverts on ApeScan

### If updateTemplateImage fails:
- Verify deployer is owner of catalog proxy
- Check catalog proxy has `updateTemplateImage` function
- Verify catalog is initialized

### If images don't appear in token URIs:
- Verify `imagePtr` is set in catalog
- Check `getImageDataUri` returns valid base64
- Verify `ItemToken1155.uri()` uses catalog's `imagePtr`

---

## SUCCESS CRITERIA

✅ All 64 images deployed to SSTORE2  
✅ All 64 `imagePtr` values set in catalog  
✅ All SSTORE2 contracts have >1000 bytes of code  
✅ Token URIs include valid base64 image data  
✅ Images display correctly in marketplaces  

---

**READY FOR DEPLOYMENT** 🚀




