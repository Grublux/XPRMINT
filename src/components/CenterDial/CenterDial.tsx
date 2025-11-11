import { useEffect, useRef } from 'react';
import { useGame } from '../../state/gameStore';
import NumberChips from '../NumberChips/NumberChips';
import styles from './CenterDial.module.css';

export default function CenterDial(){
  const { selectedIdx, numbers, canBuyNumber, buyNumber } = useGame();
  const hasSelection = selectedIdx !== null && selectedIdx < numbers.length;
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  
  // Map number (1-500) to rotation angle (-90 to +90 degrees)
  // Center (250) = 0 degrees, 1 = -90, 500 = +90
  let rotation = 0;
  let selectedNumber = 0;
  if (hasSelection) {
    selectedNumber = numbers[selectedIdx];
    // Normalize to -1 to 1 range (1 -> -1, 250 -> 0, 500 -> 1)
    const normalized = (selectedNumber - 250) / 250;
    // Map to -90 to +90 degrees
    rotation = normalized * 90;
  }

  // Draw waveform for selected number frequency
  useEffect(() => {
    if (!hasSelection) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let raf = 0;
    let startTime = performance.now();
    
    function loop() {
      const w = canvas.width = canvas.clientWidth * devicePixelRatio;
      const h = canvas.height = canvas.clientHeight * devicePixelRatio;
      ctx.clearRect(0, 0, w, h);
      
      // Get time in seconds
      const t = (performance.now() - startTime) / 1000;
      
      // Draw waveform at the ACTUAL frequency (1-500 Hz)
      // Higher frequency = faster oscillation, more cycles
      const baseline = h * 0.5;
      const amp = Math.min(h * 0.35, 20);
      
      // Frequency in Hz: selectedNumber (1-500)
      // For proper frequency representation:
      // - Spatial: number of cycles across width (proportional to frequency)
      // - Temporal: oscillation speed (proportional to frequency)
      const cyclesPerWidth = (selectedNumber / 500) * 4; // 0-4 cycles across width
      const angularFreq = 2 * Math.PI * selectedNumber; // radians per second
      
      ctx.save();
      ctx.translate(0, baseline);
      ctx.lineWidth = 2 * devicePixelRatio;
      ctx.strokeStyle = 'rgba(74, 158, 255, 0.8)';
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2 * devicePixelRatio) {
        // x normalized to 0-1, then multiplied by cycles to get phase
        const phase = (x / w) * cyclesPerWidth * 2 * Math.PI;
        // Time component: frequency determines oscillation speed
        const timePhase = angularFreq * t;
        const y = Math.sin(phase + timePhase) * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
    
    raf = requestAnimationFrame(function tick() {
      loop();
      raf = requestAnimationFrame(tick);
    });
    
    return () => cancelAnimationFrame(raf);
  }, [hasSelection, selectedNumber]);

  const can = canBuyNumber();

  return (
    <div className={styles.container}>
      <div className={styles.waveformWindow}>
        <canvas ref={canvasRef} className={styles.waveformCanvas} />
        {hasSelection && (
          <div className={styles.waveformLabel}>{selectedNumber} Hz</div>
        )}
      </div>
      <div className={styles.dialSection}>
        <div className={styles.dial}>
          <div className={styles.dialFace}>
            <div className={styles.dialCenter}></div>
            {hasSelection && (
              <div 
                className={styles.dialNeedle}
                style={{ transform: `translate(-50%, -100%) rotate(${rotation}deg)` }}
              ></div>
            )}
          </div>
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
    </div>
  );
}
