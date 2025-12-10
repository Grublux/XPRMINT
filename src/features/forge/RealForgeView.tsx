"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./ForgePage.module.css";
import RecipeModal from "@/features/forge/components/RecipeModal";
import NPCModal from "@/features/forge/components/NPCModal";
import ForgeSuccessModal from "@/features/forge/components/ForgeSuccessModal";
import BagModal from "@/features/forge/components/BagModal";

// Minimal NPCToken shape for the UI (keeps this file self-contained)
export type NPCToken = {
  tokenId: bigint | number;
  name?: string;
  imageUrl?: string;
};

type ChatBubble = {
  id: number;
  lines: string[];
  fading: boolean;
};

export type RealForgeViewProps = {
  // Connection
  address?: string | null;
  isConnected: boolean;
  onConnectClick?: () => void;

  // NGT balance
  ngtDisplayBalance: string; // e.g. "123.45"
  ngtIsLoading?: boolean;
  ngtIsPlaceholder?: boolean; // when balance is a placeholder 0.00

  // Coin balance
  coinBalance?: number;
  coinBalanceLoading?: boolean;

  // Forge XP (address / forge-bound, NOT NPC-bound)
  forgeXP?: number;
  forgeXPLoading?: boolean;

  // NPCs (just selection + scanning, no XP)
  npcTokens: NPCToken[];
  npcLoading: boolean;
  npcProgress?: number | string; // whatever useNPCTokens.progress was
  onScanNPCsClick?: () => void;
};

export function RealForgeView(props: RealForgeViewProps) {
  const {
    address,
    isConnected,
    onConnectClick,
    ngtDisplayBalance,
    ngtIsLoading = false,
    ngtIsPlaceholder = false,
    coinBalance = 0,
    coinBalanceLoading = false,
    forgeXP = 0,
    forgeXPLoading = false,
    npcTokens,
    npcLoading,
    npcProgress,
    onScanNPCsClick,
  } = props;

  const [mounted, setMounted] = useState(false);
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showNPCModal, setShowNPCModal] = useState(false);
  const [selectedNPC, setSelectedNPC] = useState<NPCToken | null>(null);
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [showBagModal, setShowBagModal] = useState(false); // Bag inspection modal

  const [recipeConfirmed, setRecipeConfirmed] = useState(false);
  const [isForging, setIsForging] = useState(false);
  const [forgeProgress, setForgeProgress] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [coinsForged, setCoinsForged] = useState(0);
  const [pendingCoins, setPendingCoins] = useState(1);

  const hasShownSecondMessage = useRef(false);
  const nextIdRef = useRef(0);
  const forgeStartTime = useRef<number | null>(null);

  // Track mount to avoid hydration mismatch in counters
  useEffect(() => {
    setMounted(true);
  }, []);

  const addBubble = useCallback((lines: string[]) => {
    const id = nextIdRef.current++;
    setBubbles((prev) => {
      const fadingBubbles = prev.map((b) => ({ ...b, fading: true }));
      return [{ id, lines, fading: false }, ...fadingBubbles];
    });

    setTimeout(() => {
      setBubbles((prev) => prev.filter((b) => !b.fading));
    }, 7500);
  }, []);

  // Clear selected NPC and recipe when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setSelectedNPC(null);
      setRecipeConfirmed(false);
      hasShownSecondMessage.current = false;
      setShowWalletMenu(false);
    } else {
    }
  }, [isConnected]);

  // Close wallet menu when clicking outside
  useEffect(() => {
    if (!showWalletMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const walletContainer = document.querySelector('[data-wallet-container]');
      if (walletContainer && !walletContainer.contains(target)) {
        setShowWalletMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showWalletMenu]);

  // Initial welcome message - depends on wallet connection
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isConnected) {
        addBubble([
          "You are using the NGMI Genesis Forge,",
          "Choose NPC to continue",
        ]);
      } else {
        addBubble([
          "Welcome to the Genesis Forge",
          "Connect your wallet to begin",
        ]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [addBubble, isConnected]);

  // Forge progress animation – 60 seconds with variable speed
  useEffect(() => {
    if (!isForging) {
      forgeStartTime.current = null;
      return;
    }

    forgeStartTime.current = Date.now();
    const TOTAL_DURATION = 60000; // 60 seconds

    const getProgress = (elapsed: number): number => {
      const t = elapsed / TOTAL_DURATION;
      if (t >= 1) return 100;
      if (t < 0.1) return t * 150; // Fast: 0-15%
      if (t < 0.25) return 15 + (t - 0.1) * 100; // Slower: 15-30%
      if (t < 0.4) return 30 + (t - 0.25) * 133; // Fast: 30-50%
      if (t < 0.75) return 50 + (t - 0.4) * 85; // Slow crawl: 50-80%
      return 80 + (t - 0.75) * 80; // Fast finish: 80-100%
    };

    const interval = setInterval(() => {
      if (!forgeStartTime.current) return;

      const elapsed = Date.now() - forgeStartTime.current;
      const progress = getProgress(elapsed);

      setForgeProgress(Math.min(100, Math.round(progress)));

      if (progress >= 100) {
        clearInterval(interval);
        setIsForging(false);
        setForgeProgress(0);
        setCoinsForged(pendingCoins);
        setShowSuccessModal(true);
        // TODO: Hook into real contract results and balances
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isForging, pendingCoins]);

  // Messages after NPC is selected
  useEffect(() => {
    if (selectedNPC && !hasShownSecondMessage.current) {
      hasShownSecondMessage.current = true;

      const timer = setTimeout(() => {
        addBubble([
          'Next you\'ll need to confirm',
          'your "Recipe" below.',
        ]);
      }, 500);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [selectedNPC, addBubble]);

  const handleNPCSelect = (token: NPCToken) => {
    setSelectedNPC(token);
    setShowNPCModal(false);
  };

  const handleRecipeConfirm = (numCoins: number) => {
    setPendingCoins(numCoins);
    setRecipeConfirmed(true);
    setShowRecipeModal(false);
    addBubble([
      `Recipe set for ${numCoins} coin${numCoins > 1 ? "s" : ""}.`,
      'Click "Forge" when ready!',
    ]);
  };

  const canOpenRecipe = !!selectedNPC;
  const canForge = !!selectedNPC && recipeConfirmed;

  return (
    <div className={styles.forgePage}>
      <div className={styles.imageContainer}>
        <div className={styles.imageWrapper}>
          <img
            src="/forge_clean.png"
            alt="Forge"
            className={styles.backgroundImage}
          />
          <div className={styles.cauldronGlow}></div>
          <div className={styles.flameGlow}></div>

          {/* Top header */}
          <div className={styles.forgeHeader}>
            <div className={styles.forgeHeaderRow}>
              <div className={styles.forgeHeaderNameArea}>
                <img src="/forge_2a.png" alt="Forge" className={styles.forgeHeaderIcon} />
                <div className={styles.forgeHeaderText}>
                  {isConnected ? "NGMI Genesis Forge" : "Wallet Not Connected"}
                </div>
              </div>
              <div className={styles.forgeHeaderSpacer}></div>
              {/* NGT balance */}
              <div className={styles.forgeHeaderNGT}>
                <span
                  className={styles.counterValue}
                  suppressHydrationWarning
                >
                  {!mounted
                    ? "0.00"
                    : ngtIsLoading
                    ? "..."
                    : ngtIsPlaceholder
                    ? "0.00"
                    : ngtDisplayBalance}
                </span>
                <span className={styles.counterLabel}>NGT</span>
              </div>
              {/* Wallet icon button */}
              <div className={styles.forgeHeaderWalletContainer} data-wallet-container>
                <button
                  className={styles.forgeHeaderWalletIcon}
                  onClick={() => {
                    if (isConnected && address) {
                      setShowWalletMenu(!showWalletMenu);
                    } else {
                      onConnectClick?.();
                    }
                  }}
                  disabled={false}
                  title={isConnected && address ? address : "Connect Wallet"}
                >
                  <img src="/wallet2a.png" alt="Wallet" className={styles.forgeHeaderWalletIconImg} />
                  <div className={styles.forgeHeaderWalletOverlay}>
                    {!isConnected ? (
                      <>
                        <div className={styles.forgeHeaderWalletNoConnectCircle}></div>
                        <div className={styles.forgeHeaderWalletNoConnectLine}></div>
                      </>
                    ) : (
                      <div className={styles.forgeHeaderWalletConnectedCircle}></div>
                    )}
                  </div>
                </button>
                {isConnected && address && showWalletMenu && (
                  <div className={styles.forgeHeaderWalletMenu}>
                    <div className={styles.forgeHeaderWalletAddress}>{address}</div>
                    <button
                      className={styles.forgeHeaderWalletDisconnect}
                      onClick={() => {
                        if (onConnectClick) {
                          onConnectClick();
                        }
                        setShowWalletMenu(false);
                      }}
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top left leader avatar */}
          <img
            src="/leader_orange.png"
            alt="Leader"
            className={styles.leaderAvatar}
          />

          {/* Leader chat bubbles */}
          <div className={styles.chatBubblesContainer}>
            {bubbles.map((bubble) => (
              <div
                key={bubble.id}
                className={`${styles.chatBubble} ${bubble.fading ? styles.chatBubbleFading : ""}`}
              >
                {bubble.lines.map((line, i) => (
                  <p key={i} className={styles.chatBubbleText}>{line}</p>
                ))}
              </div>
            ))}
          </div>

          {/* Progress bar - only show when forging */}
          {isForging && (
            <div className={styles.progressBarContainer}>
              <div className={styles.progressPercent}>{forgeProgress}%</div>
              <div className={styles.progressBarTrack}>
                <div
                  className={styles.progressBarFill}
                  style={{ width: `${forgeProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Top right counters */}
          <div className={styles.countersContainer}>
            {isConnected && (
              <div className={styles.bagContents}>
                <div className={styles.bagContentsHeader}>
                  <img src="/bag.png" alt="Bag" className={styles.bagIcon} />
                  <div className={styles.bagContentsLabel}>My Bag</div>
                </div>
                <div className={styles.bagHelperText}>click item to see details</div>
                <div className={styles.itemsRow}>
                  {coinBalance > 0 ? (
                    <button
                      className={styles.coinCounter}
                      onClick={() => setShowBagModal(true)}
                      title="View coins in bag"
                    >
                      <span className={styles.coinIcon}>🪙</span>
                      <span
                        className={styles.coinCount}
                        suppressHydrationWarning
                      >
                        {!mounted
                          ? "x0"
                          : coinBalanceLoading
                          ? "..."
                          : `x${coinBalance}`}
                      </span>
                    </button>
                  ) : (
                    <div className={`${styles.coinCounter} ${styles.empty}`}>
                      <span className={styles.coinIcon}>🪙</span>
                      <span
                        className={styles.coinCount}
                        suppressHydrationWarning
                      >
                        {!mounted
                          ? "x0"
                          : coinBalanceLoading
                          ? "..."
                          : `x${coinBalance}`}
                      </span>
                    </div>
                  )}
                  <div className={`${styles.coalCounter} ${styles.empty}`}>
                    <span className={styles.coalIcon}>🪨</span>
                    <span className={styles.coalCount}>x0</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom action buttons */}
          <div className={styles.actionButtonsContainer}>
            <button
              className={`${styles.actionButton} ${!canOpenRecipe ? styles.actionButtonDisabled : ""}`}
              onClick={() => canOpenRecipe && setShowRecipeModal(true)}
              disabled={!canOpenRecipe}
            >
              <span className={styles.actionButtonLabel}>
                {recipeConfirmed
                  ? `${pendingCoins} Coin${pendingCoins > 1 ? "s" : ""} ✓`
                  : "Recipe"}
              </span>
            </button>

            <button
              className={`${styles.actionButton} ${styles.npcButton} ${selectedNPC ? styles.npcButtonSelected : ""}`}
              onClick={() => {
                setShowNPCModal(true);
                if (isConnected && address && onScanNPCsClick) {
                  onScanNPCsClick();
                }
              }}
            >
              {selectedNPC ? (
                <div className={styles.selectedNPCInfo}>
                  <span className={styles.selectedNPCLabel}>NPC #{selectedNPC.tokenId.toString()}</span>
                  {selectedNPC.imageUrl ? (
                    <img
                      src={selectedNPC.imageUrl}
                      alt={selectedNPC.name}
                      className={styles.selectedNPCImage}
                    />
                  ) : null}
                  <span
                    className={styles.selectedNPCXp}
                    suppressHydrationWarning
                  >
                    NPC LVL: {!mounted
                      ? "0"
                      : forgeXPLoading
                      ? "..."
                      : (forgeXP ?? 0).toLocaleString()}
                  </span>
                </div>
              ) : (
                <span className={styles.actionButtonLabel}>Choose NPC</span>
              )}
            </button>

            <button
              className={`${styles.actionButton} ${!canForge ? styles.actionButtonDisabled : ""}`}
              disabled={!canForge}
              onClick={() => {
                if (canForge) {
                  setIsForging(true);
                  addBubble(["Forging in progress..."]);
                }
              }}
            >
              <span className={styles.actionButtonLabel}>Forge</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right-hand side content area (currently unused but kept for layout) */}
      <div className={styles.content}>
      </div>

          {/* Bag Modal */}
          {showBagModal && (
            <BagModal
              isOpen={showBagModal}
              onClose={() => setShowBagModal(false)}
              coinBalance={coinBalance}
              coinBalanceLoading={coinBalanceLoading}
              address={address}
            />
          )}

          {/* Modals enabled now that wagmi is wired */}
          {true && (
            <>
              <RecipeModal
            isOpen={showRecipeModal}
            onClose={() => setShowRecipeModal(false)}
            onForge={handleRecipeConfirm}
            ngtBalance={ngtDisplayBalance}
            selectedNPC={selectedNPC}
            onNPCSelect={(npc) => {
              handleNPCSelect(npc);
            }}
          />

          <NPCModal
            isOpen={showNPCModal}
            onClose={() => setShowNPCModal(false)}
            onSelect={handleNPCSelect}
            tokens={npcTokens}
            isLoading={npcLoading}
            progress={npcProgress}
            isConnected={isConnected && !!address}
            onConnect={onConnectClick}
          />

          <ForgeSuccessModal
            isOpen={showSuccessModal}
            onClose={() => {
              setShowSuccessModal(false);
              setRecipeConfirmed(false);
              addBubble([
                "Ready for another forge?",
                'Set your "Recipe" to continue.',
              ]);
            }}
            coinsForged={coinsForged}
          />
        </>
      )}
    </div>
  );
}
