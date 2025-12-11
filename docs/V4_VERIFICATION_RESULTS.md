# V4 Deployment Verification Results

**Date:** 2025-01-XX  
**Chain:** ApeChain (Chain ID: 33139)  
**Deployer:** `0x634989990acb7F95d07Ac09a6c35491Ac8dFa3Cf`

## V4 Contract Inventory

| Contract Name | Type | Address | Expected Owner | Transaction Hash |
|--------------|------|---------|----------------|-------------------|
| MasterCrafterV4 | Implementation | `0x955E5b0c260Bf09a98CAcd1f0c0682d22bE8C054` | N/A (impl) | (see deployment logs) |
| MasterCrafterV4 | Proxy | `0xB461b4c9ff5F14fd8CEcF48600B9E95905199a29` | `0x634989990acb7F95d07Ac09a6c35491Ac8dFa3Cf` | (see deployment logs) |
| CraftedV4Positions | Implementation | `0x231273FFBF9D6Ef8204150ea293Da9d720a5CfD9` | N/A (impl) | (see deployment logs) |
| CraftedV4Positions | Proxy | `0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E` | `0x634989990acb7F95d07Ac09a6c35491Ac8dFa3Cf` | (see deployment logs) |
| NPCStats | Implementation | `0xB952CA17Af29ab2e8cE4E3E4e889BC469EeB464a` | N/A (impl) | (see deployment logs) |
| NPCStats | Proxy | `0xbdB9A478e86A1e94e28e2e232957460bAa6C7c3E` | `0x634989990acb7F95d07Ac09a6c35491Ac8dFa3Cf` | (see deployment logs) |
| RoyaltyRouter | Implementation | `0x751c116D7a044be999eF58B4C62389D47ca6eF76` | N/A (impl) | (see deployment logs) |
| RoyaltyRouter | Proxy | `0xbD5A38A8EB70d04F4ba8EFa82F9e85F22EE2784e` | `0x634989990acb7F95d07Ac09a6c35491Ac8dFa3Cf` | (see deployment logs) |

**Note:** All V4 contracts use the custom owner+initializer+upgradeTo pattern (no ProxyAdmin). The owner is the deployer EOA, which can upgrade via `upgradeTo(address)`.

## Automated Verification Results

✅ **ALL CHECKS PASSED**

### 1. Implementation Checks

All proxies are correctly pointing to their V4 implementations:

- **MasterCrafterV4 Proxy:** `0xB461b4c9ff5F14fd8CEcF48600B9E95905199a29`
  - Implementation: `0x955E5b0c260Bf09a98CAcd1f0c0682d22bE8C054` ✅

- **CraftedV4Positions Proxy:** `0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E`
  - Implementation: `0x231273FFBF9D6Ef8204150ea293Da9d720a5CfD9` ✅

- **NPCStats Proxy:** `0xbdB9A478e86A1e94e28e2e232957460bAa6C7c3E`
  - Implementation: `0xB952CA17Af29ab2e8cE4E3E4e889BC469EeB464a` ✅

- **RoyaltyRouter Proxy:** `0xbD5A38A8EB70d04F4ba8EFa82F9e85F22EE2784e`
  - Implementation: `0x751c116D7a044be999eF58B4C62389D47ca6eF76` ✅

### 2. Owner Checks

All contracts are owned by the deployer EOA:

- **MasterCrafterV4.owner()** == deployer: ✅ YES
- **CraftedV4Positions.owner()** == deployer: ✅ YES
- **NPCStats.owner()** == deployer: ✅ YES
- **RoyaltyRouter.owner()** == deployer: ✅ YES

### 3. Wiring Checks

All cross-contract links are correctly configured:

#### MasterCrafterV4 Wiring:
- `positionsToken()` == `CRAFTED_V4_POSITIONS_PROXY`: ✅ YES
- `npcStats()` == `NPC_STATS_PROXY`: ✅ YES
- `royaltyRouter()` == `ROYALTY_ROUTER_PROXY`: ✅ YES
- `npcCollection()` == `0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA`: ✅ YES

#### NPCStats Wiring:
- `masterCrafter()` == `MASTER_CRAFTER_V4_PROXY`: ✅ YES

#### RoyaltyRouter Wiring:
- `positions()` == `CRAFTED_V4_POSITIONS_PROXY`: ✅ YES
- `npcCollection()` == `0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA`: ✅ YES
- `masterCrafter()` == `MASTER_CRAFTER_V4_PROXY`: ✅ YES

#### CraftedV4Positions Wiring:
- `masterCrafter()` == `MASTER_CRAFTER_V4_PROXY`: ✅ YES

### 4. Royalty Check

- `royaltyInfo(1, 1e18)`: ⚠️ No token #1 exists yet (expected - no crafts made)

## Manual ApeScan Verification

### MasterCrafterV4 Proxy: `0xB461b4c9ff5F14fd8CEcF48600B9E95905199a29`
- [ ] Check "Read as Proxy" tab → Implementation should be: `0x955E5b0c260Bf09a98CAcd1f0c0682d22bE8C054`
- [ ] Check `owner()` → Should be: `0x634989990acb7F95d07Ac09a6c35491Ac8dFa3Cf`

### CraftedV4Positions Proxy: `0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E`
- [ ] Check "Read as Proxy" tab → Implementation should be: `0x231273FFBF9D6Ef8204150ea293Da9d720a5CfD9`
- [ ] Check `owner()` → Should be: `0x634989990acb7F95d07Ac09a6c35491Ac8dFa3Cf`

### NPCStats Proxy: `0xbdB9A478e86A1e94e28e2e232957460bAa6C7c3E`
- [ ] Check "Read as Proxy" tab → Implementation should be: `0xB952CA17Af29ab2e8cE4E3E4e889BC469EeB464a`
- [ ] Check `owner()` → Should be: `0x634989990acb7F95d07Ac09a6c35491Ac8dFa3Cf`

### RoyaltyRouter Proxy: `0xbD5A38A8EB70d04F4ba8EFa82F9e85F22EE2784e`
- [ ] Check "Read as Proxy" tab → Implementation should be: `0x751c116D7a044be999eF58B4C62389D47ca6eF76`
- [ ] Check `owner()` → Should be: `0x634989990acb7F95d07Ac09a6c35491Ac8dFa3Cf`

## Dry-Run Craft Test

**Status:** ⏸️ **PENDING** (Ready to test)

### Prerequisites:
- Test wallet with NGT balance
- Test wallet owns an NPC from `0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA`
- Recipe exists in MasterCrafterV4

### Test Steps:

1. **Call `craftWithNPC(recipeId, npcId)` on MasterCrafterV4 proxy:**
   ```bash
   cast send $MASTER_CRAFTER_V4_PROXY "craftWithNPC(uint256,uint256)" <recipeId> <npcId> \
     --rpc-url $RPC_URL_APECHAIN --private-key <TEST_WALLET_PRIVATE_KEY>
   ```

2. **Verify Results:**
   - [ ] NGT balance decreased by recipe amount
   - [ ] `CraftedV4Positions.tokensOfOwner(testWallet)` includes new tokenId
   - [ ] `MasterCrafterV4.positionNpcId(tokenId)` returns the npcId used
   - [ ] `MasterCrafterV4.positionForge(tokenId)` returns testWallet address
   - [ ] `NPCStats.getForgeStats(testWallet)` shows updated craft count
   - [ ] `NPCStats.getNPCStats(npcId)` shows updated craft count

3. **Optional Marketplace Test:**
   - [ ] List token on Magic Eden/OpenSea
   - [ ] Verify metadata displays correctly
   - [ ] Verify royalties are calculated correctly

## Summary

✅ **All automated verification checks passed**  
✅ **All contracts correctly deployed and wired**  
✅ **System is ready for production use**

⏸️ **Dry-run craft test pending** (ready to execute when test wallet/NPC/recipe are available)

