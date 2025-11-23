import type { Address } from 'viem';
// Import ABIs from Foundry artifacts
// @ts-ignore - Foundry JSON artifacts
import stabArtifact from '../../../out/CreatureStabilizer.sol/CreatureStabilizer.json';
// @ts-ignore - Foundry JSON artifacts
import itemArtifact from '../../../out/ItemToken1155.sol/ItemToken1155.json';

export const STAB_V3_ADDRESS: Address = '0xe5fb969eec4985e8EB92334fFE11EA45035467CB';
export const ITEM_V3_ADDRESS: Address = '0x64dd1CB8A77fB55d4838897FD6F60e28B2e8fEd8';

export const creatureStabilizerV3Abi = stabArtifact.abi;
export const itemToken1155V3Abi = itemArtifact.abi;

// Minimal mirror of the on-chain CreatureState struct for typing.
export type CreatureState = {
  vibes: number;                // uint8
  lockedCount: number;          // uint8
  targetSal: number;            // uint16
  targetPH: number;             // uint16
  targetTemp: number;            // uint16
  targetFreq: number;            // uint16
  currSal: number;               // uint16
  currPH: number;                // uint16
  currTemp: number;              // uint16
  currFreq: number;              // uint16
  lockedSal: boolean;
  lockedPH: boolean;
  lockedTemp: boolean;
  lockedFreq: boolean;
  stabilizedAt: bigint;         // uint40
  consecutiveVibeMax: number;   // uint16
  enhancedDrip: boolean;
  bondedSP: number;             // uint16
};

