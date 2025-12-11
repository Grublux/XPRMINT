# Active Contract Addresses (ApeChain)

**Last Updated:** 2025-01-10  
**Network:** ApeChain (Chain ID: 33139)

## Active Proxy Addresses (Currently in Use)

### MasterCrafter
- **Proxy:** `0xB461b4c9ff5F14fd8CEcF48600B9E95905199a29`
- **Implementation:** `0xaf1d8ceccd43e49f9a04a385c024b470aae70806` (MasterCrafterV5)
- **Status:** ✅ Active - Proxy upgraded to V5
- **Used in:**
  - `web/src/features/forge/hooks/useRecipe.ts` - Recipe fetching
  - `web/src/features/forge/RealForgeView.tsx` - Crafting transactions
  - `web/src/features/forge/components/BagModal.tsx` - Destroy quotes and transactions
  - `web/src/features/forge/hooks/useCoinTokens.ts` - Position data fetching

### CraftedV4Positions
- **Proxy:** `0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E`
- **Status:** ✅ Active
- **Used in:**
  - `web/src/features/forge/hooks/useCoinBalance.ts` - Coin balance queries
  - `web/src/features/forge/hooks/useCoinTokens.ts` - Token enumeration

### NPCStats
- **Proxy:** `0xbdB9A478e86A1e94e28e2e232957460bAa6C7c3E`
- **Status:** ✅ Active
- **Used in:**
  - `web/src/features/forge/hooks/useNPCXP.ts` - NPC statistics

### Other Active Contracts

#### NGT Token (ERC20)
- **Address:** `0x72CddB64A72176B442bdfD9C8Bb7968E652d8D1a`
- **Used in:** `web/src/config/contracts/forging.ts`

#### NPC Collection (ERC721)
- **Address:** `0xfa1c20e0d4277b1E0b289DfFadb5Bd92Fb8486aA`
- **Used in:** `web/src/config/contracts/forging.ts`

## Deprecated Addresses (DO NOT USE)

### Old MasterCrafter V1/V2
- **Address:** `0xdBC5f2c9008B30b1Fc6680ad2dA4a1FA91323d41`
- **Status:** ❌ Deprecated - Use `MASTER_CRAFTER_V4_PROXY` instead

### Old CraftedV1Positions
- **Address:** `0x869e4c33FD375F6d1bD899D35cE11fF370fC396b`
- **Status:** ❌ Deprecated - Use `CRAFTED_V4_POSITIONS_PROXY` instead

## Verification

All active contract calls in the frontend have been verified to use the correct V4/V5 proxy addresses. No references to old V1/V2 contracts remain in active code.

### Files Using Active Addresses:
- ✅ `web/src/features/forge/hooks/useRecipe.ts` → `MASTER_CRAFTER_V4_PROXY`
- ✅ `web/src/features/forge/RealForgeView.tsx` → `MASTER_CRAFTER_V4_PROXY`
- ✅ `web/src/features/forge/components/BagModal.tsx` → `MASTER_CRAFTER_V4_PROXY`
- ✅ `web/src/features/forge/hooks/useCoinBalance.ts` → `CRAFTED_V4_POSITIONS_PROXY`
- ✅ `web/src/features/forge/hooks/useCoinTokens.ts` → `CRAFTED_V4_POSITIONS_PROXY`, `MASTER_CRAFTER_V4_PROXY`
- ✅ `web/src/features/forge/hooks/useNPCXP.ts` → `NPC_STATS_PROXY`

### No Conflicting Calls Found:
- ❌ No references to `MASTER_CRAFTER_ADDRESS` (old V1/V2) in active code
- ❌ No references to `POSITIONS_ADDRESS` (old V1) in active code
- ❌ No references to MasterCrafterV1, V2, or V3 in active code

