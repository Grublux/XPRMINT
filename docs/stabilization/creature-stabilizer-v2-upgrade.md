# CreatureStabilizer V2 Upgrade Guide

## Problem

CreatureStabilizer proxy has the same nested ProxyAdmin architecture issue as ITEM_V1:
- Individual ProxyAdmin: `0xB9e49A0b1bA1e386E9b7Fb65aFBE240191D76feD`
- Individual ProxyAdmin Owner: `ProxyAdminV1` (contract address `0xdb8047eD77099626e189316Ced0b25b46Ae0181d`)
- ProxyAdminV1 Owner: Deployer EOA

Since ProxyAdminV1 is a contract (not a multi-sig), it cannot sign transactions to upgrade the CreatureStabilizer proxy.

## Solution Options

### Option 1: Manual Upgrade via Multi-Sig (if ProxyAdminV1 is a multi-sig)

If ProxyAdminV1 is actually a multi-sig wallet, submit these transactions through the multi-sig interface:

```bash
# Step 1: Transfer ownership of individual ProxyAdmin to deployer
cast send 0xB9e49A0b1bA1e386E9b7Fb65aFBE240191D76feD \
  "transferOwnership(address)" \
  0x634989990acb7F95d07Ac09a6c35491Ac8dFa3Cf \
  --rpc-url $RPC \
  --private-key $PROXY_ADMIN_V1_MULTISIG_KEY

# Step 2: Upgrade CreatureStabilizer proxy
cast send 0xB9e49A0b1bA1e386E9b7Fb65aFBE240191D76feD \
  "upgradeAndCall(address,address,bytes)" \
  0xBb2047350B7bA71fC00c8F9f3F100F5D94Ea8F99 \
  0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8 \
  0x \
  --rpc-url $RPC \
  --private-key $DEPLOYER_PRIVATE_KEY

# Step 3: Wire CreatureStabilizer to ITEM_V2
cast send 0xBb2047350B7bA71fC00c8F9f3F100F5D94Ea8F99 \
  "setItemToken(address)" \
  0xD6b4087cAd41F45a06A344c193de9B0EbcE957DB \
  --rpc-url $RPC \
  --private-key $DEPLOYER_PRIVATE_KEY

# Step 4: Transfer ownership back to ProxyAdminV1
cast send 0xB9e49A0b1bA1e386E9b7Fb65aFBE240191D76feD \
  "transferOwnership(address)" \
  0xdb8047eD77099626e189316Ced0b25b46Ae0181d \
  --rpc-url $RPC \
  --private-key $DEPLOYER_PRIVATE_KEY
```

### Option 2: Deploy New CreatureStabilizer V2 Proxy

Deploy a new CreatureStabilizer proxy with deployer EOA as `initialOwner` (same architecture as ITEM_V2):

1. Deploy new CreatureStabilizer implementation (already done: `0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8`)
2. Deploy new CreatureStabilizer V2 proxy with deployer as `initialOwner`
3. Initialize with same parameters as V1 (itemToken=ITEM_V2, catalog, daySeconds, entropySeed)
4. **Note:** This requires migrating all existing creature state, which may not be feasible

### Option 3: Accept Current Architecture

Keep CreatureStabilizer using ITEM_V1 for now. ITEM_V2 is deployed and ready, but CreatureStabilizer will continue using ITEM_V1 until the upgrade is completed.

## Current Status

- ✅ ITEM_V2 proxy deployed: `0xD6b4087cAd41F45a06A344c193de9B0EbcE957DB`
- ✅ ITEM_V2 externalImageBaseURI set: `https://xprmint.com/items_full/`
- ⏸️ CreatureStabilizer upgrade: Blocked by nested ProxyAdmin architecture
- ⏸️ CreatureStabilizer → ITEM_V2 wiring: Requires CreatureStabilizer upgrade first

## Verification

After upgrading CreatureStabilizer and wiring to ITEM_V2:

```bash
# Check CreatureStabilizer is using ITEM_V2
cast call 0xBb2047350B7bA71fC00c8F9f3F100F5D94Ea8F99 \
  "itemToken()(address)" \
  --rpc-url $RPC

# Should return: 0xD6b4087cAd41F45a06A344c193de9B0EbcE957DB
```



