# Quick Start - Execute Secondary Traits Update

## Prerequisites

1. **Set Environment Variables**:
   ```bash
   export DEPLOYER_PRIVATE_KEY=<your_private_key>
   export ITEM_CATALOG_PROXY=0x06266255ee081AcA64328dE8fcc939923eE6e8c8
   export RPC_URL=https://apechain.calderachain.xyz/http
   ```

2. **Verify Ownership**: 
   The private key must correspond to the owner of the ProxyAdmin.
   Current ProxyAdmin owner: `0xdb8047eD77099626e189316Ced0b25b46Ae0181d`

## Option 1: Automated Script (Recommended)

Run the complete process with one command:

```bash
./scripts/EXECUTE_SECONDARY_TRAITS_UPDATE.sh
```

This will:
1. Upgrade the ItemCatalog contract
2. Update all 45 templates that need changes
3. Verify all updates succeeded

## Option 2: Manual Step-by-Step

### Step 1: Upgrade Contract

```bash
ITEM_CATALOG_PROXY=0x06266255ee081AcA64328dE8fcc939923eE6e8c8 \
forge script scripts/UpgradeItemCatalogForSecondaryTraits.s.sol:UpgradeItemCatalogForSecondaryTraits \
  --rpc-url https://apechain.calderachain.xyz/http \
  --broadcast \
  --verify
```

### Step 2: Update Templates

```bash
ITEM_CATALOG_PROXY=0x06266255ee081AcA64328dE8fcc939923eE6e8c8 \
forge script scripts/UpdateSecondaryTraits.s.sol:UpdateSecondaryTraits \
  --rpc-url https://apechain.calderachain.xyz/http \
  --broadcast
```

### Step 3: Verify Updates

```bash
ITEM_CATALOG_PROXY=0x06266255ee081AcA64328dE8fcc939923eE6e8c8 \
forge script scripts/VerifySecondaryTraits.s.sol:VerifySecondaryTraits \
  --rpc-url https://apechain.calderachain.xyz/http
```

## Expected Results

- **Step 1**: Contract upgraded, new implementation deployed
- **Step 2**: 45 templates updated (19 already correct, skipped)
- **Step 3**: All 64 templates verified (64 correct, 0 incorrect)

## Gas Estimates

- **Upgrade**: ~500,000 gas
- **Each Update**: ~50,000-70,000 gas
- **Total Updates**: ~2.7M - 3.8M gas (45 transactions)
- **Total**: ~3.2M - 4.3M gas

## Troubleshooting

### "Not authorized to upgrade"
- Ensure your `DEPLOYER_PRIVATE_KEY` corresponds to the ProxyAdmin owner
- Current owner: `0xdb8047eD77099626e189316Ced0b25b46Ae0181d`

### "Template update failed"
- Check that Step 1 (upgrade) completed successfully
- Verify the contract has the `updateTemplateSecondaryTrait()` function

### Verification shows incorrect templates
- Re-run the update script for failed templates
- Check transaction receipts for any failures

## Safety Notes

- All scripts include safety checks
- Templates that are already correct are skipped
- Each update is verified before proceeding
- Epic items (54-63) are never modified

