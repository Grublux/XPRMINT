import type { Address } from 'viem';

// ============================================================
// ACTIVE CONTRACT ADDRESSES (ApeChain)
// ============================================================

// V4/V5 Proxy addresses (currently in use)
export const CRAFTED_V4_POSITIONS_PROXY: Address = "0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E";
export const MASTER_CRAFTER_V4_PROXY: Address = "0xB461b4c9ff5F14fd8CEcF48600B9E95905199a29"; // Proxy upgraded to V5 impl: 0xaf1d8ceccd43e49f9a04a385c024b470aae70806
export const NPC_STATS_PROXY: Address = "0xbdB9A478e86A1e94e28e2e232957460bAa6C7c3E";

// ============================================================
// DEPRECATED - DO NOT USE (kept for reference only)
// ============================================================
/** @deprecated Use MASTER_CRAFTER_V4_PROXY instead - this is the old V1/V2 address */
export const MASTER_CRAFTER_ADDRESS: Address = "0xdBC5f2c9008B30b1Fc6680ad2dA4a1FA91323d41";
/** @deprecated Use CRAFTED_V4_POSITIONS_PROXY instead - this is the old V1 address */
export const POSITIONS_ADDRESS: Address = "0x869e4c33FD375F6d1bD899D35cE11fF370fC396b";

