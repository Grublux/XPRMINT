import { useState, useEffect } from 'react';
import styles from './RecipeModal.module.css';

type RecipeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onForge: (numCoins: number) => void;
  ngtBalance: string;
  // Contract values (placeholders until contract is deployed)
  maxCoins?: number;
  ngtPerCoin?: number;
  coalPerCoin?: number;
  cruciblesRequired?: number;
};

export default function RecipeModal({
  isOpen,
  onClose,
  onForge,
  ngtBalance,
  maxCoins = 10,
  ngtPerCoin = 1000,
  coalPerCoin = 10,
  cruciblesRequired = 1,
}: RecipeModalProps) {
  const [numCoins, setNumCoins] = useState(1);
  const [hasEnoughNGT, setHasEnoughNGT] = useState(false);
  const [hasEnoughCoal, setHasEnoughCoal] = useState(false);
  const [hasEnoughCrucibles, setHasEnoughCrucibles] = useState(false);

  const totalNGT = numCoins * ngtPerCoin;
  const totalCoal = numCoins * coalPerCoin;

  // Check if user has enough resources
  useEffect(() => {
    const balance = parseFloat(ngtBalance.replace(/,/g, '')) || 0;
    setHasEnoughNGT(balance >= totalNGT);
    // TODO: Check COAL balance from contract
    setHasEnoughCoal(true); // Placeholder - assume true for now
    // TODO: Check Crucible balance from contract
    setHasEnoughCrucibles(true); // Placeholder - assume true for now
  }, [ngtBalance, totalNGT]);

  const canForge = hasEnoughNGT && hasEnoughCoal && hasEnoughCrucibles && numCoins > 0;

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

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>×</button>
        
        <h2 className={styles.title}>Forge Recipe</h2>
        
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
          <div className={`${styles.requirementRow} ${!hasEnoughNGT ? styles.insufficient : ''}`}>
            <span className={styles.reqLabel}>NGT Required:</span>
            <span className={styles.reqValue}>{totalNGT.toLocaleString()}</span>
            {!hasEnoughNGT && <span className={styles.warning}>Insufficient</span>}
          </div>
          
          <div className={`${styles.requirementRow} ${!hasEnoughCoal ? styles.insufficient : ''}`}>
            <span className={styles.reqLabel}>COAL Required:</span>
            <span className={styles.reqValue}>{totalCoal.toLocaleString()}</span>
            {!hasEnoughCoal && <span className={styles.warning}>Insufficient</span>}
          </div>
          
          <div className={`${styles.requirementRow} ${!hasEnoughCrucibles ? styles.insufficient : ''}`}>
            <span className={styles.reqLabel}>Crucible Required:</span>
            <span className={styles.reqValue}>{cruciblesRequired}</span>
            {!hasEnoughCrucibles && <span className={styles.warning}>Insufficient</span>}
          </div>
        </div>

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

