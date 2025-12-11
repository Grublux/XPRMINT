import { useReadContract } from 'wagmi';
import type { Address } from 'viem';
import { MASTER_CRAFTER_V4_PROXY } from '@/features/crafted/constants';

const MASTER_CRAFTER_ABI = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getRecipe',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [
      {
        components: [
          { name: 'active', type: 'bool' },
          { name: 'inputPerUnit', type: 'uint256' },
          { name: 'coalPerUnit', type: 'uint256' },
          { name: 'lockDuration', type: 'uint256' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'maxBatchSize',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export type Recipe = {
  active: boolean;
  inputPerUnit: bigint;
  coalPerUnit: bigint;
  lockDuration: bigint;
};

export function useRecipe(recipeId: number = 1) {
  const { data: recipeData, isLoading, isError, error } = useReadContract({
    address: MASTER_CRAFTER_V4_PROXY,
    abi: MASTER_CRAFTER_ABI,
    functionName: 'getRecipe',
    args: [BigInt(recipeId)],
    query: {
      enabled: recipeId > 0,
    },
  });

  const { data: maxBatchSize } = useReadContract({
    address: MASTER_CRAFTER_V4_PROXY,
    abi: MASTER_CRAFTER_ABI,
    functionName: 'maxBatchSize',
  });

  // Parse recipe data - handle both array and object formats
  const recipe: Recipe | null = recipeData
    ? (() => {
        // Handle array format [active, inputPerUnit, coalPerUnit, lockDuration]
        if (Array.isArray(recipeData)) {
          return {
            active: recipeData[0],
            inputPerUnit: recipeData[1],
            coalPerUnit: recipeData[2],
            lockDuration: recipeData[3],
          };
        }
        // Handle object format { active, inputPerUnit, coalPerUnit, lockDuration }
        const data = recipeData as any;
        return {
          active: Boolean(data.active),
          inputPerUnit: typeof data.inputPerUnit === 'bigint' 
            ? data.inputPerUnit 
            : BigInt(String(data.inputPerUnit || '0')),
          coalPerUnit: typeof data.coalPerUnit === 'bigint'
            ? data.coalPerUnit
            : BigInt(String(data.coalPerUnit || '0')),
          lockDuration: typeof data.lockDuration === 'bigint'
            ? data.lockDuration
            : BigInt(String(data.lockDuration || '0')),
        };
      })()
    : null;

  return {
    recipe,
    maxCoins: maxBatchSize ? Number(maxBatchSize) : 10, // Default to 10 if not available
    isLoading,
    isError,
    error,
  };
}

