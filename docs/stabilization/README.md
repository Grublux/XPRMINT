# Stabilization System Documentation

This directory contains documentation for the NMGI Stabilization System deployed on ApeChain.

## Current Version: V3

**All new deployments and gameplay MUST use V3 contracts.**

- [V3 Deployment Guide](./deploy-v3-mainnet.md) - Complete V3 deployment instructions
- [Smoke Test Guide](./smoke-test-mainnet.md) - On-chain verification and testing

## Legacy Versions (DO NOT USE)

**V0/V1/V2 contracts are legacy and MUST NOT be used for new gameplay.**

- V0: Initial deployment (legacy)
- V1: Single ProxyAdminV1 with nested ProxyAdmin issues (legacy)
- V2: Per-proxy ProxyAdmins (legacy)

See [Legacy Collections Guide](./legacy-collections.md) for details on V0/V1/V2 and why only V3 is canonical.

## Key Documents

- [Stabilization Spec](../../stabilization-spec.md) - Core game mechanics and rules
- [Developer Guide](../../DEVELOPER_GUIDE.md) - Technical implementation details
- [Player Journeys](../../stabilization-player-journeys.md) - User experience flows

## V3 Architecture

- **Single ProxyAdminV3**: Owned by deployer EOA, serves as central management
- **ITEM_V3**: ItemToken1155 proxy with externalImageBaseURI support
- **STAB_V3**: CreatureStabilizer proxy with setItemToken support
- **CATALOG_V1**: Reused from V1 (no changes needed)
- **Images**: Reused from V1 (SSTORE2 on-chain storage)

All V3 proxies use individual ProxyAdmins owned by deployer EOA, enabling direct upgrades without nested contract ownership issues.
