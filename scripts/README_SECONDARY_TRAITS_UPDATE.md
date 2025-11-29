# Secondary Traits Update Scripts

This directory contains scripts to update the on-chain ItemCatalog with new item-specific secondary trait mappings.

## Overview

The secondary trait system has been updated from a trait-based interdependence mapping to item-specific mappings. This ensures all four traits (Salinity, pH, Temperature, Frequency) can be affected as secondary traits.

## Files

- `UpdateSecondaryTraits.s.sol` - Updates all 54 non-epic items (0-53) with new secondary traits
- `VerifySecondaryTraits.s.sol` - Verifies that all templates have the correct secondary traits

## Prerequisites

1. **Contract Upgrade**: The `ItemCatalog` contract must be upgraded to include the `updateTemplateSecondaryTrait()` function
2. **Environment Variables**: Set the following in your `.env` file:
   - `DEPLOYER_PRIVATE_KEY` or `PRIVATE_KEY` - Private key of the ItemCatalog owner
   - `ITEM_CATALOG_PROXY` or `STAB_ITEM_CATALOG` - Address of the ItemCatalog proxy contract

## New Secondary Trait Mappings

### Salinity Items (0-12)
- Items 0-3: Salinity → **pH**
- Items 4-7: Salinity → **Temperature**
- Items 8-12: Salinity → **Frequency**

### pH Items (13-25)
- Items 13-16: pH → **Salinity**
- Items 17-20: pH → **Temperature**
- Items 21-25: pH → **Frequency**

### Temperature Items (26-39)
- Items 26-30: Temperature → **Salinity**
- Items 31-34: Temperature → **pH**
- Items 35-39: Temperature → **Frequency**

### Frequency Items (40-53)
- Items 40-44: Frequency → **Salinity**
- Items 45-48: Frequency → **pH**
- Items 49-53: Frequency → **Temperature**

### Epic Items (54-63)
- No secondary trait (unchanged)

## Usage

### Step 1: Upgrade ItemCatalog Contract

First, upgrade the ItemCatalog contract to include the new `updateTemplateSecondaryTrait()` function:

```bash
forge script scripts/UpgradeContracts.s.sol:UpgradeContracts \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify
```

### Step 2: Verify Current State (Optional)

Before updating, you can verify the current state of templates:

```bash
forge script scripts/VerifySecondaryTraits.s.sol:VerifySecondaryTraits \
  --rpc-url $RPC_URL
```

This will show which templates need updating.

### Step 3: Update Secondary Traits

Update all 54 non-epic items with the new secondary trait mappings:

```bash
forge script scripts/UpdateSecondaryTraits.s.sol:UpdateSecondaryTraits \
  --rpc-url $RPC_URL \
  --broadcast
```

**Note**: This will execute 54 transactions (one per template). The script will:
- Skip templates that already have the correct secondary trait
- Preserve existing `secondaryDelta` values
- Verify each update before proceeding

### Step 4: Verify Updates

After updating, verify that all templates have been updated correctly:

```bash
forge script scripts/VerifySecondaryTraits.s.sol:VerifySecondaryTraits \
  --rpc-url $RPC_URL
```

This will output a detailed report showing:
- Each template's current secondary trait
- Whether it matches the expected value
- A summary of correct/incorrect templates

## Testing on Fork

Before deploying to mainnet, test on a local fork:

```bash
# Start a local fork
anvil --fork-url $MAINNET_RPC

# In another terminal, run the update script
forge script scripts/UpdateSecondaryTraits.s.sol:UpdateSecondaryTraits \
  --rpc-url http://localhost:8545 \
  --broadcast
```

## Safety Features

1. **Ownership Check**: Script verifies deployer is the owner of ItemCatalog
2. **Template Validation**: Verifies template exists before updating
3. **Delta Preservation**: Preserves existing `secondaryDelta` values
4. **Epic Item Protection**: Skips epic items (54-63) which have no secondary trait
5. **Post-Update Verification**: Verifies each update succeeded before continuing
6. **Skip Already-Correct**: Skips templates that already have the correct secondary trait

## Gas Estimation

- Each `updateTemplateSecondaryTrait()` call: ~50,000-70,000 gas
- Total for 54 updates: ~2.7M - 3.8M gas
- With current gas prices, estimate total cost before executing

## Troubleshooting

### Error: "Deployer is not the owner"
- Ensure the `DEPLOYER_PRIVATE_KEY` corresponds to the ItemCatalog owner
- Check ownership: `cast call $CATALOG_PROXY "owner()" --rpc-url $RPC`

### Error: "Expected at least 64 templates"
- Verify the catalog has been populated with all 64 templates
- Check template count: `cast call $CATALOG_PROXY "templateCount()" --rpc-url $RPC`

### Error: "Template X is epic, should be skipped"
- This should not happen for items 0-53
- Verify the template ID is correct

### Update Fails for Specific Template
- The script will stop and report which template failed
- You can manually update that template using:
  ```solidity
  catalog.updateTemplateSecondaryTrait(templateId, newTrait, currentDelta);
  ```

## Post-Deployment

After successful updates:

1. **Clear Frontend Cache**: Clear localStorage and React Query cache
2. **Test Metadata**: Query `ItemToken1155.uri(itemId)` for several items
3. **Verify Frontend**: Check that items display correct secondary traits
4. **Monitor Marketplaces**: Magic Eden and other marketplaces will refresh metadata automatically (may take hours/days)

## Rollback

If needed, individual templates can be reverted by calling `updateTemplateSecondaryTrait()` with the old secondary trait value. However, you'll need to know what the old mapping was.

## Support

For issues or questions, refer to:
- Contract code: `contracts/stabilization/items/ItemCatalog.sol`
- Simulation mapping: `docs/stabilization_script/sim/items/catalog.py` (ITEM_SECONDARY_TRAIT_MAP)

