import { useState, useRef } from 'react';
import { useGame } from '../../state/gameStore';
import { click } from '../../lib/audio';
import { buzz } from '../../lib/haptics';
import BoltAnimation from '../BoltAnimation/BoltAnimation';
import styles from './ActionButtons.module.css';

export default function DownButton(){
  const { play, status, selectedIdx, used } = useGame();
  const [bolt, setBolt] = useState<{from: {x:number;y:number}, to: {x:number;y:number}} | null>(null);
  const cathodeRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const disabled = status!=='active' || selectedIdx===null || (selectedIdx!==null && used[selectedIdx]);

  const doPlay = ()=>{
    if (disabled || selectedIdx===null) return;
    
    // Get cathode position (lightning originates from cathode)
    if (cathodeRef.current) {
      const rect = cathodeRef.current.getBoundingClientRect();
      const fromX = rect.left + rect.width / 2;
      const fromY = rect.top + rect.height / 2;
      
      // Target: center top of vat liquid
      const specimenCanvas = document.querySelector('[aria-labelledby="specimenTitle"] canvas');
      if (specimenCanvas) {
        const specRect = specimenCanvas.getBoundingClientRect();
        const toX = specRect.left + specRect.width / 2;
        const toY = specRect.top + specRect.height * 0.25; // top of liquid
        
        setBolt({ from: {x: fromX, y: fromY}, to: {x: toX, y: toY} });
        
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('bolt-hit'));
        }, 250);
      }
    }
    
    play(selectedIdx, 'sub'); click(); buzz(10);
  };

  return (
    <div className={styles.container}>
      <div ref={cathodeRef} className={styles.cathode} />
      <button 
        ref={buttonRef}
        className={styles.btn} 
        disabled={disabled} 
        onClick={doPlay}
        aria-label="Decrease resonance"
      >
        Sub
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
