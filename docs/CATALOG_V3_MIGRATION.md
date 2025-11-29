# CATALOG_V3 Migration Guide

## Overview

CATALOG_V3 is a new ItemCatalog proxy deployed under PROXY_ADMIN_V3 (owned by the deployer). It replaces CATALOG_V1 as the authoritative catalog for V3/V4 behavior and metadata.

**Important:** CATALOG_V1 is now considered legacy and is no longer used by V3 systems. It remains on-chain as a read-only reference but cannot be upgraded due to ProxyAdmin ownership constraints.

## Key Differences

### CATALOG_V1 (Legacy)
- **Address:** `0x06266255ee081AcA64328dE8fcc939923eE6e8c8`
- **Admin:** Individual ProxyAdmin (not controlled by deployer)
- **Status:** Read-only, immutable
- **Usage:** Historical reference only

### CATALOG_V3 (Active)
- **Address:** Deployed via `DeployCatalogV3.s.sol`
- **Admin:** PROXY_ADMIN_V3 (owned by deployer)
- **Status:** Active, upgradeable
- **Usage:** Authoritative catalog for ITEM_V3 and STAB_V3

## Secondary Trait Matrix

CATALOG_V3 uses an updated secondary trait mapping that ensures all four traits (Salinity, pH, Temperature, Frequency) can be affected as secondary traits:

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

## Migration Steps

1. **Deploy CATALOG_V3**
   ```bash
   forge script scripts/DeployCatalogV3.s.sol --rpc-url $RPC --broadcast
   ```

2. **Seed CATALOG_V3 from CATALOG_V1**
   ```bash
   export CATALOG_V3=<deployed_address>
   forge script scripts/SeedCatalogV3FromV1.s.sol --rpc-url $RPC --broadcast
   ```

3. **Verify Templates**
   ```bash
   forge script scripts/VerifyCatalogV3Templates.s.sol --rpc-url $RPC
   ```

4. **Upgrade ITEM_V3 to add setCatalog()**
   ```bash
   forge script scripts/UpgradeItemTokenV3_SetCatalog.s.sol --rpc-url $RPC --broadcast
   ```

5. **Upgrade STAB_V3 to add setCatalog()**
   ```bash
   forge script scripts/UpgradeStabilizerV3_SetCatalog.s.sol --rpc-url $RPC --broadcast
   ```

6. **Wire contracts to CATALOG_V3**
   ```bash
   forge script scripts/WireCatalogV3.s.sol --rpc-url $RPC --broadcast
   ```

7. **Verify Wiring**
   ```bash
   forge script scripts/VerifyCatalogV3Wiring.s.sol --rpc-url $RPC
   ```

## Impact

### Token Collection
- **No changes** to ItemToken1155 V3 collection address
- **No changes** to token IDs or balances
- **No token migrations** required

### Metadata
- Item names, descriptions, and images remain unchanged
- Secondary trait fields in metadata reflect the new matrix
- All items sharing a template ID see the same behavior

### Gameplay
- Secondary trait effects now follow the new matrix
- All four traits can be affected as secondary traits
- Epic items remain unchanged (no secondary effects)

## Verification

After migration, verify:
- ITEM_V3.itemCatalog() == CATALOG_V3
- STAB_V3.itemCatalog() == CATALOG_V3
- CATALOG_V3.templateCount() == 64
- Template secondary traits match the new matrix
- Token metadata reflects updated secondary traits

## Rollback

If needed, contracts can be rolled back to CATALOG_V1 by calling:
- `ITEM_V3.setCatalog(CATALOG_V1)`
- `STAB_V3.setCatalog(CATALOG_V1)`

However, this is not recommended as CATALOG_V1 uses the old secondary trait matrix.

## Related Documents

- [V3 Quick Reference](./stabilization/v3-quick-reference.md)
- [V3 Deployment Guide](./stabilization/deploy-v3-mainnet.md)

