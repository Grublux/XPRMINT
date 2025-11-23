# Stabilization System Deployment Checklist

This checklist covers deploying the complete stabilization + item system to ApeChain mainnet.

## Prerequisites

- [ ] **Python environment** with keccak libraries:
  ```bash
  pip install pysha3  # or pycryptodome
  ```

- [ ] **Foundry installed** and configured:
  ```bash
  forge --version  # Should be 0.2.0 or later
  ```

- [ ] **Environment variables configured** in `.env` or shell:
  ```bash
  export APECHAIN_MAINNET_RPC_URL="https://apechain.xyz"
  export APECHAIN_MAINNET_CHAIN_ID="33139"  # Verify this is correct for ApeChain
  export DEPLOYER_PRIVATE_KEY="0x..."  # Or use PRIVATE_KEY
  export STAB_DAY_SECONDS="86400"  # 1 day in seconds
  export STAB_ENTROPY_SEED="0x..."  # bytes32 hex string, or use default
  ```

## Step 1: Catalog Generation

- [ ] Run catalog generation script:
  ```bash
  cd docs/stabilization_script/sim/items
  python3 generate_catalog_json.py
  ```

- [ ] Verify `docs/stabilization_script/sim/items/output/catalog.json` is up to date:
  ```bash
  python3 validate_catalog.py
  ```

- [ ] Confirm validation passes (all deltas within expected ranges)

## Step 2: Image Preparation

- [ ] Ensure all item images are present:
  ```bash
  ls assets/items/*.png | wc -l  # Should match templateCount from catalog.json
  ```

- [ ] Verify image files match `image_key` values in catalog.json:
  - Format: `assets/items/<image_key>.png`
  - Example: `assets/items/item_0.png`

- [ ] Count images matches `templateCount` from catalog.json

## Step 3: Dry Run (No Broadcast)

- [ ] Run deployment script in simulation mode:
  ```bash
  forge script scripts/DeployStabilizationSystem.s.sol \
    --rpc-url $APECHAIN_MAINNET_RPC_URL \
    --fork-url $APECHAIN_MAINNET_RPC_URL \
    -vvv
  ```
  (Note: No `--broadcast` flag)

- [ ] Confirm script compiles and simulates successfully
- [ ] Review logged addresses and configuration
- [ ] Verify no revert errors in simulation

## Step 4: Mainnet Deployment

- [ ] **Deploy stabilization system:**
  ```bash
  forge script scripts/DeployStabilizationSystem.s.sol \
    --rpc-url $APECHAIN_MAINNET_RPC_URL \
    --broadcast \
    -vvv
  ```

- [ ] **Capture deployed addresses:**
  - ProxyAdmin: `0x...`
  - ItemCatalog proxy: `0x...`
  - ItemToken1155 proxy: `0x...`
  - CreatureStabilizer proxy: `0x...`
  - ItemImageDeployer: `0x...`

- [ ] Save addresses to a deployment artifact file (optional):
  ```bash
  # Create deployment-addresses.json
  {
    "proxyAdmin": "0x...",
    "itemCatalogProxy": "0x...",
    "itemTokenProxy": "0x...",
    "creatureStabilizerProxy": "0x...",
    "itemImageDeployer": "0x..."
  }
  ```

## Step 5: Catalog + Image Population

- [ ] **Set environment variables for existing addresses:**
  ```bash
  export ITEM_CATALOG_PROXY="0x..."  # From Step 4
  export ITEM_IMAGE_DEPLOYER="0x..."  # From Step 4
  export PROXY_ADMIN="0x..."  # From Step 4 (if needed)
  ```

- [ ] **Populate catalog:**
  ```bash
  forge script scripts/DeployItemCatalog.s.sol \
    --rpc-url $APECHAIN_MAINNET_RPC_URL \
    --broadcast \
    -vvv
  ```

- [ ] Verify all templates were added:
  - Check console logs for "Templates added: X / Y"
  - Confirm X == Y (all templates successful)

## Step 6: Contract Verification

- [ ] **Verify contracts on ApeScan** using exact compiler settings from `foundry.toml`:
  - `solc_version = 0.8.24`
  - `evm_version = cancun`
  - `optimizer = true`
  - `optimizer_runs = 200`
  - `via_ir = false` (CRITICAL: must be false)

- [ ] **Verification methods:**
  ```bash
  # Using forge verify-contract (if supported)
  forge verify-contract \
    --chain-id $APECHAIN_MAINNET_CHAIN_ID \
    --num-of-optimizations 200 \
    --compiler-version 0.8.24 \
    --constructor-args $(cast abi-encode "constructor()") \
    <CONTRACT_ADDRESS> \
    <CONTRACT_NAME>
  ```

  Or use ApeScan UI:
  1. Navigate to contract address
  2. Click "Verify and Publish"
  3. Paste source code
  4. Select compiler version: **0.8.24**
  5. Select EVM version: **cancun**
  6. Enable optimizer: **Yes**
  7. Optimization runs: **200**
  8. **Do NOT enable "via IR"**

- [ ] Verify all contracts:
  - [ ] ItemCatalog implementation
  - [ ] ItemCatalog proxy
  - [ ] ItemToken1155 implementation
  - [ ] ItemToken1155 proxy
  - [ ] CreatureStabilizer implementation
  - [ ] CreatureStabilizer proxy
  - [ ] ProxyAdmin
  - [ ] ItemImageDeployer

## Step 7: Post-Deploy Smoke Tests

- [ ] **Run smoke test script:**
  ```bash
  export STAB_CREATURE_STABILIZER="0x..."  # From Step 4
  export STAB_ITEM_CATALOG="0x..."  # From Step 4
  export STAB_ITEM_TOKEN="0x..."  # From Step 4

  forge script scripts/SmokeStabilizationSystem.s.sol \
    --rpc-url $APECHAIN_MAINNET_RPC_URL \
    -vvv
  ```

- [ ] Verify smoke test passes:
  - [ ] All read-only checks succeed
  - [ ] Optional stateful smoke (if enabled) completes without errors

## Step 8: Frontend Integration

- [ ] Update frontend configuration with deployed addresses
- [ ] Test frontend can read from contracts
- [ ] Verify item metadata URIs resolve correctly

## Step 9: Monitoring Setup

- [ ] Set up catalog integrity monitoring (see `docs/stabilization/monitoring.md`)
- [ ] Configure alerts for catalog discrepancies
- [ ] Schedule daily catalog validation checks

## Security Checklist

- [ ] All contracts verified on ApeScan
- [ ] ProxyAdmin secured (multi-sig recommended for mainnet)
- [ ] Only authorized addresses can call `addTemplate` (ItemCatalog owner)
- [ ] Frontend uses correct contract addresses
- [ ] Item images correctly deployed to SSTORE2
- [ ] Global entropy seed is set correctly and documented
- [ ] Private keys stored securely (never commit to git)

## Troubleshooting

### Catalog JSON Parsing Errors
- Verify JSON is valid: `python3 -m json.tool docs/stabilization_script/sim/items/output/catalog.json`
- Check file path matches `CATALOG_JSON_PATH` env var

### Image Deployment Failures
- Verify images exist at `assets/items/<image_key>.png`
- Check file permissions and readability
- Large images may require higher gas limits

### Template ID Mismatches
- Catalog is append-only; IDs are assigned in order
- Ensure catalog.json entries are sequential (0, 1, 2, ...)

### Verification Failures
- **Most common issue**: `via_ir` mismatch
  - Deployed bytecode was compiled with `via_ir = false`
  - Verification must use `via_ir = false` (or disable IR in UI)
- Double-check all compiler settings match `foundry.toml`

## Post-Deployment

After successful deployment:

1. **Document addresses** in a secure location
2. **Update frontend** configuration
3. **Set up monitoring** for catalog integrity
4. **Test end-to-end** with a test creature
5. **Announce deployment** to team/users

## References

- Main deployment guide: `scripts/README_DEPLOYMENT.md`
- Monitoring docs: `docs/stabilization/monitoring.md`
- Verification notes: `docs/stabilization/verification-notes.md`


