import { useEffect, useRef } from 'react';
import { useGame } from '../../state/gameStore';
import styles from './CreatureCanvas.module.css';

type Bubble = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  opacity: number;
};

export default function CreatureCanvas(){
  const { resonanceHz, targetHz } = useGame();
  const ref = useRef<HTMLCanvasElement|null>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const lastBubbleSpawnRef = useRef<number>(0);

  useEffect(()=>{
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let raf=0;

    function loop(t:number){
      const w = canvas.width = canvas.clientWidth * devicePixelRatio;
      const h = canvas.height = canvas.clientHeight * devicePixelRatio;
      ctx.clearRect(0,0,w,h);

      // Center horizontally (adjust offset if background tank appears off-center)
      const cx = w/2 + (w * 0.01); // +1% offset to right (adjust as needed)
      // Position orb lower to sit in the liquid area of the jug (around 65% down)
      const cy = h * 0.65;

      // Scale orb size based on resonanceHz (0 to 10,000 Hz)
      // At 10,000 Hz, orb should fit exactly in the tank
      // Calculate maximum orb size to fit in tank (tank is roughly 60% of width, centered)
      const tankWidth = w * 0.6; // Tank takes up ~60% of canvas width
      const tankHeight = h * 0.4; // Tank takes up ~40% of canvas height (in lower portion)
      const maxOrbDiameter = Math.min(tankWidth, tankHeight); // Use smaller dimension to ensure it fits
      const maxOrbRadius = maxOrbDiameter / 2;
      
      // Scale from 0 Hz (min size) to 10,000 Hz (max size)
      const minOrbRadius = maxOrbRadius * 0.1; // Minimum 10% of max size at 0 Hz
      const normalizedResonance = Math.min(resonanceHz / 10000, 1); // 0 to 1
      const baseRadius = minOrbRadius + (maxOrbRadius - minOrbRadius) * normalizedResonance;
      
      // Calculate target frequency circle size
      const normalizedTarget = Math.min(targetHz / 10000, 1); // 0 to 1
      const targetRadius = minOrbRadius + (maxOrbRadius - minOrbRadius) * normalizedTarget;
      
      // Calculate closeness to target (0 = far, 1 = perfect match) - use base radius for stable calculation
      const sizeDiff = Math.abs(baseRadius - targetRadius);
      const maxSizeDiff = maxOrbRadius - minOrbRadius;
      const closeness = Math.max(0, 1 - (sizeDiff / (maxSizeDiff * 0.1))); // Close when within 10% of max range
      const isClose = closeness > 0.7; // Threshold for "very close"
      
      // Intensity multiplier when close (1.0 to 2.0)
      const closeIntensity = 1.0 + (closeness * 1.0);
      
      // Recalculate breathing with intensity when close
      const breathingAmplitude = isClose ? 0.04 * closeIntensity : 0.02;
      const breathingSpeed = isClose ? 0.006 : 0.004; // Faster breathing when close
      const intenseBreathing = 1 + breathingAmplitude * Math.sin(t*breathingSpeed);
      const finalR = baseRadius * intenseBreathing;

      // Bubble system - spawn rate increases with frequency
      // Spawn rate: 0 Hz = 1 bubble per 3 seconds, 10k Hz = 20 bubbles per second (faster boiling)
      const minSpawnInterval = 3000; // 3 seconds at 0 Hz
      const maxSpawnInterval = 50; // 0.05 seconds at 10k Hz (faster)
      const spawnInterval = minSpawnInterval - (minSpawnInterval - maxSpawnInterval) * normalizedResonance;
      
      // Liquid area bounds - bubbles should stay within liquid
      // Orb is at 65% down, keep bubbles in lower liquid area
      const liquidTop = h * 0.45; // Top of liquid area - keep bubbles lower
      const liquidBottom = h * 0.80; // Bottom of liquid area

      // Spawn new bubbles
      if (t - lastBubbleSpawnRef.current > spawnInterval) {
        const bubble: Bubble = {
          x: cx + (Math.random() - 0.5) * (w * 0.3), // Spawn near center, some variation
          y: liquidBottom, // Bottom of liquid area
          radius: 2 + Math.random() * 4 * devicePixelRatio,
          speed: 0.3 + Math.random() * 0.5, // Pixels per frame
          opacity: 0.3 + Math.random() * 0.4
        };
        bubblesRef.current.push(bubble);
        lastBubbleSpawnRef.current = t;
      }

      // Update and draw bubbles (draw before orb so they appear behind)
      bubblesRef.current = bubblesRef.current.filter(bubble => {
        bubble.y -= bubble.speed * devicePixelRatio;
        bubble.opacity *= 0.998; // Fade slightly as they rise
        
        // Remove if above liquid surface
        if (bubble.y < liquidTop) {
          return false;
        }
        
        // Draw bubble only if within liquid area
        if (bubble.y >= liquidTop && bubble.y <= liquidBottom) {
          ctx.beginPath();
          ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI*2);
          ctx.fillStyle = `rgba(255, 255, 255, ${bubble.opacity})`;
          ctx.fill();
          // Bubble highlight
          ctx.beginPath();
          ctx.arc(bubble.x - bubble.radius * 0.3, bubble.y - bubble.radius * 0.3, bubble.radius * 0.4, 0, Math.PI*2);
          ctx.fillStyle = `rgba(255, 255, 255, ${bubble.opacity * 0.6})`;
          ctx.fill();
        }
        
        // Keep bubble if still in liquid and not faded out
        return bubble.y >= liquidTop && bubble.opacity > 0.05;
      });

      // Pulse rings - number increases with resonance, intensity increases when close
      const ringCount = 2 + Math.floor(5 * normalizedResonance);
      const pulseSpeed = isClose ? 0.0025 : 0.0015; // Faster pulses when close
      for (let i=0; i<ringCount; i++){
        const k = (i + (t*pulseSpeed)) % 1;
        const rr = finalR * (1.4 + k*1.1);
        const baseAlpha = (1-k) * (0.25 + 0.40*normalizedResonance);
        const alpha = isClose ? Math.min(1, baseAlpha * closeIntensity) : baseAlpha;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI*2);
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        const lineWidth = isClose 
          ? Math.max(1, 3*devicePixelRatio*(0.7 + 0.7*normalizedResonance) * closeIntensity)
          : Math.max(1, 3*devicePixelRatio*(0.7 + 0.7*normalizedResonance));
        ctx.lineWidth = lineWidth;
        ctx.globalAlpha = alpha;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Specimen orb (ball) - transparent cell/protozoa appearance with hard edge
      const coreGradient = ctx.createRadialGradient(cx, cy, finalR*0.25, cx, cy, finalR);
      // More transparent - cell-like appearance (0.25 to 0.45 opacity)
      const baseIntensity = 0.25 + 0.2 * normalizedResonance;
      const intensity = isClose ? Math.min(0.5, baseIntensity * closeIntensity) : baseIntensity;
      const coreAlpha = isClose 
        ? Math.min(0.5, (0.3 + 0.15*normalizedResonance) * closeIntensity)
        : (0.3 + 0.15*normalizedResonance);
      // Slightly warmer, more organic colors for cell appearance
      coreGradient.addColorStop(0, `rgba(255,255,255,${coreAlpha})`);
      coreGradient.addColorStop(0.5, `rgba(240,240,250,${intensity * 0.8})`);
      coreGradient.addColorStop(1, `rgba(220,220,240,${intensity * 0.6})`);
      ctx.fillStyle = coreGradient; 
      ctx.beginPath(); 
      ctx.arc(cx, cy, finalR, 0, Math.PI*2); 
      ctx.fill();
      
      // Hard edge/membrane - dark cell wall effect
      const edgeAlpha = isClose 
        ? Math.min(0.7, (0.5 + 0.2*normalizedResonance) * closeIntensity)
        : (0.5 + 0.2*normalizedResonance);
      ctx.beginPath();
      ctx.arc(cx, cy, finalR, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(80, 80, 100, ${edgeAlpha})`;
      ctx.lineWidth = Math.max(1, 2.5 * devicePixelRatio);
      ctx.stroke();

      // Draw target frequency circle - red when orb is larger, gold when smaller
      // Intensity increases when close
      const orbLarger = finalR > targetRadius;
      const overshootAmount = orbLarger ? Math.min(1, (finalR - targetRadius) / (maxOrbRadius * 0.2)) : 0; // How much larger (0-1)
      
      // Interpolate from gold (255, 215, 0) to red (255, 0, 0) when orb is larger
      const targetR = 255;
      const targetG = orbLarger ? Math.floor(215 * (1 - overshootAmount)) : 215;
      const targetB = orbLarger ? 0 : 0;
      const targetAlpha = isClose ? Math.min(1, 0.8 * closeIntensity) : 0.8;
      
      ctx.beginPath();
      ctx.arc(cx, cy, targetRadius, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(${targetR}, ${targetG}, ${targetB}, ${targetAlpha})`;
      const targetLineWidth = isClose 
        ? Math.max(2, 5 * devicePixelRatio * closeIntensity)
        : Math.max(2, 4 * devicePixelRatio);
      ctx.lineWidth = targetLineWidth;
      ctx.setLineDash([8, 4]); // Dashed line
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      raf=requestAnimationFrame(loop);
    }
    raf=requestAnimationFrame(loop);
    return ()=> cancelAnimationFrame(raf);
  }, [resonanceHz, targetHz]);

  const isBelow = resonanceHz < targetHz;
  const isAbove = resonanceHz > targetHz;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {isBelow ? (
            <div className={styles.resonanceDisplay}>
              <div className={styles.currentLabel}>Current ν</div>
              <div className={styles.resonanceValue}>{Math.round(resonanceHz)} Hz</div>
            </div>
          ) : null}
        </div>
        <div className={styles.headerCenter}>
          <div className={styles.targetLabel}>Target Frequency</div>
          <div className={styles.targetValue}>{Math.round(targetHz)} Hz</div>
        </div>
        <div className={styles.headerRight}>
          {isAbove ? (
            <div className={styles.resonanceDisplay}>
              <div className={styles.currentLabel}>Current ν</div>
              <div className={styles.resonanceValue}>{Math.round(resonanceHz)} Hz</div>
            </div>
          ) : null}
        </div>
      </div>
      <div className={styles.panel}>
        <canvas ref={ref} className={styles.canvas} data-specimen-canvas="true" />
      </div>
    </div>
  );
}

