"use client";

import { RealForgeView } from "./RealForgeView";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useNGTBalance } from "./hooks/useNGTBalance";
import { useCoinBalance } from "./hooks/useCoinBalance";
import { useNPCTokens } from "./hooks/useNPCTokens";
import type { NPCToken } from "./hooks/useNPCTokens";

export default function ForgeApp() {
  // Wire up RealForgeView with wagmi hooks
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { displayBalance: ngtBalance, isLoading: ngtLoading } = useNGTBalance();
  const { balance: coinBalance, isLoading: coinBalanceLoading } = useCoinBalance();
  const { tokens: npcTokens, isLoading: npcLoading, progress: npcProgress, scan: scanNPCs } = useNPCTokens();

  const handleConnect = () => {
    if (connectors[0]) {
      connect({ connector: connectors[0] });
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  // Map NPC tokens to RealForgeView format
  const npcTokensFormatted: NPCToken[] = npcTokens.map((token) => ({
    tokenId: typeof token.tokenId === 'bigint' ? token.tokenId : BigInt(token.tokenId),
    name: token.name,
    imageUrl: token.imageUrl,
  }));

  return (
    <RealForgeView
      address={address}
      isConnected={isConnected}
      onConnectClick={handleConnect}
      onDisconnectClick={handleDisconnect}
      ngtDisplayBalance={ngtBalance}
      ngtIsLoading={ngtLoading}
      coinBalance={coinBalance}
      coinBalanceLoading={coinBalanceLoading}
      forgeXP={0}
      forgeXPLoading={false}
      npcTokens={npcTokensFormatted}
      npcLoading={npcLoading}
      npcProgress={npcProgress}
      onScanNPCsClick={scanNPCs}
    />
  );
}
