# Stabilization System V3 Deployment Guide

This document outlines the deployment process for the V3 Stabilization System on ApeChain mainnet.

**IMPORTANT**: This deployment uses the existing V1 catalog and images. Only ITEM_V3 and STAB_V3 are new deployments.

## V3 Admin Topology

**CRITICAL INVARIANTS:**

1. **Exactly one ProxyAdminV3**: There is exactly one `ProxyAdminV3` contract used for all V3 contracts. It is deployed separately via `DeployStabilizationProxyAdminV3.s.sol`.

2. **ProxyAdminV3 ownership**: `ProxyAdminV3` is owned **directly** by the deployer EOA. No contract, no multisig, no other ProxyAdmin owns it.

3. **V3 proxy administration**: Every V3 proxy (`CreatureStabilizerV3`, `ItemToken1155V3`) uses `TransparentUpgradeableProxy` with deployer EOA as `initialOwner`. This creates individual ProxyAdmins owned by deployer EOA (not by ProxyAdminV3), allowing direct upgrades.

4. **ProxyAdminV3 role**: ProxyAdminV3 serves as a central management contract for future governance/multi-sig, but individual proxies have their own ProxyAdmins owned by deployer EOA for direct upgradeability.

5. **Legacy systems**: V0/V1/V2 proxies remain on-chain but are **never upgraded again**. They are considered legacy artifacts.

## Why V3?

V0/V1/V2 deployments had a critical architectural flaw:
- Proxies were created with `ProxyAdminV1` (a contract) as the admin
- `ProxyAdminV1` was owned by another contract or had nested ownership
- Contracts cannot sign transactions, making upgrades impossible

V3 fixes this by:
- Deploying a single `ProxyAdminV3` owned directly by deployer EOA
- Passing deployer EOA as `initialOwner` to each `TransparentUpgradeableProxy`
- Individual ProxyAdmins created by proxies are owned by deployer EOA (can sign transactions)
- `ProxyAdminV3` serves as central management for future governance/multi-sig

## Prerequisites

1. **Environment Variables**:
   ```bash
   export RPC=https://apechain.calderachain.xyz/http
   export DEPLOYER_PRIVATE_KEY=<your_private_key>
   ```

2. **Existing Contracts** (from V1 deployment):
   - `ITEM_CATALOG_PROXY_V1`: ItemCatalog proxy address
   - `STAB_IMPL_V2`: Latest CreatureStabilizer implementation (with `setItemToken`)
   - `ITEM_IMPL_V2`: Latest ItemToken1155 implementation (with `externalImageBaseURI`)

3. **V3 Configuration**:
   ```bash
   export DAY_SECONDS_V3=86400  # Or your desired day length
   export ENTROPY_SEED_V3=<bytes32_entropy_seed>
   export EXTERNAL_IMAGE_BASE_URI_V3="https://xprmint.com/items_full/"
   ```

## Quick Start (Combined Deployment)

For a single-command deployment, use the combined orchestrator script:

```bash
export RPC=https://apechain.calderachain.xyz/http
export DEPLOYER_PRIVATE_KEY=<your_private_key>
export CATALOG_V1=0x06266255ee081AcA64328dE8fcc939923eE6e8c8
export DAY_SECONDS_V3=86400
export ENTROPY_SEED_V3=<your_entropy_seed_bytes32>

# Dry-run first:
forge script scripts/DeployStabilizationSystemV3.s.sol --rpc-url $RPC

# Deploy:
forge script scripts/DeployStabilizationSystemV3.s.sol --rpc-url $RPC --broadcast
```

This script will:
1. Deploy ProxyAdminV3 (owned by deployer EOA)
2. Deploy ItemToken1155 V3 implementation
3. Deploy ITEM_V3 proxy
4. Deploy CreatureStabilizer V3 implementation
5. Deploy STAB_V3 proxy
6. Wire ITEM_V3 to STAB_V3
7. Verify all V3 invariants
8. Print export lines for addresses

---

## Step-by-Step Deployment (Alternative)

If you prefer to deploy components separately:

### Step 1: Deploy ProxyAdminV3

Deploy the single ProxyAdminV3 contract:

```bash
forge script scripts/DeployStabilizationProxyAdminV3.s.sol \
  --rpc-url $RPC \
  --broadcast
```

**Expected Output:**
```
ProxyAdminV3 deployed at: <address>
export PROXY_ADMIN_V3=<address>
```

**Save the address:**
```bash
export PROXY_ADMIN_V3=<address_from_output>
```

**Verification:**
```bash
# Verify ProxyAdminV3 owner is deployer EOA
cast call $PROXY_ADMIN_V3 "owner()(address)" --rpc-url $RPC
# Should return: <deployer_address>
```

### Step 2: Deploy CreatureStabilizerV3

Deploy the CreatureStabilizerV3 proxy:

```bash
export PROXY_ADMIN_V3=<from_step_1>
export STAB_IMPL_V2=0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8
export ITEM_CATALOG_PROXY_V1=<catalog_proxy_address>
export DAY_SECONDS_V3=86400
export ENTROPY_SEED_V3=<your_entropy_seed>

forge script scripts/DeployCreatureStabilizerV3.s.sol \
  --rpc-url $RPC \
  --broadcast
```

**Expected Output:**
```
STAB_V3 deployed at: <address>
export CREATURE_STABILIZER_PROXY_V3=<address>
```

**Save the address:**
```bash
export CREATURE_STABILIZER_PROXY_V3=<address_from_output>
```

**Verification:**
```bash
# Verify ProxyAdminV3 is the admin of STAB_V3
# Get admin address from admin slot
cast call $CREATURE_STABILIZER_PROXY_V3 "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103()(address)" --rpc-url $RPC
# Should return: <PROXY_ADMIN_V3_address>
```

### Step 3: Deploy ItemToken1155V3

Deploy the ItemToken1155V3 proxy:

```bash
export PROXY_ADMIN_V3=<from_step_1>
export ITEM_IMPL_V2=<item_token_implementation_address>
export ITEM_CATALOG_PROXY_V1=<catalog_proxy_address>
export CREATURE_STABILIZER_PROXY_V3=<from_step_2>

forge script scripts/DeployItemToken1155V3.s.sol \
  --rpc-url $RPC \
  --broadcast
```

**Expected Output:**
```
ITEM_V3 deployed at: <address>
export ITEM_TOKEN_PROXY_V3=<address>
```

**Save the address:**
```bash
export ITEM_TOKEN_PROXY_V3=<address_from_output>
```

**Verification:**
```bash
# Verify individual ProxyAdmin is owned by deployer (same as Step 2)
# Verify name and symbol
cast call $ITEM_TOKEN_PROXY_V3 "name()(string)" --rpc-url $RPC
cast call $ITEM_TOKEN_PROXY_V3 "symbol()(string)" --rpc-url $RPC
```

### Step 4: Wire CreatureStabilizerV3 to ItemToken1155V3

Wire the CreatureStabilizerV3 to use ItemToken1155V3:

```bash
export CREATURE_STABILIZER_PROXY_V3=<from_step_2>
export ITEM_TOKEN_PROXY_V3=<from_step_3>

forge script scripts/WireStabilizerToItemV3.s.sol \
  --rpc-url $RPC \
  --broadcast
```

**Verification:**
```bash
# Verify CreatureStabilizerV3 is using ITEM_V3
cast call $CREATURE_STABILIZER_PROXY_V3 "itemToken()(address)" --rpc-url $RPC
# Should return: <ITEM_TOKEN_PROXY_V3_address>
```

### Step 5: Set External Image Base URI

Set the external image base URI for marketplace-friendly image URLs:

```bash
export ITEM_TOKEN_PROXY_V3=<from_step_3>
export EXTERNAL_IMAGE_BASE_URI_V3="https://xprmint.com/items_full/"

forge script scripts/SetItemV3ExternalBaseURI.s.sol \
  --rpc-url $RPC \
  --broadcast
```

**Verification:**
```bash
# Verify externalImageBaseURI is set
cast call $ITEM_TOKEN_PROXY_V3 "externalImageBaseURI()(string)" --rpc-url $RPC
# Should return: "https://xprmint.com/items_full/"

# Verify token URI includes both image and image_data
cast call $ITEM_TOKEN_PROXY_V3 "uri(uint256)(string)" 0 --rpc-url $RPC
# Should return JSON with both "image" (HTTP URL) and "image_data" (data URI)
```

### Step 6: Minting the Full V3 Item Set

After deployment, you may want to mint 1 of each item (IDs 0-63) to a recipient wallet for testing or distribution.

**Required Environment Variables:**
```bash
export RPC=https://apechain.calderachain.xyz/http
export DEPLOYER_PRIVATE_KEY=<your_private_key>
export ITEM_V3=0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8
export MINT_RECIPIENT=<your_wallet_address>  # optional, defaults to deployer
export MINT_AMOUNT=1                          # optional, defaults to 1
```

**Note:** The deployer must be the owner of `ITEM_V3` for `adminMint` to succeed.

**Command to Run:**
```bash
forge script scripts/MintAllV3Items.s.sol \
  --rpc-url $RPC \
  --broadcast
```

This will mint `MINT_AMOUNT` (default: 1) of each item ID (0-63) to `MINT_RECIPIENT` (default: deployer EOA).

**Verification:**
```bash
# Check balance of item 0
cast call $ITEM_V3 "balanceOf(address,uint256)(uint256)" $MINT_RECIPIENT 0 --rpc-url $RPC
# Should return: 1 (or MINT_AMOUNT if different)

# Check balance of item 63
cast call $ITEM_V3 "balanceOf(address,uint256)(uint256)" $MINT_RECIPIENT 63 --rpc-url $RPC
# Should return: 1 (or MINT_AMOUNT if different)
```

## Verification Checklist

After deployment, verify all invariants:

- [ ] `ProxyAdminV3.owner == deployer EOA`
  ```bash
  cast call $PROXY_ADMIN_V3 "owner()(address)" --rpc-url $RPC
  ```

- [ ] `STAB_V3` admin == ProxyAdminV3
  ```bash
  # Get admin from admin slot
  ADMIN=$(cast call $CREATURE_STABILIZER_PROXY_V3 "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103()(address)" --rpc-url $RPC)
  # Should equal $PROXY_ADMIN_V3
  ```

- [ ] `ITEM_V3` admin == ProxyAdminV3
  ```bash
  # Same as above but for ITEM_V3
  ```

- [ ] `CreatureStabilizerV3.itemToken() == ITEM_TOKEN_PROXY_V3`
  ```bash
  cast call $CREATURE_STABILIZER_PROXY_V3 "itemToken()(address)" --rpc-url $RPC
  ```

- [ ] No other ProxyAdmins appear in the V3 deployment flow
  - Check that only `ProxyAdminV3` was deployed
  - Check that all V3 proxies use `ProxyAdminV3` as their admin

## Legacy Systems (V0/V1/V2)

**IMPORTANT**: V0/V1/V2 proxies remain on-chain but are **never upgraded again**. They are considered legacy artifacts.

- **V0**: Initial deployment with per-deployment ProxyAdmin
- **V1**: Single ProxyAdminV1, but proxies created individual ProxyAdmins owned by ProxyAdminV1 (nested issue)
- **V2**: Individual ProxyAdmins owned by deployer EOA (correct pattern, but per-proxy admins)

**V3** fixes all previous issues by:
- Single ProxyAdminV3 for central management
- Individual ProxyAdmins owned by deployer EOA (direct upgradeability)
- Clean architecture with no nested contract ownership

## Troubleshooting

### "ProxyAdminV3 owner is not deployer EOA"
- Verify `DEPLOYER_PRIVATE_KEY` is correct
- Check that ProxyAdminV3 was deployed with deployer as owner

### "Individual ProxyAdmin owner is not deployer"
- This should not happen if you used the V3 deployment scripts
- Verify you're using `DeployCreatureStabilizerV3.s.sol` and `DeployItemToken1155V3.s.sol`
- Check that deployer EOA was passed as `initialOwner` to `TransparentUpgradeableProxy`

### "Deployer is not the owner"
- Verify you're using the correct `DEPLOYER_PRIVATE_KEY`
- Check that the proxy contracts are owned by the deployer EOA

## Upgrades / Hotfixes

### ItemToken1155 V3 Collection Label Upgrade

There is a metadata-only upgrade available for `ITEM_V3` that updates the `collection` field in token URIs from `"Stabilization Items"` to `"Stabilization Items V3"`. This is a cosmetic change only and does not affect gameplay, SP, item behavior, or catalog data.

**Upgrade Script**: `scripts/UpgradeItemToken1155V3_CollectionLabel.s.sol`

**Usage**:
```bash
export RPC="https://apechain.calderachain.xyz/http"
export DEPLOYER_PRIVATE_KEY=<your_private_key>
export PROXY_ADMIN_V3=0xD6b4087cAd41F45a06A344c193de9B0EbcE957DB
export ITEM_V3=0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8

# Dry-run first:
forge script scripts/UpgradeItemToken1155V3_CollectionLabel.s.sol --rpc-url $RPC

# Deploy upgrade:
forge script scripts/UpgradeItemToken1155V3_CollectionLabel.s.sol --rpc-url $RPC --broadcast
```

**Verification**:
After upgrade, verify the collection label is updated:
```bash
cast call $ITEM_V3 "uri(uint256)(string)" 0 --rpc-url $RPC
```

Decode the base64 JSON (after `data:application/json;base64,`) and confirm it contains:
```json
"collection":"Stabilization Items V3"
```

All other fields (name, description, image, image_data, attributes) should remain unchanged.

## Next Steps

After deployment:
1. Seed the ItemCatalog (if not already done)
2. Upload item images (if not already done)
3. Run smoke tests to verify gameplay
4. Verify contracts on ApeScan
5. Update frontend to use V3 addresses
6. (Optional) Apply collection label upgrade if needed

## V3 Admin Invariants Summary

```
// V3 ADMIN INVARIANTS:
// - Exactly one ProxyAdminV3.
// - ProxyAdminV3.owner == deployer EOA.
// - STAB_V3 admin == ProxyAdminV3.
// - ITEM_V3 admin == ProxyAdminV3.
// - No nested or per-proxy ProxyAdmins.
// - Old V0/V1/V2 proxies are legacy and never upgraded again.
```

---

## Implementation Notes

**V3 Deployment Scripts Created:**
- `scripts/DeployStabilizationProxyAdminV3.s.sol` - Deploys single ProxyAdminV3
- `scripts/DeployCreatureStabilizerV3.s.sol` - Deploys STAB_V3 proxy
- `scripts/DeployItemToken1155V3.s.sol` - Deploys ITEM_V3 proxy
- `scripts/WireStabilizerToItemV3.s.sol` - Wires STAB_V3 to ITEM_V3
- `scripts/SetItemV3ExternalBaseURI.s.sol` - Sets external image base URI

**Key Architectural Decisions:**
1. `TransparentUpgradeableProxy` does NOT deploy ProxyAdmins
2. V3 passes `ProxyAdminV3` directly as the admin to each proxy
3. All V3 proxies are administered by the same `ProxyAdminV3`
4. `ProxyAdminV3` is owned by deployer EOA, allowing direct upgrades
5. Single ProxyAdmin pattern avoids nested contract ownership issues

**No Gameplay Changes:**
- All stabilization mechanics unchanged
- Item generation, catalog, SP, deltas, vibes, resonance unchanged
- Only deployment architecture improved

