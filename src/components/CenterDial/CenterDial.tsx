import { useRef, useState, useCallback } from 'react';
import { useGame } from '../../state/gameStore';
import NumberChips from '../NumberChips/NumberChips';
import BoltAnimation from '../BoltAnimation/BoltAnimation';
import { click } from '../../lib/audio';
import { buzz } from '../../lib/haptics';
import styles from './CenterDial.module.css';

export default function CenterDial(){
  const { selectedIdx, numbers, canBuyNumber, buyNumber, play, status, used } = useGame();
  const hasSelection = selectedIdx !== null && selectedIdx < numbers.length;
  const [bolt, setBolt] = useState<{from: {x:number;y:number}, to: {x:number;y:number}} | null>(null);
  const minusButtonRef = useRef<HTMLButtonElement>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);
  
  const disabled = status!=='active' || selectedIdx===null || (selectedIdx!==null && used[selectedIdx]);
  const canSelect = selectedIdx !== null && selectedIdx < numbers.length && !disabled;
  
  let selectedNumber = 0;
  if (hasSelection) {
    selectedNumber = numbers[selectedIdx];
  }

  const can = canBuyNumber();

  const handleBoltComplete = useCallback(() => {
    setBolt(null);
  }, []);

  const handleClick = (direction: 'up' | 'down') => {
    if (disabled || selectedIdx === null) return;
    
    const dir = direction === 'up' ? 'add' : 'sub';
    
    // Use left cathode for "-" (down) and right cathode for "+" (up)
    const cathodeSelector = direction === 'down' 
      ? '[data-cathode-bottom="true"]' 
      : '[data-cathode-bottom-right="true"]';
    const cathodeBottomImg = document.querySelector(cathodeSelector) as HTMLImageElement;
    
    let fromX: number;
    let fromY: number;
    
    if (cathodeBottomImg) {
      const rect = cathodeBottomImg.getBoundingClientRect();
      // For left cathode (down), bulb is at 75% from left; for right cathode (up, rotated 180deg), bulb is at 25% from left (which is 75% from right in original)
      const xPercent = direction === 'down' ? 0.75 : 0.25;
      fromX = rect.left + rect.width * xPercent;
      fromY = rect.top + rect.height * 0.2;
    } else {
      const buttonRef = direction === 'down' ? minusButtonRef : plusButtonRef;
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        fromX = rect.left + rect.width / 2;
        fromY = rect.top + rect.height / 2;
      } else {
        return;
      }
    }
    
    const specimenCanvas = document.querySelector('[data-specimen-canvas="true"]') as HTMLCanvasElement;
      
    if (specimenCanvas) {
      const specRect = specimenCanvas.getBoundingClientRect();
      const centerXPercent = 0.51;
      const centerYPercent = 0.65;
      const centerX = specRect.left + specRect.width * centerXPercent;
      const centerY = specRect.top + specRect.height * centerYPercent;
      const randomXOffset = (Math.random() - 0.5) * specRect.width * 0.3;
      const randomYOffset = (Math.random() - 0.5) * specRect.height * 0.3;
      const toX = centerX + randomXOffset;
      const toY = centerY + randomYOffset;
      setBolt({ from: {x: fromX, y: fromY}, to: {x: toX, y: toY} });
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('bolt-hit'));
      }, 350);
    } else {
      const toX = window.innerWidth / 2;
      const toY = window.innerHeight / 2;
      setBolt({ from: {x: fromX, y: fromY}, to: {x: toX, y: toY} });
    }
    
    play(selectedIdx, dir); click(); buzz(10);
  };

  return (
    <div className={styles.container}>
      <div className={styles.dialSection}>
        <div className={styles.buttonsRow}>
          <button
            ref={minusButtonRef}
            className={`${styles.orbButton} ${styles.minusButton} ${canSelect ? styles.selectable : ''} ${disabled ? styles.disabled : ''}`}
            onClick={() => handleClick('down')}
            disabled={disabled}
            aria-label="Minus frequency"
          >
            <span className={styles.buttonSign}>-</span>
          </button>
          <button
            ref={plusButtonRef}
            className={`${styles.orbButton} ${styles.plusButton} ${canSelect ? styles.selectable : ''} ${disabled ? styles.disabled : ''}`}
            onClick={() => handleClick('up')}
            disabled={disabled}
            aria-label="Plus frequency"
          >
            <span className={styles.buttonSign}>+</span>
          </button>
        </div>
        <div className={styles.frequencyReadout}>
          {hasSelection ? `${selectedNumber} Hz` : '-- Hz'}
        </div>
      </div>
      <div className={styles.numbersSection}>
        <NumberChips/>
      </div>
      <button
        className={styles.buyButton}
        onClick={buyNumber}
        disabled={!can}
        aria-label="Buy a new number"
      >
        Buy
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
