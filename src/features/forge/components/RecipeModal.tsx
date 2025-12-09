import { useState, useEffect, useMemo, useRef } from 'react';
import styles from './RecipeModal.module.css';
import { useRecipe } from '../hooks/useRecipe';
import { useNPCTokens } from '../hooks/useNPCTokens';
import { useNPCXP } from '../hooks/useNPCXP';
import { useAccount } from 'wagmi';
import type { NPCToken } from '../hooks/useNPCTokens';

type RecipeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onForge: (numCoins: number) => void;
  ngtBalance: string;
  selectedNPC?: { tokenId: bigint; name?: string } | null;
  onNPCSelect?: (npc: NPCToken) => void;
};

function NPCSelectionCard({ 
  token, 
  isSelected, 
  onSelect 
}: { 
  token: NPCToken; 
  isSelected: boolean; 
  onSelect: () => void;
}) {
  const { xp, isLoading: xpLoading } = useNPCXP(token.tokenId);
  
  return (
    <button
      className={`${styles.npcSelectionCard} ${isSelected ? styles.npcSelectionCardSelected : ''}`}
      onClick={onSelect}
    >
      {token.imageUrl ? (
        <img 
          src={token.imageUrl} 
          alt={token.name} 
          className={styles.npcSelectionImage}
        />
      ) : (
        <div className={styles.npcSelectionPlaceholder}>
          #{token.tokenId.toString()}
        </div>
      )}
      <span className={styles.npcSelectionName}>{token.name}</span>
      <span className={styles.npcSelectionXp}>
        XP: {xpLoading ? '...' : xp.toLocaleString()}
      </span>
    </button>
  );
}

export default function RecipeModal({
  isOpen,
  onClose,
  onForge,
  ngtBalance,
  selectedNPC,
  onNPCSelect,
}: RecipeModalProps) {
  const { address, isConnected } = useAccount();
  const [selectedRecipeId, setSelectedRecipeId] = useState(1);
  const [showRecipeDropdown, setShowRecipeDropdown] = useState(false);
  const [showNPCSelection, setShowNPCSelection] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { recipe, maxCoins, isLoading: recipeLoading } = useRecipe(selectedRecipeId);
  const { tokens: npcTokens, isLoading: npcLoading, progress: npcProgress, scan: scanNPCs } = useNPCTokens();
  const [numCoins, setNumCoins] = useState(1);
  const [hasEnoughNGT, setHasEnoughNGT] = useState(false);
  const [hasEnoughCoal, setHasEnoughCoal] = useState(false);

  const recipes = [
    { id: 1, name: 'OG Coin' },
    { id: 2, name: 'Necklace - coming soon', disabled: true },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowRecipeDropdown(false);
      }
    };

    if (showRecipeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showRecipeDropdown]);

  // Convert recipe values from wei to readable format (assuming 18 decimals for NGT)
  const ngtPerCoin = useMemo(() => {
    if (!recipe) return 0;
    // Convert from wei (18 decimals) to readable format
    return Number(recipe.inputPerUnit) / 1e18;
  }, [recipe]);

  const coalPerCoin = useMemo(() => {
    if (!recipe) return 0;
    // COAL is ERC1155, so it's already in whole units
    return Number(recipe.coalPerUnit);
  }, [recipe]);

  const totalNGT = numCoins * ngtPerCoin;
  const totalCoal = numCoins * coalPerCoin;
  
  // Calculate NGT values
  const availableNGT = useMemo(() => {
    return parseFloat(ngtBalance.replace(/,/g, '')) || 0;
  }, [ngtBalance]);
  
  const ngtRemaining = availableNGT - totalNGT;
  const ngtShortfall = ngtRemaining < 0 ? Math.abs(ngtRemaining) : 0;

  // Check if user has enough resources
  useEffect(() => {
    setHasEnoughNGT(availableNGT >= totalNGT);
    // If coalPerCoin is 0, no coal is required
    setHasEnoughCoal(coalPerCoin === 0 || true); // TODO: Check COAL balance from contract when coalPerCoin > 0
  }, [availableNGT, totalNGT, coalPerCoin]);

  const canForge = hasEnoughNGT && hasEnoughCoal && numCoins > 0 && selectedNPC !== null && selectedNPC !== undefined;

  // Format lock duration
  const lockDurationText = useMemo(() => {
    if (!recipe || recipe.lockDuration === 0n) return '0 seconds';
    const seconds = Number(recipe.lockDuration);
    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minute${Math.floor(seconds / 60) !== 1 ? 's' : ''}`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour${Math.floor(seconds / 3600) !== 1 ? 's' : ''}`;
    return `${Math.floor(seconds / 86400)} day${Math.floor(seconds / 86400) !== 1 ? 's' : ''}`;
  }, [recipe]);

  const handleIncrement = () => {
    if (numCoins < maxCoins) {
      setNumCoins(prev => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (numCoins > 1) {
      setNumCoins(prev => prev - 1);
    }
  };

  const handleForge = () => {
    if (canForge) {
      onForge(numCoins);
    }
  };

  if (!isOpen) return null;

  if (recipeLoading) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={e => e.stopPropagation()}>
          <button className={styles.closeButton} onClick={onClose}>×</button>
          <h2 className={styles.title}>Crafted</h2>
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#888' }}>
            Loading recipe...
          </div>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={e => e.stopPropagation()}>
          <button className={styles.closeButton} onClick={onClose}>×</button>
          <h2 className={styles.title}>Crafted</h2>
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#888' }}>
            Recipe not found
          </div>
        </div>
      </div>
    );
  }

  if (!recipe.active) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={e => e.stopPropagation()}>
          <button className={styles.closeButton} onClick={onClose}>×</button>
          <h2 className={styles.title}>Crafted</h2>
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#888' }}>
            Recipe is inactive
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>×</button>
        
        <h2 className={styles.title}>Crafted</h2>
        
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Choose Recipe</div>
          <div className={styles.recipeDropdownContainer} ref={dropdownRef}>
            <button
              className={styles.recipeDropdownButton}
              onClick={() => setShowRecipeDropdown(!showRecipeDropdown)}
            >
              <span>{recipes.find(r => r.id === selectedRecipeId)?.name || 'Select Recipe'}</span>
              <span className={styles.dropdownArrow}>▼</span>
            </button>
            {showRecipeDropdown && (
              <div className={styles.recipeDropdown}>
                {recipes.map((r) => (
                  <button
                    key={r.id}
                    className={`${styles.recipeDropdownItem} ${r.disabled ? styles.recipeDropdownItemDisabled : ''} ${selectedRecipeId === r.id ? styles.recipeDropdownItemSelected : ''}`}
                    onClick={() => {
                      if (!r.disabled) {
                        setSelectedRecipeId(r.id);
                        setShowRecipeDropdown(false);
                      }
                    }}
                    disabled={r.disabled}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Crafter</span>
            <div className={styles.fieldValueContainer}>
              {selectedNPC ? (
                <>
                  <button
                    className={styles.npcLink}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowNPCSelection(!showNPCSelection);
                      if (!showNPCSelection && isConnected && address) {
                        scanNPCs();
                      }
                    }}
                  >
                    NPC {selectedNPC.tokenId.toString()}
                  </button>
                  <span className={styles.npcHelperText}>click to change</span>
                </>
              ) : (
                <button
                  className={styles.npcLink}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowNPCSelection(true);
                    if (isConnected && address) {
                      scanNPCs();
                    }
                  }}
                >
                  Select NPC
                </button>
              )}
            </div>
          </div>
          
          {showNPCSelection && (
            <div className={styles.npcSelectionContainer}>
              {!isConnected ? (
                <div className={styles.npcSelectionEmpty}>
                  <p>Connect Wallet to view NPCs</p>
                </div>
              ) : npcLoading || npcProgress.stage === 'scanning' || npcProgress.stage === 'metadata' ? (
                <div className={styles.npcSelectionLoading}>
                  <div className={styles.npcSpinner}></div>
                  <div className={styles.npcLoadingMessage}>Scanning wallet for NPCs</div>
                  <div className={styles.npcProgressTrack}>
                    <div 
                      className={styles.npcProgressFill} 
                      style={{ width: `${npcProgress.progress}%` }}
                    ></div>
                  </div>
                </div>
              ) : !npcLoading && (npcProgress.stage === 'complete' || npcProgress.stage === 'error') && npcTokens.length === 0 ? (
                <div className={styles.npcSelectionEmpty}>
                  <p>No NPCs found in your wallet.</p>
                </div>
              ) : npcTokens.length > 0 ? (
                <div className={styles.npcSelectionGrid}>
                  {npcTokens.map(token => (
                    <NPCSelectionCard
                      key={token.tokenId.toString()}
                      token={token}
                      isSelected={selectedNPC?.tokenId === token.tokenId}
                      onSelect={() => {
                        if (onNPCSelect) {
                          onNPCSelect(token);
                        }
                        setShowNPCSelection(false);
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className={styles.recipeRow}>
          <span className={styles.label}>Coins to Forge:</span>
          <div className={styles.counter}>
            <button 
              className={styles.counterBtn} 
              onClick={handleDecrement}
              disabled={numCoins <= 1}
            >
              −
            </button>
            <span className={styles.counterValue}>{numCoins}</span>
            <button 
              className={styles.counterBtn} 
              onClick={handleIncrement}
              disabled={numCoins >= maxCoins}
            >
              +
            </button>
          </div>
          <span className={styles.maxLabel}>(max {maxCoins})</span>
        </div>

        <div className={styles.requirements}>
          <div className={styles.requirementRow}>
            <span className={styles.reqLabel}>Available NGT:</span>
            <span className={styles.reqValue}>
              {availableNGT.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
          
          <div className={`${styles.requirementRow} ${!hasEnoughNGT ? styles.insufficient : ''}`}>
            <span className={styles.reqLabel}>NGT Required:</span>
            <span className={styles.reqValue}>
              − {totalNGT > 0 ? totalNGT.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'}
            </span>
          </div>
          
          <div className={`${styles.requirementRow} ${ngtRemaining < 0 ? styles.insufficient : ''}`}>
            <span className={styles.reqLabel}>NGT Remaining:</span>
            <span className={`${styles.reqValue} ${ngtRemaining < 0 ? styles.negativeValue : ''}`}>
              {ngtRemaining >= 0 
                ? ngtRemaining.toLocaleString(undefined, { maximumFractionDigits: 2 })
                : `- ${ngtShortfall.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
              }
            </span>
          </div>
          
          {coalPerCoin > 0 && (
            <div className={`${styles.requirementRow} ${!hasEnoughCoal ? styles.insufficient : ''}`}>
              <span className={styles.reqLabel}>COAL Required:</span>
              <span className={styles.reqValue}>{totalCoal.toLocaleString()}</span>
              {!hasEnoughCoal && <span className={styles.warning}>Insufficient</span>}
            </div>
          )}
        </div>

        {selectedNPC && recipe && (
          <div className={styles.helperText}>
            • You will place <strong>{totalNGT.toLocaleString(undefined, { maximumFractionDigits: 2 })} NGT</strong> into {numCoins} coin{numCoins !== 1 ? 's' : ''}.<br />
            • It will be locked for <strong>0 seconds</strong> before it can be destroyed and the $NGT reclaimed by the bearer.<br />
            • <strong>{(totalNGT * 0.1).toLocaleString(undefined, { maximumFractionDigits: 2 })} NGT</strong> (10%) of the $NGT will be routed to the crafter NPC {selectedNPC.tokenId.toString()} when the coin{numCoins !== 1 ? 's are' : ' is'} destroyed.<br />
            • NPC {selectedNPC.tokenId.toString()} will receive 6.9% secondary royalties.
          </div>
        )}

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button 
            className={`${styles.forgeBtn} ${!canForge ? styles.disabled : ''}`}
            onClick={handleForge}
            disabled={!canForge}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

