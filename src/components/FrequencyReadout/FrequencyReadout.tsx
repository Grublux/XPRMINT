import { useRef, useState, useCallback } from 'react';
import { useGame } from '../../state/gameStore';
import BoltAnimation from '../BoltAnimation/BoltAnimation';
import { click } from '../../lib/audio';
import { buzz } from '../../lib/haptics';
import styles from './FrequencyReadout.module.css';

export default function FrequencyReadout(){
  const { selectedIdx, numbers, play, status, used } = useGame();
  const [bolt, setBolt] = useState<{from: {x:number;y:number}, to: {x:number;y:number}} | null>(null);
  const minusButtonRef = useRef<HTMLButtonElement>(null);
  
  const disabled = status!=='active' || selectedIdx===null || (selectedIdx!==null && used[selectedIdx]);
  const canSelect = selectedIdx !== null && selectedIdx < numbers.length && !disabled;

  const handleBoltComplete = useCallback(() => {
    setBolt(null);
  }, []);

  const handleClick = () => {
    if (disabled || selectedIdx === null) return;
    
    const dir = 'sub';
    
    // Use left cathode for "-" (down)
    const cathodeBottomImg = document.querySelector('[data-cathode-bottom="true"]') as HTMLImageElement;
    
    let fromX: number;
    let fromY: number;
    
    if (cathodeBottomImg) {
      const rect = cathodeBottomImg.getBoundingClientRect();
      fromX = rect.left + rect.width * 0.75;
      fromY = rect.top + rect.height * 0.2;
    } else {
      if (minusButtonRef.current) {
        const rect = minusButtonRef.current.getBoundingClientRect();
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
    <div className={styles.column}>
      <button
        ref={minusButtonRef}
        className={`${styles.orbButton} ${styles.minusButton} ${canSelect ? styles.selectable : ''} ${disabled ? styles.disabled : ''}`}
        onClick={handleClick}
        disabled={disabled}
        aria-label="Minus frequency"
      >
        <span className={styles.buttonSign}>-</span>
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

export function PlusButton() {
  const { selectedIdx, numbers, play, status, used } = useGame();
  const [bolt, setBolt] = useState<{from: {x:number;y:number}, to: {x:number;y:number}} | null>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);
  
  const disabled = status!=='active' || selectedIdx===null || (selectedIdx!==null && used[selectedIdx]);
  const canSelect = selectedIdx !== null && selectedIdx < numbers.length && !disabled;

  const handleBoltComplete = useCallback(() => {
    setBolt(null);
  }, []);

  const handleClick = () => {
    if (disabled || selectedIdx === null) return;
    
    const dir = 'add';
    
    // Use right cathode for "+" (up)
    const cathodeBottomImg = document.querySelector('[data-cathode-bottom-right="true"]') as HTMLImageElement;
    
    let fromX: number;
    let fromY: number;
    
    if (cathodeBottomImg) {
      const rect = cathodeBottomImg.getBoundingClientRect();
      fromX = rect.left + rect.width * 0.25;
      fromY = rect.top + rect.height * 0.2;
    } else {
      if (plusButtonRef.current) {
        const rect = plusButtonRef.current.getBoundingClientRect();
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
    <div className={styles.column}>
      <button
        ref={plusButtonRef}
        className={`${styles.orbButton} ${styles.plusButton} ${canSelect ? styles.selectable : ''} ${disabled ? styles.disabled : ''}`}
        onClick={handleClick}
        disabled={disabled}
        aria-label="Plus frequency"
      >
        <span className={styles.buttonSign}>+</span>
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
