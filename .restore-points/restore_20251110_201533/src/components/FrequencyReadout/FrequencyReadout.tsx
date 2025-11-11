import { useState, useRef } from 'react';
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
  const electrodeRef = useRef<HTMLDivElement>(null);
  
  const disabled = status!=='active' || selectedIdx===null || (selectedIdx!==null && used[selectedIdx]);
  const canSelect = selectedIdx !== null && selectedIdx < numbers.length && !disabled;
  
  const selectedNumber = selectedIdx !== null && selectedIdx < numbers.length ? numbers[selectedIdx] : 0;
  const sign = direction === 'up' ? '+' : '-';
  const hz = selectedNumber;
  const dir = direction === 'up' ? 'add' : 'sub';
  const actionText = direction === 'up' ? 'Add' : 'Subtract';

  const handleClick = () => {
    if (disabled || selectedIdx === null) return;
    
    // Get electrode position (lightning originates from electrode)
    if (electrodeRef.current) {
      const rect = electrodeRef.current.getBoundingClientRect();
      const fromX = rect.left + rect.width / 2;
      const fromY = rect.top + rect.height / 2;
      
      // Target: random position on specimen canvas (within the liquid area)
      const specimenCanvas = document.querySelector('[aria-labelledby="specimenTitle"] canvas');
      if (specimenCanvas) {
        const specRect = specimenCanvas.getBoundingClientRect();
        
        // Randomize X position (30% to 70% of width for variety)
        const xOffset = 0.3 + Math.random() * 0.4; // 0.3 to 0.7
        const toX = specRect.left + specRect.width * xOffset;
        
        // Randomize Y position (top 20% to 60% of height - within liquid area)
        const yOffset = 0.2 + Math.random() * 0.4; // 0.2 to 0.6
        const toY = specRect.top + specRect.height * yOffset;
        
        setBolt({ from: {x: fromX, y: fromY}, to: {x: toX, y: toY} });
        
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('bolt-hit'));
        }, 250);
      }
    }
    
    play(selectedIdx, dir); click(); buzz(10);
  };

  return (
    <div className={styles.column}>
      <div 
        ref={electrodeRef} 
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
          from={bolt.from} 
          to={bolt.to} 
          onComplete={() => setBolt(null)} 
        />
      )}
    </div>
  );
}
