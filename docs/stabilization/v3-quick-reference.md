# V3 Stabilization System - Quick Reference

**Location:** `docs/stabilization/v3-quick-reference.md`

This document provides a single source of truth for all V3 contract addresses, environment variables, and common commands.

## 📍 Contract Addresses (ApeChain Mainnet)

### V3 Contracts (Canonical - Use These)

| Contract | Address | Description |
|----------|---------|-------------|
| **STAB_V3** | `0xe5fb969eec4985e8EB92334fFE11EA45035467CB` | CreatureStabilizer V3 proxy |
| **ITEM_V3** | `0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8` | ItemToken1155 V3 proxy |
| **PROXY_ADMIN_V3** | `0xD6b4087cAd41F45a06A344c193de9B0EbcE957DB` | Central ProxyAdmin (note: individual proxies have their own ProxyAdmins) |

### Supporting Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| **CATALOG_V1** | `0x06266255ee081AcA64328dE8fcc939923eE6e8c8` | ItemCatalog proxy (reused from V1) |
| **GOOBS_CONTRACT** | `0xfc9a6fbbf61fffb6d4faf170d3b5d1b275728117` | Goobs ERC-721 contract |

### Implementation Addresses (Current)

| Contract | Address | Notes |
|----------|---------|-------|
| **STAB_V3 Implementation** | `0xD1EC836fafbF6c94479c8Bcc9B8B74e0517CA031` | Upgraded with `getDailyItems()` |
| **ITEM_V3 Implementation** | Check via EIP-1967 slot | Use `cast` to read implementation slot |

## 🔧 Environment Variables Setup

### Required for All Scripts

```bash
export RPC="https://apechain.calderachain.xyz/http"
export DEPLOYER_PRIVATE_KEY=<your_private_key>
```

### V3 Contract Addresses

```bash
export STAB_V3=0xe5fb969eec4985e8EB92334fFE11EA45035467CB
export ITEM_V3=0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8
export PROXY_ADMIN_V3=0xD6b4087cAd41F45a06A344c193de9B0EbcE957DB
```

### Optional (for specific scripts)

```bash
export GOOBS_CONTRACT=0xfc9a6fbbf61fffb6d4faf170d3b5d1b275728117
export GOOB_ID=888  # or CREATURE_ID
export CATALOG_V1=0x06266255ee081AcA64328dE8fcc939923eE6e8c8
```

## 🚀 Common Commands

### Verify Contract Addresses

```bash
# Check STAB_V3 implementation
cast call $STAB_V3 "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc()(address)" --rpc-url $RPC

# Check STAB_V3 admin
cast call $STAB_V3 "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103()(address)" --rpc-url $RPC

# Check ITEM_V3 name
cast call $ITEM_V3 "name()(string)" --rpc-url $RPC
```

### Test New Functions

```bash
# Test getDailyItems() (will revert if creature not initialized - expected)
cast call $STAB_V3 "getDailyItems(uint256)(uint32,uint256[],uint256[])" 999999 --rpc-url $RPC
```

### Run Smoke Tests

```bash
# Goob-gated smoke test
forge script scripts/GoobGatedV3SmokeTest.s.sol --rpc-url $RPC --broadcast -vvvv

# Generic smoke test (no Goobs required)
forge script scripts/GenericV3SmokeTest.s.sol --rpc-url $RPC --broadcast -vvvv
```

## 📁 File Locations

### Frontend Configuration
- **Contract Addresses:** `src/config/contracts/stabilizationV3.ts`
- **React Hooks:** `src/hooks/stabilizationV3/`

### Foundry Scripts
- **Deployment:** `scripts/DeployStabilizationSystemV3.s.sol`
- **Upgrades:** 
  - `scripts/UpgradeCreatureStabilizerV3_DailyItems.s.sol`
  - `scripts/UpgradeItemToken1155V3_CollectionLabel.s.sol`
- **Testing:**
  - `scripts/GoobGatedV3SmokeTest.s.sol`
  - `scripts/GenericV3SmokeTest.s.sol`
  - `scripts/DevBypassCreatureInitV3.s.sol`

### Documentation
- **Deployment Guide:** `docs/stabilization/deploy-v3-mainnet.md`
- **Smoke Tests:** `docs/stabilization/v3-goob-smoke-test.md`
- **Legacy Info:** `docs/stabilization/legacy-collections.md`

### Deployment Records
- **Broadcast Files:** `broadcast/` directory
- Contains actual transaction hashes and deployment addresses

## 🔍 Proxy Admin Architecture

**Important:** Each V3 proxy has its **own individual ProxyAdmin**, not the central `PROXY_ADMIN_V3`.

- **STAB_V3 ProxyAdmin:** Retrieved from EIP-1967 admin slot (owned by deployer EOA)
- **ITEM_V3 ProxyAdmin:** Retrieved from EIP-1967 admin slot (owned by deployer EOA)
- **PROXY_ADMIN_V3:** Central management contract (for future governance)

To find a proxy's admin:
```bash
# EIP-1967 admin slot
cast storage $STAB_V3 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103 --rpc-url $RPC
```

## ✅ Verification Checklist

After any deployment or upgrade:

- [ ] Contract addresses match expected values
- [ ] ProxyAdmin ownership verified (deployer EOA)
- [ ] Implementation slot updated (for upgrades)
- [ ] New functions callable (e.g., `getDailyItems()`)
- [ ] Smoke tests pass
- [ ] Frontend config updated (if addresses changed)

## 🔗 Related Documents

- [Full Deployment Guide](./deploy-v3-mainnet.md) - Complete step-by-step deployment
- [Goob Smoke Test](./v3-goob-smoke-test.md) - End-to-end Goob-gated testing
- [Generic Smoke Test](./v3-generic-smoke-test.md) - Non-Goob testing
- [Legacy Collections](./legacy-collections.md) - V0/V1/V2 status

---

**Last Updated:** After `getDailyItems()` upgrade deployment
**Network:** ApeChain Mainnet (Chain ID: 33139)
**RPC:** https://apechain.calderachain.xyz/http

