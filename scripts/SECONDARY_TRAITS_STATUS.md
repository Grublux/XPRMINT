# Secondary Traits Update - Current Status

## ✅ Completed

1. **Simulation Updates** ✓
   - Updated Python catalog with item-specific secondary trait mappings
   - All 54 non-epic items (0-53) have correct mappings
   - Epic items (54-63) correctly have no secondary trait
   - Catalog JSON regenerated with new mappings

2. **Contract Code** ✓
   - Added `updateTemplateSecondaryTrait()` function to `ItemCatalog.sol`
   - Function compiles without errors
   - Includes proper access control (onlyOwner)

3. **Scripts Created** ✓
   - `UpdateSecondaryTraits.s.sol` - Updates all 54 templates
   - `VerifySecondaryTraits.s.sol` - Verifies all templates
   - Both scripts compile successfully
   - Documentation created

4. **Verification Test** ✓
   - Successfully ran verification script on mainnet
   - Confirmed current state: 45 templates need updating

## 📊 Current On-Chain State

**Contract**: `0x06266255ee081AcA64328dE8fcc939923eE6e8c8` (ItemCatalog V1)

**Status**:
- Total templates: 64
- Correct: 19 (items that happen to match new mapping)
- **Incorrect: 45** (need updating)
- Epic items: 10 (correctly have no secondary trait)

**Current Mapping** (Old):
- Salinity → Temperature
- Temperature → Frequency  
- pH → Frequency
- Frequency → Temperature

**Target Mapping** (New - Item-Specific):
- Items 0-3: Salinity → pH
- Items 4-7: Salinity → Temperature ✓ (already correct)
- Items 8-12: Salinity → Frequency
- Items 13-16: pH → Salinity
- Items 17-20: pH → Temperature
- Items 21-25: pH → Frequency
- Items 26-30: Temperature → Salinity
- Items 31-34: Temperature → pH
- Items 35-39: Temperature → Frequency
- Items 40-44: Frequency → Salinity
- Items 45-48: Frequency → pH
- Items 49-53: Frequency → Temperature

## 🚧 Next Steps

### Step 1: Upgrade ItemCatalog Contract

The contract needs to be upgraded to include the `updateTemplateSecondaryTrait()` function.

**Script**: `scripts/UpgradeItemCatalogForSecondaryTraits.s.sol` ✓ (Created)

**Usage**:
```bash
ITEM_CATALOG_PROXY=0x06266255ee081AcA64328dE8fcc939923eE6e8c8 \
DEPLOYER_PRIVATE_KEY=<your_key> \
forge script scripts/UpgradeItemCatalogForSecondaryTraits.s.sol:UpgradeItemCatalogForSecondaryTraits \
  --rpc-url https://apechain.calderachain.xyz/http \
  --broadcast \
  --verify
```

**What it does**:
- Reads ProxyAdmin from ERC1967 admin slot
- Verifies deployer owns the ProxyAdmin
- Deploys new ItemCatalog implementation (or uses pre-deployed if `NEW_ITEM_CATALOG_IMPL` env var is set)
- Upgrades the proxy to new implementation
- Verifies the upgrade succeeded

**Environment Variables**:
- `ITEM_CATALOG_PROXY` or `STAB_ITEM_CATALOG` or `ITEM_CATALOG_PROXY_V1` - Catalog proxy address
- `DEPLOYER_PRIVATE_KEY` or `PRIVATE_KEY` - Private key of ProxyAdmin owner
- `NEW_ITEM_CATALOG_IMPL` (optional) - Use pre-deployed implementation instead of deploying new one

### Step 2: Update Templates

Once the contract is upgraded, run the update script:

```bash
ITEM_CATALOG_PROXY=0x06266255ee081AcA64328dE8fcc939923eE6e8c8 \
forge script scripts/UpdateSecondaryTraits.s.sol:UpdateSecondaryTraits \
  --rpc-url https://apechain.calderachain.xyz/http \
  --broadcast
```

This will:
- Update 45 templates that need changes
- Skip 19 templates that are already correct
- Preserve existing `secondaryDelta` values
- Verify each update

**Estimated**: 45 transactions, ~2.7M - 3.8M gas total

### Step 3: Verify Updates

After updating, verify all templates:

```bash
ITEM_CATALOG_PROXY=0x06266255ee081AcA64328dE8fcc939923eE6e8c8 \
forge script scripts/VerifySecondaryTraits.s.sol:VerifySecondaryTraits \
  --rpc-url https://apechain.calderachain.xyz/http
```

Should show: 64 correct, 0 incorrect

### Step 4: Test Frontend

1. Clear frontend cache (localStorage, React Query)
2. Test item display in simulation mode
3. Test item display in real mode
4. Verify metadata shows correct secondary traits

## ⚠️ Important Notes

1. **Contract Upgrade Required**: The `updateTemplateSecondaryTrait()` function does not exist in the current deployed contract. The contract MUST be upgraded before running the update script.

2. **Gas Costs**: Updating 45 templates will require ~45 transactions. Estimate gas costs before executing.

3. **No Rollback Needed**: Since metadata is generated on-the-fly, updating templates will immediately affect all items (existing and newly minted). No need to regenerate items.

4. **Marketplace Indexing**: Magic Eden and other marketplaces will automatically pick up the new metadata when they refresh (may take hours/days).

## 📝 Files Reference

- **Update Script**: `scripts/UpdateSecondaryTraits.s.sol`
- **Verify Script**: `scripts/VerifySecondaryTraits.s.sol`
- **Documentation**: `scripts/README_SECONDARY_TRAITS_UPDATE.md`
- **Contract**: `contracts/stabilization/items/ItemCatalog.sol`
- **Simulation Mapping**: `docs/stabilization_script/sim/items/catalog.py` (ITEM_SECONDARY_TRAIT_MAP)

## 🔍 Verification Results

Last verification run showed:
- Template 0: Expected pH, Actual Temperature ❌
- Template 4: Expected Temperature, Actual Temperature ✅
- Template 8: Expected Frequency, Actual Temperature ❌
- Template 13: Expected Salinity, Actual Frequency ❌

All 45 incorrect templates will be updated by the script.

