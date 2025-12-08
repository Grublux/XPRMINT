"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { RealForgeView, type NPCToken } from "@/features/forge/RealForgeView";
import { useNGTBalance } from "@/features/forge/hooks/useNGTBalance";
import { useNPCTokens } from "@/features/forge/hooks/useNPCTokens";
import { useCoinBalance } from "@/features/forge/hooks/useCoinBalance";

export default function LegacyForgeRoot() {
  // Wallet connection wiring
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect, isPending: isDisconnecting } = useDisconnect();

  const connectIsBusy = isConnecting || isDisconnecting;

  const handleConnectClick = () => {
    if (isConnected) {
      disconnect();
    } else {
      const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
      if (injected) {
        connect({ connector: injected });
      }
    }
  };

  // NGT balance wiring
  const { displayBalance: ngtDisplayBalance, isLoading: ngtIsLoading } = useNGTBalance();
  const ngtIsPlaceholder = !isConnected || ngtIsLoading;

  // Coin balance wiring
  const { balance: coinBalance, isLoading: coinBalanceLoading } = useCoinBalance();

  // NPC tokens wiring
  const {
    tokens: npcTokensRaw,
    isLoading: npcLoading,
    progress: npcProgressRaw,
    scan: scanNPCs,
  } = useNPCTokens();

  // Map NPC tokens to RealForgeView format
  const npcTokens: NPCToken[] = npcTokensRaw.map((token) => ({
    tokenId: typeof token.tokenId === 'bigint' ? token.tokenId : BigInt(token.tokenId),
    name: token.name,
    imageUrl: token.imageUrl,
  }));

  // Map progress to string format
  const npcProgress: number | string | undefined = npcProgressRaw.stage === 'idle'
    ? "NPC scan idle"
    : npcProgressRaw.stage === 'scanning'
    ? `Scanning... ${npcProgressRaw.progress}%`
    : npcProgressRaw.stage === 'metadata'
    ? `Loading metadata... ${npcProgressRaw.progress}%`
    : npcProgressRaw.stage === 'complete'
    ? npcProgressRaw.message
    : npcProgressRaw.stage === 'error'
    ? `Error: ${npcProgressRaw.message}`
    : npcProgressRaw.message;

  // Forge XP - address/forge-bound (not NPC-bound)
  // For now, set to 0 until we have a hook for it
  const forgeXP = 0;
  const forgeXPLoading = false;

  return (
    <RealForgeView
      address={address ?? undefined}
      isConnected={isConnected ?? false}
      onConnectClick={handleConnectClick}
      ngtDisplayBalance={ngtIsLoading ? "Loading..." : ngtDisplayBalance}
      ngtIsLoading={ngtIsLoading}
      ngtIsPlaceholder={ngtIsPlaceholder}
      coinBalance={coinBalance}
      coinBalanceLoading={coinBalanceLoading}
      forgeXP={forgeXP}
      forgeXPLoading={forgeXPLoading}
      npcTokens={npcTokens}
      npcLoading={npcLoading}
      npcProgress={npcProgress}
      onScanNPCsClick={scanNPCs}
    />
  );
}
