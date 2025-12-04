# Upgrade ItemToken1155 V1 to V1.2 (External Image Base URI)

This guide walks through upgrading the V1 ItemToken1155 proxy to support marketplace-friendly image URLs.

## What Changed

The new implementation adds:
- `externalImageBaseURI` storage variable (at end of storage layout - backward compatible)
- `setExternalImageBaseURI()` owner-only setter
- Updated `uri()` to include both:
  - `image`: HTTP URL when base URI is set, otherwise data URI (backward compatible)
  - `image_data`: Always the on-chain data URI (for purists)

## Prerequisites

1. Environment variables set:
   ```bash
   export RPC=https://apechain.calderachain.xyz/http
   export DEPLOYER_PRIVATE_KEY=<your_private_key>
   export PROXY_ADMIN_V1=0xdb8047eD77099626e189316Ced0b25b46Ae0181d
   export ITEM_TOKEN_PROXY_V1=0x9c4216d7b56a25b4b8a8eddefebaba389e05a01e
   ```

2. Verify you own ProxyAdminV1:
   ```bash
   cast call $PROXY_ADMIN_V1 "owner()(address)" --rpc-url $RPC
   ```
   Should return your deployer address.

## Step 1: Deploy New Implementation

Deploy the new ItemToken1155 implementation:

```bash
forge script scripts/DeployItemToken1155V1_2.s.sol \
  --rpc-url $RPC \
  --broadcast
```

**Save the implementation address** from the output:
```bash
export ITEM_TOKEN_IMPL_V1_2=<implementation_address>
```

## Step 2: Upgrade the Proxy

Upgrade the V1 proxy to point to the new implementation:

```bash
forge script scripts/UpgradeItemToken1155V1.s.sol \
  --rpc-url $RPC \
  --broadcast
```

This script will:
- Verify ProxyAdminV1 ownership
- Check current implementation
- Upgrade the proxy to the new implementation
- Verify the upgrade succeeded

## Step 3: Set External Image Base URI

After the upgrade, configure the base URI for marketplace-friendly URLs:

```bash
export EXTERNAL_IMAGE_BASE_URI="https://xprmint.com/items_full/"

forge script scripts/SetExternalImageBaseURI.s.sol \
  --rpc-url $RPC \
  --broadcast
```

**Important**: 
- The base URI must end with a trailing slash (`/`)
- Replace `xprmint.com` with your actual Vercel domain
- The contract will append `{id}.png` automatically

## Step 4: Verify Metadata

Verify that metadata now includes both image fields:

```bash
# Get token URI for item 0
cast call $ITEM_TOKEN_PROXY_V1 "uri(uint256)(string)" 0 --rpc-url $RPC

# Decode and check JSON
cast call $ITEM_TOKEN_PROXY_V1 "uri(uint256)(string)" 0 --rpc-url $RPC | \
  sed 's/data:application\/json;base64,//' | base64 -d | jq .
```

You should see:
- `"image": "https://xprmint.com/items_full/0.png"` (HTTP URL)
- `"image_data": "data:image/png;base64,..."` (on-chain data URI)

## Verification Checklist

- [ ] New implementation deployed successfully
- [ ] Proxy upgraded to new implementation
- [ ] `externalImageBaseURI` set correctly
- [ ] `uri(0)` returns JSON with both `image` and `image_data` fields
- [ ] `image` field is HTTP URL (not data URI)
- [ ] `image_data` field is data URI
- [ ] All 64 items have valid metadata (run metadata audit script)

## Rollback (if needed)

If something goes wrong, you can rollback by upgrading to the previous implementation:

```bash
export ITEM_TOKEN_IMPL_V1_1=<previous_implementation_address>

forge script scripts/UpgradeItemToken1155V1.s.sol \
  --rpc-url $RPC \
  --broadcast
```

## Troubleshooting

### "Not authorized to upgrade"
- Verify `PROXY_ADMIN_V1` owner matches your deployer address
- Check that you're using the correct private key

### "Proxy already points to this implementation"
- The upgrade already happened, or you're using the wrong implementation address
- Verify current implementation: `cast call $ITEM_TOKEN_PROXY_V1 "implementation()(address)" --rpc-url $RPC`

### Images not showing on Magic Eden
- Verify base URI is set: `cast call $ITEM_TOKEN_PROXY_V1 "externalImageBaseURI()(string)" --rpc-url $RPC`
- Verify files exist on Vercel: `curl https://xprmint.com/items_full/0.png`
- Magic Eden may cache metadata - wait 24-48 hours or contact support

## Next Steps

After successful upgrade:
1. Wait for Magic Eden / explorers to refresh metadata
2. Verify images appear correctly on marketplaces
3. Monitor for any issues with metadata fetching




