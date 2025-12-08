"use client";

import { RealForgeView, type NPCToken } from "@/features/forge/RealForgeView";

export default function LegacyForgeRoot() {
  // Stubbed data for now. This gets replaced with real wagmi-powered data later.
  const address = null;
  const isConnected = false;
  const ngtDisplayBalance = "0.00";
  const ngtIsLoading = false;
  const ngtIsPlaceholder = true;

  const coinBalance = 0;
  const coinBalanceLoading = false;

  const forgeXP = 0;
  const forgeXPLoading = false;

  const npcTokens: NPCToken[] = [];
  const npcLoading = false;
  const npcProgress: number | string | undefined = "NPC scan idle (stub)";

  return (
    <RealForgeView
      address={address ?? undefined}
      isConnected={isConnected}
      onConnectClick={() => {
        console.log("Connect clicked (stub)");
      }}
      ngtDisplayBalance={ngtDisplayBalance}
      ngtIsLoading={ngtIsLoading}
      ngtIsPlaceholder={ngtIsPlaceholder}
      coinBalance={coinBalance}
      coinBalanceLoading={coinBalanceLoading}
      forgeXP={forgeXP}
      forgeXPLoading={forgeXPLoading}
      npcTokens={npcTokens}
      npcLoading={npcLoading}
      npcProgress={npcProgress}
      onScanNPCsClick={() => {
        console.log("Scan NPCs clicked (stub)");
      }}
    />
  );
}
