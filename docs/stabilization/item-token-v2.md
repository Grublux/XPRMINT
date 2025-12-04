# ItemToken1155 V2 Deployment Guide

## Overview

ItemToken1155 V2 is a new proxy deployment that fixes the upgradeability issues present in V1. The V1 proxy has a nested ProxyAdmin architecture that makes upgrades impossible in practice. V2 uses ProxyAdminV1 directly as the admin, allowing straightforward upgrades.

**Important:** ITEM_V1 is now considered legacy and is no longer used by gameplay. All new item operations use ITEM_V2.

## Architecture

- **ITEM_V2 Proxy**: New ItemToken1155 proxy deployed with ProxyAdminV1 as admin
- **Individual ProxyAdmin**: Created by TransparentUpgradeableProxy, owned by deployer EOA (allows direct upgrades)
- **Implementation**: Uses existing ItemToken1155 V1.2 implementation (includes `externalImageBaseURI`)
- **Catalog**: Points to existing ItemCatalog V1 (no catalog changes)
- **Stabilizer**: Wired to use ITEM_V2 instead of ITEM_V1

## Deployment Steps

### 1. Deploy ItemToken1155 V2

```bash
export RPC=https://apechain.calderachain.xyz/http
export DEPLOYER_PRIVATE_KEY=<your_private_key>
export PROXY_ADMIN_V1=0xdb8047eD77099626e189316Ced0b25b46Ae0181d
export ITEM_TOKEN_IMPL_V12=0xD8ac1dc16930Ab8FE62A8e5cF43F874f32e4CA0f
export ITEM_CATALOG_PROXY_V1=<catalog_address>
export CREATURE_STABILIZER_PROXY=<stabilizer_address>

forge script scripts/DeployItemToken1155V2.s.sol \
  --rpc-url $RPC \
  --broadcast
```

After deployment, save the `ITEM_TOKEN_PROXY_V2` address from the output.

### 2. Wire CreatureStabilizer to ITEM_V2

```bash
export ITEM_TOKEN_PROXY_V2=<v2_proxy_address>

forge script scripts/SetStabilizerItemTokenV2.s.sol \
  --rpc-url $RPC \
  --broadcast
```

This updates CreatureStabilizer to use ITEM_V2 instead of ITEM_V1.

### 3. Set External Image Base URI

```bash
export EXTERNAL_IMAGE_BASE_URI="https://xprmint.com/items_full/"

forge script scripts/SetItemV2ExternalBaseURI.s.sol \
  --rpc-url $RPC \
  --broadcast
```

Replace `https://xprmint.com/items_full/` with your actual CDN/base URL for the 1024x1024 PNG images.

## Verification

### Check Collection Metadata

```bash
# Collection name and symbol
cast call $ITEM_TOKEN_PROXY_V2 "name()(string)" --rpc-url $RPC
cast call $ITEM_TOKEN_PROXY_V2 "symbol()(string)" --rpc-url $RPC

# External image base URI
cast call $ITEM_TOKEN_PROXY_V2 "externalImageBaseURI()(string)" --rpc-url $RPC
```

### Check Token Metadata

```bash
# Get token URI for item 0
cast call $ITEM_TOKEN_PROXY_V2 "uri(uint256)(string)" 0 --rpc-url $RPC
```

The returned JSON should include:
- `name`: Item name
- `description`: Item description
- `image`: HTTP URL (e.g., `https://xprmint.com/items_full/0.png`)
- `image_data`: On-chain data URI (base64-encoded PNG)
- `attributes`: Array of trait objects

### Verify CreatureStabilizer Wiring

```bash
# Check which itemToken CreatureStabilizer is using
cast call $CREATURE_STABILIZER_PROXY "itemToken()(address)" --rpc-url $RPC
```

This should return the ITEM_V2 proxy address.

## Marketplace Integration

Marketplaces (Magic Eden, OpenSea) will use the HTTP `image` field from token URIs. This field is derived from:
```
image = externalImageBaseURI + tokenId + ".png"
```

For example, if `externalImageBaseURI` is `https://xprmint.com/items_full/`, then:
- Item 0: `https://xprmint.com/items_full/0.png`
- Item 1: `https://xprmint.com/items_full/1.png`
- etc.

The `image_data` field contains the fully on-chain data URI and can be used by frontends that prefer on-chain data.

## Legacy V1 Proxy

The ITEM_V1 proxy (`0x9C4216d7B56A25b4B8a8eDdEfeBaBa389E05A01E`) remains deployed on-chain but is no longer used by CreatureStabilizer. It is considered a legacy artifact and should not be used for new operations.

## Upgrade Path

ITEM_V2 can be upgraded via ProxyAdminV1:

```bash
# Upgrade to new implementation
cast send $PROXY_ADMIN_V1 \
  "upgradeAndCall(address,address,bytes)" \
  $ITEM_TOKEN_PROXY_V2 \
  <new_implementation_address> \
  0x \
  --rpc-url $RPC \
  --private-key $DEPLOYER_PRIVATE_KEY
```

Note: The individual ProxyAdmin created by TransparentUpgradeableProxy is owned by the deployer EOA, allowing direct upgrades without going through ProxyAdminV1.




