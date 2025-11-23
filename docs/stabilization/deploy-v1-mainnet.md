# Deploy Stabilization Items V1 to ApeChain Mainnet

This guide provides a step-by-step runbook for deploying and verifying the Stabilization Items V1 collection on ApeChain mainnet.

## 1. Pre-flight (Local)

Before deploying to mainnet, verify everything is in order locally:

### Build and Test
```bash
forge build
forge test
```

All tests should pass. If any fail, fix them before proceeding.

### Generate and Validate Catalog
```bash
python3 docs/stabilization_script/sim/items/generate_catalog_json.py
python3 docs/stabilization_script/sim/items/validate_catalog.py
```

This generates `docs/stabilization_script/sim/items/output/catalog.json` with 64 item templates and validates that all deltas are within expected ranges.

### (Optional) Dry-Run Deployment Scripts
```bash
export RPC=https://apechain.calderachain.xyz/http
forge script scripts/DeployStabilizationSystemV1.s.sol --rpc-url $RPC
forge script scripts/DeployItemCatalogV1.s.sol --rpc-url $RPC
forge script scripts/UploadItemImages.s.sol --rpc-url $RPC
```

These dry-runs simulate the deployment without broadcasting transactions. They help catch configuration issues before spending gas.

**Note:** The catalog seeding script will fail in dry-run if the catalog address doesn't exist yet (expected). The image upload script will show 0 uploads if images aren't available (also expected in dry-run).

## 2. Environment Variables (V1 Only)

Set up your environment for V1 deployment. **Important:** Unset or ignore any old V0 exports (`STAB`, `ITEM`, `CATALOG` without `_V1` suffix).

```bash
export RPC=https://apechain.calderachain.xyz/http
export DEPLOYER_PK=<your_private_key>
export ITEM_IMAGE_DIR=assets/items
```

**Security Note:** Never commit your private key to version control. Use environment variables or a secure key management system.

## 3. Deploy V1 System

Deploy the core V1 contracts (ProxyAdmin, implementations, and proxies):

```bash
forge script scripts/DeployStabilizationSystemV1.s.sol \
  --rpc-url $RPC \
  --private-key $DEPLOYER_PK \
  --broadcast
```

The script will output export commands like:
```bash
export STAB_V1=0xBb2047350B7bA71fC00c8F9f3F100F5D94Ea8F99
export ITEM_V1=0x9C4216d7B56A25b4B8a8eDdEfeBaBa389E05A01E
export CATALOG_V1=0x06266255ee081AcA64328dE8fcc939923eE6e8c8
export PROXY_ADMIN_V1=0xdb8047eD77099626e189316Ced0b25b46Ae0181d
export ITEM_IMAGE_DEPLOYER_V1=0x9b3eB04C5170985Be268998f729019d12C099913
```

**Copy and paste these exports into your shell immediately after deployment.** You'll need them for the next steps.

**What this deploys:**
- `ProxyAdminV1` - Single central proxy admin owned by deployer (enables upgrades)
- `ItemImageDeployerV1` - SSTORE2 image deployer
- `ItemCatalog` implementation and proxy
- `ItemToken1155` implementation and proxy (with collection metadata defaults)
- `CreatureStabilizer` implementation and proxy
- All contracts are wired together and initialized

## 4. Seed the V1 Catalog

Populate the V1 ItemCatalog with all 64 item templates from `catalog.json`:

```bash
export ITEM_CATALOG_PROXY_V1=$CATALOG_V1
export ITEM_TOKEN_PROXY_V1=$ITEM_V1
export ITEM_ADMIN_RECIPIENT_V1=<wallet_to_receive_one_of_each_item>  # Optional

forge script scripts/DeployItemCatalogV1.s.sol \
  --rpc-url $RPC \
  --private-key $DEPLOYER_PK \
  --broadcast
```

**What this does:**
- Reads `docs/stabilization_script/sim/items/output/catalog.json`
- Adds all 64 templates to the V1 ItemCatalog in batches of 10
- Optionally mints 1 of each item to `ITEM_ADMIN_RECIPIENT_V1` (if set)

**Note:** This step can take a while due to gas costs for 64 templates. Monitor the transaction confirmations.

## 5. Upload Item Images to SSTORE2

Deploy all item PNGs to on-chain storage and link them to catalog templates:

**Prerequisites:**
- All images must be named `item_<id>.png` (e.g., `item_0.png`, `item_1.png`, ... `item_63.png`)
- Images must be placed in `assets/items/` (or set `ITEM_IMAGE_DIR` to your custom path)

```bash
export ITEM_CATALOG_PROXY_V1=$CATALOG_V1
export ITEM_IMAGE_DEPLOYER_V1=$ITEM_IMAGE_DEPLOYER_V1
export ITEM_IMAGE_DIR=assets/items  # Default, can be overridden

forge script scripts/UploadItemImages.s.sol \
  --rpc-url $RPC \
  --private-key $DEPLOYER_PK \
  --broadcast
```

**What this does:**
- Reads each PNG from `assets/items/item_<id>.png`
- Deploys image bytes to SSTORE2 via `ItemImageDeployer.deployImage()`
- Calls `ItemCatalog.updateTemplateImage(id, imagePtr)` for each template

**Note:** This step is gas-intensive (estimated ~2.28 ETH for all 64 images). Each image is stored on-chain permanently.

## 6. Validate Collection-Level Metadata On-Chain

Verify that the collection metadata is set correctly:

```bash
cast call $ITEM_V1 "name()(string)" --rpc-url $RPC
cast call $ITEM_V1 "symbol()(string)" --rpc-url $RPC
cast call $ITEM_V1 "contractURI()(string)" --rpc-url $RPC
```

**Expected defaults:**
- `name()`: `"Stabilization Items V1"`
- `symbol()`: `"ITEMS"`
- `contractURI()`: Base64-encoded JSON containing:
  - `"name": "Stabilization Items V1"`
  - `"description": "On-chain tools, artifacts, and anomalies used in stabilizing creatures within the NMGI ecosystem."`
  - `"external_url": "https://xprmint.com"`

**Updating collection metadata:**
If you need to adjust the collection name, symbol, or contract URI after deployment, the owner can call:
```bash
cast send $ITEM_V1 "setName(string)" "New Name" --rpc-url $RPC --private-key $DEPLOYER_PK
cast send $ITEM_V1 "setSymbol(string)" "NEW-SYMBOL" --rpc-url $RPC --private-key $DEPLOYER_PK
cast send $ITEM_V1 "setContractURI(string)" "<new_uri>" --rpc-url $RPC --private-key $DEPLOYER_PK
```

## 7. Validate Item-Level Metadata for Specific IDs

Check that individual item metadata is correctly formatted:

```bash
cast call $ITEM_V1 "uri(uint256)(string)" 0 --rpc-url $RPC
cast call $ITEM_V1 "uri(uint256)(string)" 56 --rpc-url $RPC
```

The returned string is a base64-encoded data URI. Decode it to see the JSON structure:

**Expected JSON fields:**
- `"name"` - Item name from ItemCatalog template
- `"description"` - Item description from ItemCatalog template
- `"image"` - Data URI for the item image (if `imagePtr` is set)
- `"attributes"` - Array of trait attributes:
  - `"Item Name"` - Same as name (for filtering)
  - `"Rarity"` - Common, Uncommon, Rare, or Epic
  - `"Primary Trait"` - Salinity, pH, Temperature, Frequency, or None
  - `"Primary Delta Magnitude"` - Numeric value
  - `"Secondary Trait"` - (if not Epic)
  - `"Secondary Delta Magnitude"` - (if not Epic)
  - `"SP Yield"` - 1-5 based on rarity
- `"collection"` - "Stabilization Items"

**Updating item metadata:**
Item names and descriptions come from ItemCatalog templates and can be updated without affecting gameplay:

```bash
# Update both name and description
cast send $CATALOG_V1 \
  "updateTemplateMetadata(uint256,string,string)" \
  0 "Fixed Item Name" "Corrected description" \
  --rpc-url $RPC --private-key $DEPLOYER_PK

# Or use the example script
forge script scripts/UpdateItemMetadataExample.s.sol \
  --rpc-url $RPC --private-key $DEPLOYER_PK --broadcast
```

**Important:** These metadata updates only affect display. They do NOT change:
- Rarity
- Primary/secondary traits
- Delta values
- Any gameplay mechanics

## 8. Run the V1 Smoke Test

Verify the system works end-to-end with a smoke test:

```bash
export CREATURE_STABILIZER_PROXY_V1=$STAB_V1
export ITEM_TOKEN_PROXY_V1=$ITEM_V1
export ITEM_CATALOG_PROXY_V1=$CATALOG_V1

forge script scripts/SmokeTest.s.sol --rpc-url $RPC
```

The script prints ready-to-use `cast` commands for:
- `initializeCreature` - Initialize a test creature
- `getCreatureState` - Read creature state
- `claimDailyItems` - Claim daily items
- `applyItem` - Apply an item to a creature
- `burnItemForSP` - Burn an item for SP
- `lockTrait` - Lock a trait (once within band)
- `sendVibes` - Send vibes to a creature

**Expected behavior:**
The smoke test should feel identical to the V0 smoke test, just using V1 addresses. All gameplay mechanics are the same; only the deployment topology differs.

**Quick smoke test sequence:**
1. Disable Goobs ownership (if enabled):
   ```bash
   cast send $STAB_V1 "setGoobs(address)" 0x0000000000000000000000000000000000000000 --rpc-url $RPC --private-key $DEPLOYER_PK
   cast send $STAB_V1 "setEnforceGoobsOwnership(bool)" false --rpc-url $RPC --private-key $DEPLOYER_PK
   ```

2. Initialize a test creature:
   ```bash
   cast send $STAB_V1 \
     "initializeCreature(uint256,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16)" \
     999999 50 50 50 50 70 70 70 70 \
     --rpc-url $RPC --private-key $DEPLOYER_PK
   ```

3. Claim daily items:
   ```bash
   cast send $STAB_V1 "claimDailyItems(uint256)" 999999 --rpc-url $RPC --private-key $DEPLOYER_PK
   ```

4. Check item balances:
   ```bash
   cast call $ITEM_V1 "balanceOf(address,uint256)" $YOUR_WALLET 0 --rpc-url $RPC
   ```

5. Apply an item:
   ```bash
   cast send $STAB_V1 "applyItem(uint256,uint256)" 999999 0 --rpc-url $RPC --private-key $DEPLOYER_PK
   ```

6. Read creature state to verify trait changes:
   ```bash
   cast call $STAB_V1 "getCreatureState(uint256)" 999999 --rpc-url $RPC
   ```

## 9. Marketplace / Magic Eden Verification

The collection contract for marketplaces is `$ITEM_V1` (the ItemToken1155 proxy address).

**Expected marketplace behavior:**
- **Collection title:** "Stabilization Items V1"
- **Symbol:** "ITEMS"
- **Collection description:** "On-chain tools, artifacts, and anomalies used in stabilizing creatures within the NMGI ecosystem."
- **Each item shows:**
  - Image (from on-chain SSTORE2 data)
  - Name (from ItemCatalog template)
  - Description (from ItemCatalog template)
  - Attributes (rarity, traits, deltas, SP yield)

**Adding the collection to a marketplace:**
1. Use `$ITEM_V1` as the contract address
2. The marketplace should automatically read `name()`, `symbol()`, and `contractURI()`
3. Individual items are discovered via `uri(uint256)` for each token ID

**Fixing metadata issues:**
If names or descriptions need tweaks after deployment:

1. **Item-level fixes:**
   ```bash
   # Use the example script
   forge script scripts/UpdateItemMetadataExample.s.sol \
     --rpc-url $RPC --private-key $DEPLOYER_PK --broadcast
   
   # Or use cast directly
   cast send $CATALOG_V1 \
     "updateTemplateMetadata(uint256,string,string)" \
     <template_id> "New Name" "New Description" \
     --rpc-url $RPC --private-key $DEPLOYER_PK
   ```

2. **Collection-level fixes:**
   ```bash
   cast send $ITEM_V1 "setName(string)" "New Collection Name" --rpc-url $RPC --private-key $DEPLOYER_PK
   cast send $ITEM_V1 "setSymbol(string)" "NEW-SYMBOL" --rpc-url $RPC --private-key $DEPLOYER_PK
   cast send $ITEM_V1 "setContractURI(string)" "<new_uri>" --rpc-url $RPC --private-key $DEPLOYER_PK
   ```

**Note:** Metadata updates are cosmetic only. They do not affect gameplay mechanics, item effects, or any stabilization rules.

## Summary

After completing all steps, you should have:

✅ V1 system deployed with single ProxyAdmin (upgradeable)  
✅ 64 item templates seeded in ItemCatalog  
✅ All item images uploaded to SSTORE2  
✅ Collection metadata verified (name, symbol, contractURI)  
✅ Item metadata verified (names, descriptions, images, attributes)  
✅ Smoke test passed (gameplay mechanics working)  
✅ Collection ready for marketplace integration  

**Next steps:**
- Verify contracts on ApeScan (see `scripts/VERIFICATION_GUIDE.md`)
- Integrate with marketplace (use `$ITEM_V1` as contract address)
- Monitor on-chain activity via ApeScan

**Troubleshooting:**
- If catalog seeding fails, check that `ITEM_CATALOG_PROXY_V1` is set correctly
- If image upload fails, verify images exist at `assets/items/item_<id>.png`
- If metadata doesn't show, wait for marketplace cache refresh or check `uri()` directly with `cast`


