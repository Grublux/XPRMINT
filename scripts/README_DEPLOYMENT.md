# Stabilization System Deployment Guide

This guide covers deploying the complete stabilization system including ItemCatalog, ItemToken1155, and CreatureStabilizer.

> **📋 For a step-by-step deployment checklist, see [`docs/stabilization/deployment-checklist.md`](../docs/stabilization/deployment-checklist.md)**

## Quick Reference

**Mainnet deployment:**
```bash
# 1. Deploy system
forge script scripts/DeployStabilizationSystem.s.sol --rpc-url $APECHAIN_MAINNET_RPC_URL --broadcast -vvv

# 2. Populate catalog
forge script scripts/DeployItemCatalog.s.sol --rpc-url $APECHAIN_MAINNET_RPC_URL --broadcast -vvv

# 3. Smoke test
forge script scripts/SmokeStabilizationSystem.s.sol --rpc-url $APECHAIN_MAINNET_RPC_URL -vvv
```

**⚠️ Important:** Compiler settings in `foundry.toml` (solc 0.8.24, cancun, via_ir = false, optimizer 200) **MUST** be reused during ApeScan verification.

## Prerequisites

1. **Environment Setup**
   ```bash
   export PRIVATE_KEY=your_private_key
   export RPC_URL=https://apechain.xyz  # or your target network
   ```

2. **Generate Catalog JSON**
   ```bash
   cd docs/stabilization_script/sim/items
   python3 generate_catalog_json.py
   ```
   This creates `output/catalog.json` with all item templates.

3. **Prepare Item Images** (Optional)
   - Place item images in `assets/items/` directory
   - Name files according to `image_key` in catalog.json (e.g., `item_0.png`)
   - Images will be deployed to SSTORE2 during catalog population

## Deployment Steps

### Option 1: Full System Deployment (Recommended for First Time)

Deploys all contracts in one transaction:

```bash
forge script scripts/DeployStabilizationSystem.s.sol:DeployStabilizationSystem \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify
```

**Configuration via environment variables:**
- `DAY_SECONDS`: Length of game day in seconds (default: 86400)
- `ENTROPY_SEED`: Global entropy seed (default: keccak256("XPRMINT_GLOBAL_ENTROPY_V1"))
- `BASE_URI`: Base URI for token metadata (default: https://api.xprmint.com/items/{id}.json)

**Output:**
- ProxyAdmin address
- ItemCatalog proxy address
- ItemToken1155 proxy address
- CreatureStabilizer proxy address

### Option 2: Deploy Catalog Separately

If you need to deploy the catalog separately (e.g., to populate it before deploying other contracts):

```bash
# Deploy catalog
forge script scripts/DeployItemCatalog.s.sol:DeployItemCatalog \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify

# Then deploy rest of system with existing catalog address
export ITEM_CATALOG_ADDRESS=0x...
forge script scripts/DeployStabilizationSystem.s.sol:DeployStabilizationSystem \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify
```

### Option 3: Populate Existing Catalog

If catalog is already deployed, populate it with templates:

```bash
export CATALOG_ADDRESS=0x...
export PROXY_ADMIN=0x...  # Optional, will deploy new if not provided
export CATALOG_JSON_PATH=docs/stabilization_script/sim/items/output/catalog.json

forge script scripts/DeployItemCatalog.s.sol:DeployItemCatalog \
  --rpc-url $RPC_URL \
  --broadcast
```

## Post-Deployment

### 1. Verify Catalog Integrity

Run the monitoring script to verify all templates are correctly deployed:

```bash
python scripts/monitor_catalog.py \
  --rpc-url $RPC_URL \
  --catalog-address $ITEM_CATALOG_ADDRESS
```

### 2. Update Frontend Configuration

Update your frontend with the deployed addresses:

```typescript
// config/contracts.ts
export const CONTRACTS = {
  itemCatalog: "0x...",
  itemToken: "0x...",
  creatureStabilizer: "0x...",
};
```

### 3. Grant Permissions

Ensure CreatureStabilizer has necessary permissions:

```bash
# Set stabilizer in ItemToken1155 (if not done automatically)
cast send $ITEM_TOKEN_ADDRESS "setStabilizer(address)" $STABILIZER_ADDRESS \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

## Troubleshooting

### Catalog JSON Parsing Errors

If the deployment script fails to parse catalog.json:

1. Verify JSON is valid:
   ```bash
   python3 -m json.tool docs/stabilization_script/sim/items/output/catalog.json > /dev/null
   ```

2. Check file path is correct in script

3. Ensure catalog.json has all required fields:
   - `id`, `name`, `rarity`, `primary_trait`, `primary_delta`
   - `secondary_trait`, `secondary_delta`, `image_key`, `description`

### Image Deployment Failures

If image deployment fails:

1. Check image file exists at path: `assets/items/{image_key}`
2. Verify image file is readable (not corrupted)
3. Check gas limits (large images may require more gas)

### Template ID Mismatches

If template IDs don't match:

- Catalog is append-only; IDs are assigned in order
- Ensure catalog.json entries are in correct order
- Don't skip IDs in JSON (must be 0, 1, 2, ...)

## Network-Specific Notes

### ApeChain Mainnet

```bash
export RPC_URL=https://apechain.xyz
export EXPLORER_URL=https://apechain.xyz/explorer
```

### Local Anvil

```bash
anvil
export RPC_URL=http://localhost:8545
```

### Testnets

Use appropriate RPC URLs and verify contracts on block explorer.

## Security Checklist

- [ ] All contracts verified on block explorer
- [ ] Catalog integrity verified via monitoring script
- [ ] Only authorized addresses can call `addTemplate`
- [ ] ProxyAdmin is secured (multi-sig recommended for mainnet)
- [ ] Frontend uses correct contract addresses
- [ ] Item images are correctly deployed to SSTORE2
- [ ] Global entropy seed is set correctly

## Monitoring

Set up automated monitoring:

```bash
# Add to crontab (runs daily)
0 2 * * * cd /path/to/project && python scripts/monitor_catalog.py \
  --rpc-url $RPC_URL \
  --catalog-address $ITEM_CATALOG_ADDRESS \
  >> logs/catalog-monitor.log 2>&1
```

See `docs/stabilization/monitoring.md` for detailed monitoring documentation.

