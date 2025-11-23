# Smoke Testing on ApeChain Mainnet

This guide explains how to perform on-chain smoke tests of the deployed Stabilization System on ApeChain mainnet.

## Deployments

The Stabilization System has two deployments on ApeChain mainnet:

### v0 (Legacy Test Deployment)
- **Status:** Fully functional for gameplay
- **Issue:** Broken ProxyAdmin topology - individual ProxyAdmins are owned by a main ProxyAdmin (contract), preventing upgrades and imagePtr updates
- **Use case:** Testing and validation of game mechanics
- **Addresses:** Use `STAB_CREATURE_STABILIZER`, `STAB_ITEM_TOKEN`, `STAB_ITEM_CATALOG` env vars

### v1 (Production Deployment)
- **Status:** Clean deployment with proper upgradeability
- **Features:** Single central ProxyAdminV1 owned by deployer EOA, upgradable, with proper imagePtr wiring and images on-chain
- **Use case:** Production deployment with full upgradeability and image support
- **Addresses:** Use `CREATURE_STABILIZER_PROXY_V1`, `ITEM_TOKEN_PROXY_V1`, `ITEM_CATALOG_PROXY_V1` env vars

**Note:** Game mechanics, rules, and catalog content are identical between v0 and v1. Only the admin/upgradeability topology and image support differ.

## Prerequisites

The contracts are already deployed on ApeChain mainnet. Before running smoke tests, you need to set the following environment variables:

**For v0 (legacy):**

- `CREATURE_STABILIZER_PROXY` or `STAB_CREATURE_STABILIZER` - Address of the CreatureStabilizer proxy contract
- `ITEM_TOKEN_PROXY` or `STAB_ITEM_TOKEN` - Address of the ItemToken1155 proxy contract
- `ITEM_CATALOG_PROXY` or `STAB_ITEM_CATALOG` - Address of the ItemCatalog proxy contract
- `APECHAIN_MAINNET_RPC_URL` - Your ApeChain mainnet RPC endpoint
- `DEPLOYER_PRIVATE_KEY` - Your private key for testing (⚠️ **DO NOT commit this to version control**)

**For v1 (production):**
- `STAB_V1` or `CREATURE_STABILIZER_PROXY_V1` - Address of the v1 CreatureStabilizer proxy contract
- `ITEM_V1` or `ITEM_TOKEN_PROXY_V1` - Address of the v1 ItemToken1155 proxy contract
- `CATALOG_V1` or `ITEM_CATALOG_PROXY_V1` - Address of the v1 ItemCatalog proxy contract
- `PROXY_ADMIN_V1` - Address of the v1 ProxyAdmin (owned by deployer EOA)
- `ITEM_IMAGE_DEPLOYER_V1` - Address of the v1 ItemImageDeployer
- `APECHAIN_MAINNET_RPC_URL` - Your ApeChain mainnet RPC endpoint
- `DEPLOYER_PRIVATE_KEY` - Your private key for testing (⚠️ **DO NOT commit this to version control**)

**Note:** The smoke test script will read v1 addresses if set, otherwise falls back to v0 addresses.

## V1 Deployment Flow

To deploy the v1 system from scratch:

1. **Deploy the v1 system:**
   ```bash
   forge script scripts/DeployStabilizationSystemV1.s.sol \
     --rpc-url $APECHAIN_MAINNET_RPC_URL \
     --broadcast
   ```
   
   This will output export commands like:
   ```bash
   export STAB_V1=0x...
   export ITEM_V1=0x...
   export CATALOG_V1=0x...
   export PROXY_ADMIN_V1=0x...
   export ITEM_IMAGE_DEPLOYER_V1=0x...
   ```

2. **Seed the v1 catalog:**
   ```bash
   export ITEM_CATALOG_PROXY_V1=$CATALOG_V1
   export ITEM_TOKEN_PROXY_V1=$ITEM_V1
   export ITEM_ADMIN_RECIPIENT_V1=<your-wallet-address>
   
   forge script scripts/DeployItemCatalogV1.s.sol \
     --rpc-url $APECHAIN_MAINNET_RPC_URL \
     --broadcast
   ```

3. **Upload item images:**
   ```bash
   export ITEM_CATALOG_PROXY_V1=$CATALOG_V1
   export ITEM_IMAGE_DEPLOYER_V1=<from-step-1>
   export ITEM_IMAGE_DIR=assets/items  # default, can be overridden
   
   forge script scripts/UploadItemImages.s.sol \
     --rpc-url $APECHAIN_MAINNET_RPC_URL \
     --broadcast
   ```

4. **Run smoke tests:**
   ```bash
   export CREATURE_STABILIZER_PROXY_V1=$STAB_V1
   export ITEM_TOKEN_PROXY_V1=$ITEM_V1
   export ITEM_CATALOG_PROXY_V1=$CATALOG_V1
   
   forge script scripts/SmokeTest.s.sol --rpc-url $APECHAIN_MAINNET_RPC_URL
   ```

## Collection and Item Metadata

The v1 deployment includes proper collection-level and item-level metadata for marketplace display.

### Collection-Level Metadata

The `ItemToken1155` contract exposes collection information:

- **`name()`** - Returns the collection name (V1 default: "Stabilization Items V1")
- **`symbol()`** - Returns the collection symbol (V1 default: "ITEMS")
- **`contractURI()`** - Returns collection-level metadata JSON with name, description, and external URL

**V1 Production Defaults:**
- Collection name: "Stabilization Items V1"
- Collection symbol: "ITEMS"
- Collection description: "On-chain tools, artifacts, and anomalies used in stabilizing creatures within the NMGI ecosystem."

These values can be updated by the contract owner using:
- `setName(string calldata newName)`
- `setSymbol(string calldata newSymbol)`
- `setContractURI(string calldata newContractURI)`

**Note:** The above defaults are the intended production values for V1, but they can be changed post-deployment if needed.

**Example verification:**
```bash
cast call $ITEM_V1 "name()(string)" --rpc-url $RPC
cast call $ITEM_V1 "symbol()(string)" --rpc-url $RPC
cast call $ITEM_V1 "contractURI()(string)" --rpc-url $RPC
```

### Item-Level Metadata

Each item's metadata comes from the `ItemCatalog` template and is exposed via `ItemToken1155.uri(uint256 id)`. The URI returns a base64-encoded JSON object that **always includes**:

- `"name"` - Item name from template
- `"description"` - Item description from template
- `"image"` - Data URI for the item image (if `imagePtr` is set)
- `"attributes"` - Array of trait attributes (rarity, traits, deltas, SP yield)
- `"collection"` - Collection identifier

**Example verification:**
```bash
cast call $ITEM_V1 "uri(uint256)(string)" 0 --rpc-url $RPC
# Decode the base64 part to see the JSON
```

### Updating Item Metadata

Item names and descriptions can be updated by the catalog owner without affecting gameplay mechanics. The following functions are available:

- `updateTemplateMetadata(uint256 id, string calldata newName, string calldata newDescription)` - Update both name and description
- `updateTemplateName(uint256 id, string calldata newName)` - Update name only
- `updateTemplateDescription(uint256 id, string calldata newDescription)` - Update description only

**Important:** These functions **only** modify the `name` and `description` fields. They do **not** affect:
- Rarity
- Primary/secondary traits
- Delta values
- Any gameplay mechanics

**Example usage:**
```bash
# Using the example script
export ITEM_CATALOG_PROXY_V1=$CATALOG_V1
forge script scripts/UpdateItemMetadataExample.s.sol \
  --rpc-url $APECHAIN_MAINNET_RPC_URL \
  --broadcast

# Or using cast directly
cast send $CATALOG_V1 \
  "updateTemplateMetadata(uint256,string,string)" \
  0 "Fixed Item Name" "Corrected description" \
  --rpc-url $RPC --private-key $PK
```

**Note:** Metadata updates are purely cosmetic and only affect how items are displayed in marketplaces. All stabilization mechanics, item effects, and game rules remain unchanged.

## Running the Smoke Test Script

The `SmokeTest.s.sol` script generates ready-to-use `cast` commands for testing. It does **not** execute any transactions—it only prints commands that you can copy and run.

```bash
forge script scripts/SmokeTest.s.sol --rpc-url $APECHAIN_MAINNET_RPC_URL
```

## Script Output

The script prints:

1. **Configuration Header** - Resolved contract addresses and RPC URL:
   ```
   === SMOKE TEST CONFIG ===
   $STAB=0x...
   $ITEM=0x...
   $CATALOG=0x...
   $RPC=https://...
   $PK=<YOUR_PRIVATE_KEY_HERE>
   ```

2. **Export Commands** - Shell commands to set up your environment:
   ```bash
   export STAB=0x...
   export ITEM=0x...
   export CATALOG=0x...
   export RPC=$APECHAIN_MAINNET_RPC_URL
   export PK=$DEPLOYER_PRIVATE_KEY
   ```

3. **Command Groups** - Organized by operation type:
   - **State-Changing Operations** - `initializeCreature`, `claimDailyItems`, `applyItem`, `burnItemForSP`, `lockTrait`, `sendVibes`
   - **Read Operations** - `getCreatureState`, `walletSP`, `lastClaimDay`, `lastVibesDay`, `balanceOf`, `templateCount`, etc.
   - **Admin Operations** - `setGoobs`, `setEnforceGoobsOwnership`, `setDaySeconds`
   - **ERC-1155 Operations** - `balanceOf`, `balanceOfBatch`, `uri`, `adminMint`
   - **Catalog Operations** - `getTemplate`, `getTemplateIdsByRarity`, `updateTemplateImage`

4. **Quick Smoke Test Sequence** - A recommended flow to verify the system end-to-end

## Placeholders

All commands use placeholders that you must replace:

- `$STAB` - CreatureStabilizer proxy address
- `$ITEM` - ItemToken1155 proxy address
- `$CATALOG` - ItemCatalog proxy address
- `$RPC` - RPC URL
- `$PK` - Private key
- `<CREATURE_ID>` - Creature ID (e.g., `999999` for testing)
- `<ITEM_ID>` - Item ID (e.g., `0` for the first item)
- `<TRAIT_INDEX>` - Trait index (`0`=Salinity, `1`=pH, `2`=Temperature, `3`=Frequency)
- `$YOUR_ADDRESS` or `$YOUR_WALLET` - Your wallet address

## Recommended Smoke Test Flow

Follow this sequence to verify the system is working. This flow works for both v0 and v1 deployments - just set the appropriate environment variables:

1. **Disable Goobs ownership enforcement** (for testing):
   ```bash
   cast send $STAB "setGoobs(address)" 0x0000000000000000000000000000000000000000 --rpc-url $RPC --private-key $PK
   cast send $STAB "setEnforceGoobsOwnership(bool)" false --rpc-url $RPC --private-key $PK
   ```

2. **Optionally shorten DAY_SECONDS** (for faster testing):
   ```bash
   cast send $STAB "setDaySeconds(uint256)" 300 --rpc-url $RPC --private-key $PK
   ```

3. **Initialize a test creature**:
   ```bash
   cast send $STAB "initializeCreature(uint256,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16)" 999999 50 50 50 50 70 70 70 70 --rpc-url $RPC --private-key $PK
   ```
   Parameters: `creatureId`, `targetSal`, `targetPH`, `targetTemp`, `targetFreq`, `currSal`, `currPH`, `currTemp`, `currFreq`

4. **Read creature state**:
   ```bash
   cast call $STAB "getCreatureState(uint256)" 999999 --rpc-url $RPC
   ```

5. **Claim daily items**:
   ```bash
   cast send $STAB "claimDailyItems(uint256)" 999999 --rpc-url $RPC --private-key $PK
   ```

6. **Check item balances**:
   ```bash
   cast call $ITEM "balanceOf(address,uint256)" $YOUR_WALLET <ITEM_ID> --rpc-url $RPC
   ```

7. **Apply an item**:
   ```bash
   cast send $STAB "applyItem(uint256,uint256)" 999999 <ITEM_ID> --rpc-url $RPC --private-key $PK
   ```

8. **Read state again** to verify trait changes:
   ```bash
   cast call $STAB "getCreatureState(uint256)" 999999 --rpc-url $RPC
   ```

9. **Burn an item for SP** (optional):
   ```bash
   cast send $STAB "burnItemForSP(uint256,uint256)" 999999 <ITEM_ID> --rpc-url $RPC --private-key $PK
   ```

10. **Lock a trait** when within the 5% band (optional):
    ```bash
    cast send $STAB "lockTrait(uint256,uint8)" 999999 <TRAIT_INDEX> --rpc-url $RPC --private-key $PK
    ```

## Notes

- The script does **not** execute any transactions—it only generates commands.
- Replace all placeholders (`$STAB`, `<CREATURE_ID>`, etc.) with actual values before running commands.
- Use a test creature ID (e.g., `999999`) that doesn't conflict with real creatures.
- For faster testing, consider setting `DAY_SECONDS` to a shorter value (e.g., 300 seconds = 5 minutes).
- Admin functions (`setGoobs`, `setEnforceGoobsOwnership`, `setDaySeconds`) require contract ownership.
- The `adminMint` function in ItemToken1155 is owner-only and should be used sparingly.

## Troubleshooting

- **"execution reverted"** - Check that you're using the correct contract addresses and that your wallet has the necessary permissions.
- **"OwnableUnauthorizedAccount"** - You're not the owner of the contract. Admin functions require ownership.
- **"CreatureStabilizer: not Goob owner"** - Goobs ownership enforcement is enabled. Disable it for testing or use a creature you own.
- **"Catalog is empty"** - The catalog hasn't been populated yet. Run `DeployItemCatalog.s.sol` first.

## Related Documentation

- [Deployment Checklist](../stabilization/deployment-checklist.md)
- [Stabilization Spec](../stabilization/stabilization-spec.md)
- [Developer Guide](../stabilization/DEVELOPER_GUIDE.md)

