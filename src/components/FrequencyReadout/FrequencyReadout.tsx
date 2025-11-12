import { useState, useRef, useCallback } from 'react';
import { useGame } from '../../state/gameStore';
import { click } from '../../lib/audio';
import { buzz } from '../../lib/haptics';
import BoltAnimation from '../BoltAnimation/BoltAnimation';
import styles from './FrequencyReadout.module.css';

type Props = {
  direction: 'up' | 'down';
};

export default function FrequencyReadout({ direction }: Props){
  const { play, status, selectedIdx, used, numbers } = useGame();
  const [bolt, setBolt] = useState<{from: {x:number;y:number}, to: {x:number;y:number}} | null>(null);
  const electrodeRef = useRef<HTMLImageElement>(null);
  
  const disabled = status!=='active' || selectedIdx===null || (selectedIdx!==null && used[selectedIdx]);
  const canSelect = selectedIdx !== null && selectedIdx < numbers.length && !disabled;
  
  const selectedNumber = selectedIdx !== null && selectedIdx < numbers.length ? numbers[selectedIdx] : 0;
  const sign = direction === 'up' ? '+' : '-';
  const hz = selectedNumber;
  const dir = direction === 'up' ? 'add' : 'sub';
  const actionText = direction === 'up' ? 'Add' : 'Subtract';
  
  // Stable callback to prevent unnecessary re-renders
  const handleBoltComplete = useCallback(() => {
    setBolt(null);
  }, []);

  const handleClick = () => {
    if (disabled || selectedIdx === null) return;
    
    // Get electrode position (lightning originates from center of orb image)
    if (electrodeRef.current) {
      const rect = electrodeRef.current.getBoundingClientRect();
      // Center of the orb image - shifted up 10px
      const fromX = rect.left + rect.width / 2;
      const fromY = rect.top + rect.height / 2 - 10; // Center vertically, shifted up 10px
      
      // Target: center of specimen orb with random variation to strike different areas
      // Use data attribute for reliable selection
      const specimenCanvas = document.querySelector('[data-specimen-canvas="true"]') as HTMLCanvasElement;
      
      if (specimenCanvas) {
        const specRect = specimenCanvas.getBoundingClientRect();
        
        // Calculate specimen center (matches CreatureCanvas calculation)
        // Center horizontally: 50% + 1% offset = 51% of width
        const centerXPercent = 0.51;
        // Center vertically: orb is at 65% down
        const centerYPercent = 0.65;
        
        // Base target at center of specimen
        const centerX = specRect.left + specRect.width * centerXPercent;
        const centerY = specRect.top + specRect.height * centerYPercent;
        
        // Add random variation to strike different areas of the vessel
        // Random offset: ±15% of canvas width/height for variety
        const randomXOffset = (Math.random() - 0.5) * specRect.width * 0.3; // ±15%
        const randomYOffset = (Math.random() - 0.5) * specRect.height * 0.3; // ±15%
        
        const toX = centerX + randomXOffset;
        const toY = centerY + randomYOffset;
        
        // Set bolt immediately - the key will force remount
        setBolt({ from: {x: fromX, y: fromY}, to: {x: toX, y: toY} });
        
        // Delay bolt-hit to match when lightning actually reaches target (animation is 400ms)
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('bolt-hit'));
        }, 350);
      } else {
        // Fallback: still show lightning even if canvas not found
        const toX = window.innerWidth / 2;
        const toY = window.innerHeight / 2;
        setBolt({ from: {x: fromX, y: fromY}, to: {x: toX, y: toY} });
      }
    }
    
    play(selectedIdx, dir); click(); buzz(10);
  };

  return (
    <div className={styles.column}>
      <img 
        ref={electrodeRef} 
        src="/orb_transparent.png"
        alt={direction === 'up' ? 'Anode' : 'Cathode'}
        className={direction === 'up' ? styles.anode : styles.cathode} 
      />
      <button
        className={`${styles.container} ${canSelect ? styles.selectable : ''} ${disabled ? styles.disabled : ''}`}
        onClick={handleClick}
        disabled={disabled}
        aria-label={direction === 'up' ? 'Add frequency' : 'Subtract frequency'}
      >
        <div className={styles.readout}>
          <div className={styles.label}>{actionText}</div>
          {selectedIdx !== null && selectedIdx < numbers.length ? (
            <div className={`${styles.value} ${direction === 'up' ? styles.upValue : styles.downValue}`}>
              {sign}{hz} Hz
            </div>
          ) : (
            <div className={styles.value}>-- Hz</div>
          )}
        </div>
      </button>
      {bolt && (
        <BoltAnimation 
          key={`${bolt.from.x.toFixed(1)}-${bolt.from.y.toFixed(1)}-${bolt.to.x.toFixed(1)}-${bolt.to.y.toFixed(1)}`}
          from={bolt.from} 
          to={bolt.to} 
          onComplete={handleBoltComplete} 
        />
      )}
    </div>
  );
}
