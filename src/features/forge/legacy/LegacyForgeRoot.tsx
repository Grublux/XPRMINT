"use client";

import { useEffect, useRef } from "react";
import { useAccount, useConnect, useDisconnect, useConnectorClient } from "wagmi";
import { RealForgeView } from "@/features/forge/RealForgeView";
import type { NPCToken } from "@/features/forge/hooks/useNPCTokens";
import { useNGTBalance } from "@/features/forge/hooks/useNGTBalance";
import { useNPCTokens } from "@/features/forge/hooks/useNPCTokens";
import { useCoinBalance } from "@/features/forge/hooks/useCoinBalance";

export default function LegacyForgeRoot() {
  // Wallet connection wiring
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting, error: connectError, reset: resetConnect } = useConnect();
  const { disconnect, isPending: isDisconnecting } = useDisconnect();
  const { data: connectorClient } = useConnectorClient();
  
  // Track if we just disconnected to force reset on next connect attempt
  const justDisconnectedRef = useRef(false);

  // Reset connect state immediately after disconnect completes
  useEffect(() => {
    if (!isDisconnecting && !isConnected) {
      // If we just disconnected, mark it and reset immediately
      if (justDisconnectedRef.current) {
        console.log("Disconnect completed, resetting connect state immediately");
        resetConnect();
        justDisconnectedRef.current = false;
      }
    }
  }, [isDisconnecting, isConnected, resetConnect]);

  const handleConnectClick = async () => {
    console.log("handleConnectClick called", { 
      isConnected, 
      isDisconnecting, 
      isConnecting, 
      connectorsCount: connectors.length, 
      connectError: connectError?.message,
      hasConnectorClient: !!connectorClient
    });
    
    if (isConnected) {
      justDisconnectedRef.current = true;
      disconnect();
    } else {
      // Don't attempt to connect while disconnecting
      if (isDisconnecting) {
        console.log("Still disconnecting, waiting...");
        return;
      }
      
      // If there's a stale connector client, disconnect it first
      if (connectorClient) {
        console.log("Found stale connector client, disconnecting first");
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (connectorClient as any).disconnect();
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err) {
          console.log("Error disconnecting stale client:", err);
        }
      }
      
      // ALWAYS reset before connecting to clear any stale state
      console.log("Resetting connect state before connecting");
      resetConnect();
      // Wait for reset to complete
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Find injected connector (MetaMask, browser wallets)
      const injected = connectors.find((c) => c.id === "injected");
      if (injected) {
        console.log("Connecting with injected connector:", injected.id);
        
        // Force a fresh connection by checking if we need to manually trigger
        // Sometimes wagmi needs the provider to be re-initialized
        try {
          const result = connect({ connector: injected });
          console.log("Connect call result:", result);
          
          // If connect doesn't trigger, try accessing the provider directly
          if (typeof window !== 'undefined' && (window as any).ethereum) {
            const provider = (window as any).ethereum;
            // Request accounts to trigger connection prompt
            setTimeout(async () => {
              try {
                await provider.request({ method: 'eth_requestAccounts' });
              } catch (err) {
                console.log("Direct provider request result:", err);
              }
            }, 100);
          }
        } catch (error) {
          console.error("Connect failed:", error);
          // Last resort: try direct provider access
          if (typeof window !== 'undefined' && (window as any).ethereum) {
            (window as any).ethereum.request({ method: 'eth_requestAccounts' }).catch(() => {});
          }
        }
      } else if (connectors.length > 0) {
        console.log("Connecting with fallback connector:", connectors[0].id);
        connect({ connector: connectors[0] });
      } else {
        console.error("No connectors available! Available connectors:", connectors);
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

  // Pass ScanProgress object directly (RealForgeView expects ScanProgress, not string)
  const npcProgress = npcProgressRaw;

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
