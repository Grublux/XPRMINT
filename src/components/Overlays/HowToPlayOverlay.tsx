import { useEffect } from 'react';
import styles from './HowToPlayOverlay.module.css';

type HowToPlayOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function HowToPlayOverlay({ isOpen, onClose }: HowToPlayOverlayProps) {
  // Ensure overlay doesn't interfere with other elements when closed
  useEffect(() => {
    if (!isOpen) {
      // Force a small delay to ensure DOM cleanup
      return;
    }
  }, [isOpen]);

  if (!isOpen) return null;
  
  const handleScrimClick = (e: React.MouseEvent) => {
    // Only close if clicking directly on the scrim, not on child elements
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" onClick={handleScrimClick}>
      <div className={styles.box} onClick={(e) => e.stopPropagation()} tabIndex={-1}>
        <h2 className={styles.title}>How to Play</h2>
        <div className={styles.content}>
          <p>Choose numbers from your inventory.</p>
          <p>Then use the + and - buttons to fire at the specimen and alter it's frequency.</p>
          <p className={styles.boldText}>Player to match the target frequency EXACTLY wins the jackpot AND gets to mint the specimen.</p>
          <p>Top 7 players receive rewards.</p>
          <p className={styles.subHeader}>If the timer runs out and the experiment fails:</p>
          <p>Closest player wins the jackpot but the XPRMINT fails and the specimen cannot be minted.</p>
          <p className={styles.tagline}>It's time to XPRMINT!</p>
        </div>
        <div className={styles.row}>
          <button className={styles.btn} onClick={onClose}>Got it!</button>
        </div>
      </div>
    </div>
  );
}

