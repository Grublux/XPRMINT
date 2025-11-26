import { useAccount, useReadContract } from "wagmi";

import { STAB_V3_ADDRESS, creatureStabilizerV3Abi } from "../../config/contracts/stabilizationV3";

/**
 * Read the V3 testing whitelist status for the connected wallet.
 *
 * - whitelistEnabled: global flag on the contract
 * - isTester: whether this address is in the tester mapping OR is the contract owner
 * - isReadOnly: derived flag (enabled && !tester && !owner)
 * 
 * Note: The contract owner (dev wallet) automatically gets full access,
 * matching the contract-level permissions where owner bypasses whitelist checks.
 */
export function useWhitelistStatus() {
  const { address } = useAccount();

  const { data: whitelistEnabledRaw } = useReadContract({
    address: STAB_V3_ADDRESS,
    abi: creatureStabilizerV3Abi,
    functionName: "isWhitelistEnabled",
    args: [],
  });

  const whitelistEnabled = Boolean(whitelistEnabledRaw);

  // Hardcoded whitelist addresses that get owner privileges (Simulation button access)
  const HARDCODED_OWNER_ADDRESSES = [
    '0xa7bbc89ffa1992199671c5a8511d4ebcf53033ad'.toLowerCase(),
  ];

  // Check if connected address is the contract owner
  const { data: ownerAddress } = useReadContract({
    address: STAB_V3_ADDRESS,
    abi: creatureStabilizerV3Abi,
    functionName: "owner",
    args: [],
  });

  const isContractOwner = address && ownerAddress && 
    address.toLowerCase() === (ownerAddress as string).toLowerCase();
  
  // Check if address is in hardcoded owner list
  const isHardcodedOwner = address && HARDCODED_OWNER_ADDRESSES.includes(address.toLowerCase());
  
  const isOwner = isContractOwner || isHardcodedOwner;

  const { data: isTesterRaw } = useReadContract({
    address: STAB_V3_ADDRESS,
    abi: creatureStabilizerV3Abi,
    functionName: "isTester",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !isOwner, // Skip if already owner
    },
  });

  // Owner gets full access (same as tester for UI purposes)
  // Hardcoded owners also get tester access
  const isTester = Boolean(isTesterRaw) || Boolean(isOwner);
  const isReadOnly = whitelistEnabled && !isTester;

  return {
    whitelistEnabled,
    isTester,
    isReadOnly,
    isOwner: Boolean(isOwner),
    isContractOwner: Boolean(isContractOwner), // Only the deployer wallet
  };
}

