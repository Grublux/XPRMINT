import { useRef } from 'react';
import { useGame } from '../../state/gameStore';
import NumberChips from '../NumberChips/NumberChips';
import styles from './CenterDial.module.css';

export default function CenterDial(){
  const { selectedIdx, numbers, canBuyNumber, buyNumber } = useGame();
  const hasSelection = selectedIdx !== null && selectedIdx < numbers.length;
  const svgRef = useRef<SVGSVGElement|null>(null);
  
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

  const can = canBuyNumber();

  return (
    <div className={styles.container}>
      <div className={styles.dialSection}>
        {/* Half-moon scale with speedometer-style needle - top half only */}
        <svg ref={svgRef} className={styles.analogSvg} viewBox="0 -10 200 60" preserveAspectRatio="xMidYTop meet">
          <defs>
            <clipPath id="halfCircleClip">
              <rect x="0" y="-10" width="200" height="60" />
            </clipPath>
          </defs>
          <g clipPath="url(#halfCircleClip)">
            {/* Half-moon arc - positioned to align with needle rotation (-90 to +90 degrees) */}
            {/* Arc spans from -90 to +90 degrees relative to center (left to right) */}
            <path
              d="M 20 50 A 80 80 0 0 1 180 50"
              fill="none"
              stroke="rgba(74, 158, 255, 0.3)"
              strokeWidth="2"
            />
            {/* Tick marks along the arc - aligned with needle rotation range */}
            {Array.from({ length: 11 }, (_, i) => {
              // Map from -90 to +90 degrees (matching needle rotation)
              const angle = -90 + (i * 18); // -90 to +90 degrees
              const rad = (angle * Math.PI) / 180;
              const centerX = 100;
              const centerY = 50; // Center vertically in viewBox (bottom of arc)
              const radius = 80;
              const x1 = centerX + radius * Math.cos(rad);
              const y1 = centerY + radius * Math.sin(rad);
              const tickLength = i % 5 === 0 ? 8 : 4; // Longer ticks every 5
              const x2 = centerX + (radius - tickLength) * Math.cos(rad);
              const y2 = centerY + (radius - tickLength) * Math.sin(rad);
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(74, 158, 255, 0.6)"
                  strokeWidth={i % 5 === 0 ? 2 : 1}
                />
              );
            })}
            {/* Speedometer needle - rotates from center bottom of arc */}
            {hasSelection && (
              <g transform={`translate(100, 50) rotate(${rotation})`}>
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="-75"
                  stroke="#4a9eff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {/* Small circle at pivot point */}
                <circle
                  cx="0"
                  cy="0"
                  r="3"
                  fill="#4a9eff"
                />
              </g>
            )}
          </g>
        </svg>
        {hasSelection && (
          <div className={styles.analogLabel}>{selectedNumber} Hz</div>
        )}
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
