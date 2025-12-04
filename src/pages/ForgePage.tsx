import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './ForgePage.module.css';
import { useNGTBalance } from '../hooks/forging/useNGTBalance';
import { useNPCTokens } from '../hooks/forging/useNPCTokens';
import type { NPCToken } from '../hooks/forging/useNPCTokens';
import RecipeModal from '../components/forge/RecipeModal';
import NPCModal from '../components/forge/NPCModal';

type ChatBubble = {
  id: number;
  lines: string[];
  fading: boolean;
};

export default function ForgePage() {
  const { displayBalance, isPlaceholder, isLoading } = useNGTBalance();
  const { tokens: npcTokens, isLoading: npcLoading, progress: npcProgress, scan: scanNPCs } = useNPCTokens();
  
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showNPCModal, setShowNPCModal] = useState(false);
  const [selectedNPC, setSelectedNPC] = useState<NPCToken | null>(null);
  const [recipeConfirmed, setRecipeConfirmed] = useState(false);
  const [isForging, setIsForging] = useState(false);
  const hasShownSecondMessage = useRef(false);
  const nextIdRef = useRef(0);

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
      addBubble(['Welcome to the Master Forge,', 'first you\'ll need to "Choose NPC" below.']);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

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
    addBubble([`Recipe set for ${numCoins} coin${numCoins > 1 ? 's' : ''}.`, 'Click "Forge" when ready!']);
  };

  // Button states
  const canOpenRecipe = !!selectedNPC;
  const canForge = !!selectedNPC && recipeConfirmed;

  return (
    <div className={styles.forgePage}>
      <h1 className={styles.title}>Master Forge</h1>
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
          
          {/* Progress bar under cauldron - only show when forging */}
          {isForging && (
            <div className={styles.progressBarContainer}>
              <div className={styles.progressBarTrack}>
                <div className={styles.progressBarFill} style={{ width: '0%' }}></div>
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
              <span className={styles.actionButtonLabel}>Recipe</span>
            </button>
            <button 
              className={`${styles.actionButton} ${styles.npcButton} ${selectedNPC ? styles.npcButtonSelected : ''}`} 
              onClick={() => {
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
    </div>
  );
}
