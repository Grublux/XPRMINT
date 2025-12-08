import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { NGT_TOKEN_ADDRESS, erc20Abi } from '@/config/contracts/forging';

export function useNGTBalance(addressOverride?: `0x${string}`) {
  const { address } = useAccount();
  const target = addressOverride ?? address;

  const { data: balanceData, isLoading: balanceLoading, isError, error, refetch } = useReadContract({
    address: NGT_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: target ? [target] : undefined,
    query: {
      enabled: !!target,
    },
  });

  const { data: decimalsData } = useReadContract({
    address: NGT_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: 'decimals',
    query: {
      enabled: true,
    },
  });

  const decimals = decimalsData ?? 18;
  const rawBalance = balanceData ?? 0n;
  const formattedBalance = formatUnits(rawBalance, decimals);
  
  // Format with commas and 2 decimal places
  const displayBalance = Number(formattedBalance).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return {
    balance: rawBalance,
    displayBalance,
    isLoading: balanceLoading,
    isError,
    error,
    refetch,
    isPlaceholder: false,
  };
}

