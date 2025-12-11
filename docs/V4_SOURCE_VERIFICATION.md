# V4 Contract Source Verification Guide

**Chain:** ApeChain (Chain ID: 33139)  
**Explorer:** ApeScan (https://apescan.io)  
**Verifier:** Etherscan API V2 (via ApeScan)

## Prerequisites

1. **Export environment variables:**
   ```bash
   export APESCAN_API_KEY="your_apescan_api_key"
   export RPC_URL_APECHAIN="https://apechain.calderachain.xyz/http"
   ```

2. **Verify Foundry version:**
   ```bash
   forge --version
   ```
   Recommended: Foundry 1.5.0+ (for Etherscan API V2 support)

3. **Build contracts:**
   ```bash
   forge build
   ```

## Compiler Settings

All V4 contracts use:
- **Compiler:** Solidity 0.8.24
- **EVM Version:** cancun
- **Optimization:** Enabled (200 runs)
- **via_ir:** false

## Implementation Contracts to Verify

### 1. MasterCrafterV4

**Address:** `0x955E5b0c260Bf09a98CAcd1f0c0682d22bE8C054`  
**Contract Path:** `contracts/crafted/MasterCrafterV4.sol:MasterCrafterV4`  
**Constructor Args:** None (uses `initialize()` pattern)

**Verify Command:**
```bash
forge verify-contract \
  --chain-id 33139 \
  --compiler-version v0.8.24+commit.e11b9ed9 \
  --num-of-optimizations 200 \
  --watch \
  0x955E5b0c260Bf09a98CAcd1f0c0682d22bE8C054 \
  contracts/crafted/MasterCrafterV4.sol:MasterCrafterV4 \
  $APESCAN_API_KEY \
  --verifier-url https://api.apescan.io/api
```

**Expected Result:** ✅ Contract verified on ApeScan

---

### 2. CraftedV4Positions

**Address:** `0x231273FFBF9D6Ef8204150ea293Da9d720a5CfD9`  
**Contract Path:** `contracts/crafted/CraftedV4Positions.sol:CraftedV4Positions`  
**Constructor Args:** None (uses `initialize()` pattern)

**Verify Command:**
```bash
forge verify-contract \
  --chain-id 33139 \
  --compiler-version v0.8.24+commit.e11b9ed9 \
  --num-of-optimizations 200 \
  --watch \
  0x231273FFBF9D6Ef8204150ea293Da9d720a5CfD9 \
  contracts/crafted/CraftedV4Positions.sol:CraftedV4Positions \
  $APESCAN_API_KEY \
  --verifier-url https://api.apescan.io/api
```

**Expected Result:** ✅ Contract verified on ApeScan

---

### 3. NPCStats

**Address:** `0xB952CA17Af29ab2e8cE4E3E4e889BC469EeB464a`  
**Contract Path:** `contracts/stats/NPCStats.sol:NPCStats`  
**Constructor Args:** None (uses `initialize()` pattern)

**Verify Command:**
```bash
forge verify-contract \
  --chain-id 33139 \
  --compiler-version v0.8.24+commit.e11b9ed9 \
  --num-of-optimizations 200 \
  --watch \
  0xB952CA17Af29ab2e8cE4E3E4e889BC469EeB464a \
  contracts/stats/NPCStats.sol:NPCStats \
  $APESCAN_API_KEY \
  --verifier-url https://api.apescan.io/api
```

**Expected Result:** ✅ Contract verified on ApeScan

---

### 4. RoyaltyRouter

**Address:** `0x751c116D7a044be999eF58B4C62389D47ca6eF76`  
**Contract Path:** `contracts/royalties/RoyaltyRouter.sol:RoyaltyRouter`  
**Constructor Args:** None (uses `initialize()` pattern)

**Verify Command:**
```bash
forge verify-contract \
  --chain-id 33139 \
  --compiler-version v0.8.24+commit.e11b9ed9 \
  --num-of-optimizations 200 \
  --watch \
  0x751c116D7a044be999eF58B4C62389D47ca6eF76 \
  contracts/royalties/RoyaltyRouter.sol:RoyaltyRouter \
  $APESCAN_API_KEY \
  --verifier-url https://api.apescan.io/api
```

**Expected Result:** ✅ Contract verified on ApeScan

---

## Proxy Contracts

**Note:** The proxy contracts (`ERC1967Proxy` from OpenZeppelin) are standard implementations. They can be verified by:

1. **Using OpenZeppelin's verified proxy source:**
   - ApeScan may auto-detect standard proxy patterns
   - If not, verify using OpenZeppelin's flattened source

2. **Manual verification (if needed):**
   - Proxy addresses:
     - MasterCrafterV4 Proxy: `0xB461b4c9ff5F14fd8CEcF48600B9E95905199a29`
     - CraftedV4Positions Proxy: `0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E`
     - NPCStats Proxy: `0xbdB9A478e86A1e94e28e2e232957460bAa6C7c3E`
     - RoyaltyRouter Proxy: `0xbD5A38A8EB70d04F4ba8EFa82F9e85F22EE2784e`
   - Implementation addresses are stored in ERC1967 storage slot
   - Init data can be extracted from deployment transaction

**Priority:** Verify implementations first. Proxy verification is optional but recommended for transparency.

---

## Verification Checklist

- [ ] MasterCrafterV4 implementation verified
- [ ] CraftedV4Positions implementation verified
- [ ] NPCStats implementation verified
- [ ] RoyaltyRouter implementation verified
- [ ] (Optional) All proxy contracts verified

---

## Troubleshooting

### Error: "Contract already verified"
- ✅ Contract is already verified. No action needed.

### Error: "Compiler version mismatch"
- Check the exact compiler version used during deployment:
  ```bash
  cast code 0x955E5b0c260Bf09a98CAcd1f0c0682d22bE8C054 --rpc-url $RPC_URL_APECHAIN | head -c 20
  ```
- Use the exact version string from `forge build` output.

### Error: "Constructor arguments mismatch"
- V4 contracts use `initialize()` pattern, so constructor args should be empty.
- If you see this error, check that you're not passing constructor args.

### Error: "Optimization settings mismatch"
- Ensure `--num-of-optimizations 200` matches your `foundry.toml` settings.
- Check `foundry.toml` for `optimizer_runs = 200`.

### Error: "Library not found"
- If contracts use external libraries, you may need to:
  1. Flatten the contract with libraries
  2. Or verify libraries separately first

---

## Post-Verification

After verification, confirm on ApeScan:

1. **Contract page shows "Contract" tab with source code**
2. **"Read Contract" tab shows all public functions**
3. **"Write Contract" tab shows all state-changing functions**
4. **"Read as Proxy" tab shows implementation address** (for proxies)

---

## Quick Verify All Script

Save this as `verify-all-v4.sh`:

```bash
#!/bin/bash
set -e

export APESCAN_API_KEY="${APESCAN_API_KEY:-your_key_here}"
export RPC_URL_APECHAIN="${RPC_URL_APECHAIN:-https://apechain.calderachain.xyz/http}"

echo "=== Verifying V4 Contracts ==="

# MasterCrafterV4
forge verify-contract \
  --chain-id 33139 \
  --compiler-version v0.8.24+commit.e11b9ed9 \
  --num-of-optimizations 200 \
  --watch \
  0x955E5b0c260Bf09a98CAcd1f0c0682d22bE8C054 \
  contracts/crafted/MasterCrafterV4.sol:MasterCrafterV4 \
  $APESCAN_API_KEY \
  --verifier-url https://api.apescan.io/api

# CraftedV4Positions
forge verify-contract \
  --chain-id 33139 \
  --compiler-version v0.8.24+commit.e11b9ed9 \
  --num-of-optimizations 200 \
  --watch \
  0x231273FFBF9D6Ef8204150ea293Da9d720a5CfD9 \
  contracts/crafted/CraftedV4Positions.sol:CraftedV4Positions \
  $APESCAN_API_KEY \
  --verifier-url https://api.apescan.io/api

# NPCStats
forge verify-contract \
  --chain-id 33139 \
  --compiler-version v0.8.24+commit.e11b9ed9 \
  --num-of-optimizations 200 \
  --watch \
  0xB952CA17Af29ab2e8cE4E3E4e889BC469EeB464a \
  contracts/stats/NPCStats.sol:NPCStats \
  $APESCAN_API_KEY \
  --verifier-url https://api.apescan.io/api

# RoyaltyRouter
forge verify-contract \
  --chain-id 33139 \
  --compiler-version v0.8.24+commit.e11b9ed9 \
  --num-of-optimizations 200 \
  --watch \
  0x751c116D7a044be999eF58B4C62389D47ca6eF76 \
  contracts/royalties/RoyaltyRouter.sol:RoyaltyRouter \
  $APESCAN_API_KEY \
  --verifier-url https://api.apescan.io/api

echo "=== Verification Complete ==="
```

Make executable: `chmod +x verify-all-v4.sh`

