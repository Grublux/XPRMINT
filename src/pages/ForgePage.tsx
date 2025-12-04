import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useConnect } from 'wagmi';
import styles from './ForgePage.module.css';
import { useNGTBalance } from '../hooks/forging/useNGTBalance';
import { useNPCTokens } from '../hooks/forging/useNPCTokens';
import type { NPCToken } from '../hooks/forging/useNPCTokens';
import RecipeModal from '../components/forge/RecipeModal';
import NPCModal from '../components/forge/NPCModal';
import ForgeSuccessModal from '../components/forge/ForgeSuccessModal';

type ChatBubble = {
  id: number;
  lines: string[];
  fading: boolean;
};

export default function ForgePage() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { displayBalance, isPlaceholder, isLoading } = useNGTBalance();
  const { tokens: npcTokens, isLoading: npcLoading, progress: npcProgress, scan: scanNPCs } = useNPCTokens();
  
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showNPCModal, setShowNPCModal] = useState(false);
  const [selectedNPC, setSelectedNPC] = useState<NPCToken | null>(null);
  const [recipeConfirmed, setRecipeConfirmed] = useState(false);
  const [isForging, setIsForging] = useState(false);
  const [forgeProgress, setForgeProgress] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [coinsForged, setCoinsForged] = useState(0);
  const [pendingCoins, setPendingCoins] = useState(1);
  const hasShownSecondMessage = useRef(false);
  const nextIdRef = useRef(0);
  const forgeStartTime = useRef<number | null>(null);

  const addBubble = useCallback((lines: string[]) => {
    const id = nextIdRef.current++;
    setBubbles(prev => {
      const fadingBubbles = prev.map(b => ({ ...b, fading: true }));
      return [{ id, lines, fading: false }, ...fadingBubbles];
    });

    setTimeout(() => {
      setBubbles(prev => prev.filter(b => !b.fading));
    }, 7500);
  }, []);

  // Initial welcome message
  useEffect(() => {
    const timer = setTimeout(() => {
      addBubble(['Welcome to the Master Forge.', 'First you\'ll need to "Choose NPC" below.']);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Forge progress animation - 60 seconds with variable speed
  useEffect(() => {
    if (!isForging) {
      forgeStartTime.current = null;
      return;
    }

    forgeStartTime.current = Date.now();
    const TOTAL_DURATION = 60000; // 60 seconds

    // Custom easing function that creates variable speed
    const getProgress = (elapsed: number): number => {
      const t = elapsed / TOTAL_DURATION;
      if (t >= 1) return 100;
      
      // Create a bumpy progress curve
      // Fast start (0-15%), slow (15-30%), fast (30-50%), very slow crawl (50-80%), fast finish (80-100%)
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
        // TODO: Update coin counter, decrement NGT/Coal balances when contract wired in
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isForging, addBubble]);

  // Messages after NPC is selected
  useEffect(() => {
    if (selectedNPC && !hasShownSecondMessage.current) {
      hasShownSecondMessage.current = true;
      
      // First message about XP tracking
      const timer1 = setTimeout(() => {
        addBubble(['Your crafting XP will track', 'with your NPC as you forge.']);
      }, 500);
      
      // Second message prompting recipe
      const timer2 = setTimeout(() => {
        addBubble(['Next you\'ll need to confirm', 'your "Recipe" below.']);
      }, 3500);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [selectedNPC, addBubble]);

  const handleNPCSelect = (token: NPCToken) => {
    setSelectedNPC(token);
    setShowNPCModal(false);
  };

  const handleRecipeConfirm = (numCoins: number) => {
    console.log('Recipe confirmed:', numCoins, 'coins');
    setShowRecipeModal(false);
    setRecipeConfirmed(true);
    setPendingCoins(numCoins);
    addBubble([`Recipe set for ${numCoins} coin${numCoins > 1 ? 's' : ''}.`, 'Click "Forge" when ready!']);
  };

  // Button states
  const canOpenRecipe = !!selectedNPC;
  const canForge = !!selectedNPC && recipeConfirmed;

  return (
    <div className={styles.forgePage}>
      <div className={styles.imageContainer}>
        <div className={styles.imageWrapper}>
          <img src="/forge_clean.png" alt="Forge" className={styles.backgroundImage} />
          <div className={styles.cauldronGlow}></div>
          <div className={styles.flameGlow}></div>
          
          {/* Top left leader avatar */}
          <img src="/leader_orange.png" alt="Leader" className={styles.leaderAvatar} />
          
          {/* Leader chat bubbles */}
          <div className={styles.chatBubblesContainer}>
            {bubbles.map((bubble) => (
              <div 
                key={bubble.id} 
                className={`${styles.chatBubble} ${bubble.fading ? styles.chatBubbleFading : ''}`}
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
                <div className={styles.progressBarFill} style={{ width: `${forgeProgress}%` }}></div>
              </div>
            </div>
          )}
          
          {/* Top right counters */}
          <div className={styles.countersContainer}>
            <div className={styles.goldCounter}>
              <span className={styles.counterValue}>
                {isLoading ? '...' : isPlaceholder ? '0.00' : displayBalance}
              </span>
              <span className={styles.counterLabel}>NGT</span>
            </div>
            <div className={styles.coinCounter}>
              <span className={styles.coinIcon}>🪙</span>
              <span className={styles.coinCount}>x0</span>
            </div>
            <div className={styles.coinCounter}>
              <span className={styles.coalIcon}>🪨</span>
              <span className={styles.coinCount}>x0</span>
            </div>
          </div>
          
          {/* Bottom action buttons */}
          <div className={styles.actionButtonsContainer}>
            <button 
              className={`${styles.actionButton} ${!canOpenRecipe ? styles.actionButtonDisabled : ''}`}
              onClick={() => canOpenRecipe && setShowRecipeModal(true)}
              disabled={!canOpenRecipe}
            >
              <span className={styles.actionButtonLabel}>
                {recipeConfirmed ? `${pendingCoins} Coin${pendingCoins > 1 ? 's' : ''} ✓` : 'Recipe'}
              </span>
            </button>
            <button 
              className={`${styles.actionButton} ${styles.npcButton} ${selectedNPC ? styles.npcButtonSelected : ''}`} 
              onClick={() => {
                if (!isConnected || !address) {
                  // Prompt wallet connection
                  const connector = connectors[0];
                  if (connector) {
                    connect({ connector });
                  }
                  return;
                }
                setShowNPCModal(true);
                scanNPCs();
              }}
            >
              {selectedNPC ? (
                <div className={styles.selectedNPCInfo}>
                  <span className={styles.selectedNPCLabel}>NPC #{selectedNPC.tokenId.toString()}</span>
                  {selectedNPC.imageUrl ? (
                    <img src={selectedNPC.imageUrl} alt={selectedNPC.name} className={styles.selectedNPCImage} />
                  ) : null}
                  <span className={styles.selectedNPCXp}>XP: 0</span>
                </div>
              ) : (
                <span className={styles.actionButtonLabel}>Choose NPC</span>
              )}
            </button>
            <button 
              className={`${styles.actionButton} ${!canForge ? styles.actionButtonDisabled : ''}`}
              disabled={!canForge}
              onClick={() => {
                if (canForge) {
                  setIsForging(true);
                  addBubble(['Forging in progress...']);
                }
              }}
            >
              <span className={styles.actionButtonLabel}>Forge</span>
            </button>
          </div>
        </div>
      </div>
      <div className={styles.content}>
      </div>

      <RecipeModal
        isOpen={showRecipeModal}
        onClose={() => setShowRecipeModal(false)}
        onForge={handleRecipeConfirm}
        ngtBalance={displayBalance}
      />

      <NPCModal
        isOpen={showNPCModal}
        onClose={() => setShowNPCModal(false)}
        onSelect={handleNPCSelect}
        tokens={npcTokens}
        isLoading={npcLoading}
        progress={npcProgress}
      />

      <ForgeSuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          setRecipeConfirmed(false);
          addBubble(['Ready for another forge?', 'Set your "Recipe" to continue.']);
        }}
        coinsForged={coinsForged}
      />
    </div>
  );
}
