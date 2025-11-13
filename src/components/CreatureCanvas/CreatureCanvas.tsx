import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../state/gameStore';
import { useTimer } from '../../hooks/useTimer';
import styles from './CreatureCanvas.module.css';

type Bubble = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  opacity: number;
};

export default function CreatureCanvas(){
  const { resonanceHz, targetHz, pot, lastMoveAt, status } = useGame();
  const { label, remaining } = useTimer(lastMoveAt);
  const danger = remaining <= 60_000 && status==='active';
  const ref = useRef<HTMLCanvasElement|null>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const lastBubbleSpawnRef = useRef<number>(0);
  const [shockIntensity, setShockIntensity] = useState(0);
  const shockRef = useRef<number>(0);
  const shockIntensityRef = useRef<number>(0);
  const creatureImageRef = useRef<HTMLImageElement | null>(null);
  const creatureShockedImageRef = useRef<HTMLImageElement | null>(null);

  // Load creature images
  useEffect(() => {
    const img = new Image();
    img.src = '/creature_transparent.png';
    img.onload = () => {
      creatureImageRef.current = img;
    };
    
    const shockedImg = new Image();
    shockedImg.src = '/creature_shocked_transparent.png';
    shockedImg.onload = () => {
      creatureShockedImageRef.current = shockedImg;
    };
  }, []);

  // Listen for lightning strikes
  useEffect(() => {
    const handleBoltHit = () => {
      shockRef.current = Date.now();
      shockIntensityRef.current = 1.0;
      setShockIntensity(1.0);
    };
    
    window.addEventListener('bolt-hit', handleBoltHit);
    return () => window.removeEventListener('bolt-hit', handleBoltHit);
  }, []);

  useEffect(()=>{
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let raf=0;

    function loop(t:number){
      const clientW = canvas.clientWidth;
      const clientH = canvas.clientHeight;
      const w = canvas.width = clientW * devicePixelRatio;
      const h = canvas.height = clientH * devicePixelRatio;
      ctx.clearRect(0,0,w,h);
      
      // Scale factor for mobile - normalize to base canvas size (550px height reference)
      const canvasScale = Math.min(clientW, clientH) / 550;

      // Update shock intensity (fade out over 300ms)
      // Use ref to avoid re-renders every frame
      if (shockIntensityRef.current > 0) {
        const shockAge = Date.now() - shockRef.current;
        const newIntensity = Math.max(0, 1 - (shockAge / 300));
        shockIntensityRef.current = newIntensity;
        // Only update state occasionally to avoid too many re-renders
        if (Math.abs(newIntensity - shockIntensity) > 0.1 || newIntensity === 0) {
          setShockIntensity(newIntensity);
        }
      }

      // Use fixed reference dimensions (550px height) for consistent positioning across viewports
      const refHeight = 550;
      const refWidth = 550 * 932 / 1127; // Maintain aspect ratio
      const scaleX = w / refWidth;
      const scaleY = h / refHeight;
      
      // Calculate position based on reference size, then scale to actual canvas
      // Center horizontally (adjust offset if background tank appears off-center)
      const refCx = refWidth / 2 + (refWidth * 0.01); // +1% offset to right
      const cx = refCx * scaleX;
      // Position orb lower to sit in the liquid area of the jug (around 65% down from reference)
      const refCy = refHeight * 0.65;
      const cy = refCy * scaleY;
      
      // Shock effect: add random shake offset when shocked
      // Use ref value for smooth animation without re-renders
      const currentShockIntensity = shockIntensityRef.current;
      const shockShake = currentShockIntensity > 0 ? (Math.random() - 0.5) * currentShockIntensity * 4 : 0; // Reduced from 8 to 4
      const shockCx = cx + shockShake;
      const shockCy = cy + shockShake;

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
      
      // Target ring size will be calculated later to match creature's current size
      
      // Calculate initial orb breathing for closeness calculation
      const initialBreathingAmplitude = 0.02;
      const initialBreathingSpeed = 0.004;
      const initialIntenseBreathing = 1 + initialBreathingAmplitude * Math.sin(t*initialBreathingSpeed);
      const initialFinalR = baseRadius * initialIntenseBreathing;
      
      // Calculate creature size based on how close frequency is to target
      // Size increases as frequency approaches target from either direction (above or below)
      // Make creature 1.5x larger across entire gradient
      const baseImageSize = maxOrbRadius * 1.8 * 1.5; // 1.5x larger
      const minImageSize = baseImageSize * 0.7; // Start at 70% when far from target
      const maxImageSize = baseImageSize * 1.15; // Grow to 115% (15% larger) when matching target
      
      // Calculate closeness based on frequency difference (works from both directions)
      const frequencyDiff = Math.abs(resonanceHz - targetHz); // Distance from target (always positive)
      const maxFrequencyDiff = 10000; // Maximum possible difference (0 to 10000 Hz range)
      // Closeness: 1.0 when matching (diff = 0), 0.0 when maximum difference
      const frequencyCloseness = Math.max(0, 1 - (frequencyDiff / maxFrequencyDiff));
      
      // Creature size based on frequency closeness - grows as it approaches target from either direction
      const creatureBaseSize = minImageSize + (maxImageSize - minImageSize) * frequencyCloseness;
      
      // Target ring size matches creature size (10% smaller)
      const targetRadius = (creatureBaseSize / 2) * 0.9;
      
      // Calculate closeness for visual effects (orb vs target ring)
      const sizeDiff = Math.abs(initialFinalR - targetRadius);
      const maxSizeDiff = maxOrbRadius - minOrbRadius;
      const closeness = Math.max(0, 1 - (sizeDiff / (maxSizeDiff * 0.1)));
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
      // Scale line width based on canvas size for proper mobile scaling
      const baseLineWidth = Math.max(1, 3 * devicePixelRatio * canvasScale);
      const ringCount = 2 + Math.floor(5 * normalizedResonance);
      const pulseSpeed = isClose ? 0.0025 : 0.0015; // Faster pulses when close
      // Shock effect: more intense pulses when shocked (reduced from 0.5 to 0.25)
      const shockPulseBoost = 1 + currentShockIntensity * 0.25;
      for (let i=0; i<ringCount; i++){
        const k = (i + (t*pulseSpeed)) % 1;
        const rr = finalR * (1.4 + k*1.1);
        const baseAlpha = (1-k) * (0.25 + 0.40*normalizedResonance);
        const alpha = isClose 
          ? Math.min(1, baseAlpha * closeIntensity * shockPulseBoost)
          : baseAlpha * shockPulseBoost;
        ctx.beginPath();
        ctx.arc(shockCx, shockCy, rr, 0, Math.PI*2);
        ctx.strokeStyle = currentShockIntensity > 0
          ? `rgba(200, 240, 255, ${Math.min(1, alpha)})`
          : `rgba(255,255,255,${alpha})`;
        const lineWidth = isClose 
          ? Math.max(1, baseLineWidth * (0.7 + 0.7*normalizedResonance) * closeIntensity * shockPulseBoost)
          : Math.max(1, baseLineWidth * (0.7 + 0.7*normalizedResonance) * shockPulseBoost);
        ctx.lineWidth = lineWidth;
        ctx.globalAlpha = alpha;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Specimen orb (ball) - transparent cell/protozoa appearance with hard edge
      // Apply shock effect: make orb brighter and more intense when shocked (reduced from 0.5 to 0.25)
      const shockBrightness = 1 + currentShockIntensity * 0.25; // 25% brighter when shocked
      const coreGradient = ctx.createRadialGradient(shockCx, shockCy, finalR*0.25, shockCx, shockCy, finalR);
      // More transparent - cell-like appearance (0.25 to 0.45 opacity)
      const baseIntensity = 0.25 + 0.2 * normalizedResonance;
      const intensity = isClose ? Math.min(0.5, baseIntensity * closeIntensity) : baseIntensity;
      const coreAlpha = isClose 
        ? Math.min(0.5, (0.3 + 0.15*normalizedResonance) * closeIntensity * shockBrightness)
        : (0.3 + 0.15*normalizedResonance) * shockBrightness;
      // Brighter, more electric colors when shocked
      const shockR = currentShockIntensity > 0 ? 255 : 255;
      const shockG = currentShockIntensity > 0 ? 240 + currentShockIntensity * 15 : 240;
      const shockB = currentShockIntensity > 0 ? 250 + currentShockIntensity * 5 : 250;
      coreGradient.addColorStop(0, `rgba(${shockR},${shockG},${shockB},${Math.min(1, coreAlpha)})`);
      coreGradient.addColorStop(0.5, `rgba(${shockR * 0.94},${shockG * 0.94},${shockB},${intensity * 0.8 * shockBrightness})`);
      coreGradient.addColorStop(1, `rgba(${shockR * 0.86},${shockG * 0.86},${shockB * 0.94},${intensity * 0.6 * shockBrightness})`);
      ctx.fillStyle = coreGradient; 
      ctx.beginPath(); 
      ctx.arc(shockCx, shockCy, finalR, 0, Math.PI*2); 
      ctx.fill();
      
      // Draw creature image - separate from orb, not clipped
      // Use shocked image when shocked, normal image otherwise
      const isShocked = currentShockIntensity > 0;
      const creatureImg = isShocked && creatureShockedImageRef.current?.complete 
        ? creatureShockedImageRef.current 
        : creatureImageRef.current;
      
      if (creatureImg && creatureImg.complete) {
        // Creature size is based on frequency closeness (calculated above)
        // Add pulse animation to creature image (independent of orb pulse)
        const creaturePulseAmplitude = 0.05; // Reduced from 0.08 to 0.05 (5% pulse)
        const creaturePulseSpeed = 0.008; // Slightly faster than orb breathing
        const creaturePulse = 1 + creaturePulseAmplitude * Math.sin(t * creaturePulseSpeed);
        const imageSize = creatureBaseSize * creaturePulse;
        
        // Add vertical bounce animation
        const bounceAmplitude = maxOrbRadius * 0.15; // 15% of max orb radius
        const bounceSpeed = 0.005; // Bounce speed
        const bounceOffset = bounceAmplitude * Math.sin(t * bounceSpeed);
        
        // Center image on orb with bounce offset, moved up slightly
        const verticalOffset = -maxOrbRadius * 0.1; // Move up by 10% of max orb radius
        const imageX = shockCx - imageSize / 2;
        const imageY = shockCy - imageSize / 2 + bounceOffset + verticalOffset;
        
        // Make creature brighter - draw with lighter composite mode
        const savedComposite = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = 'lighten'; // Makes image brighter while preserving colors
        ctx.globalAlpha = 1.0; // Full opacity for brightness
        // Draw the creature image (not clipped, so it remains visible even when orb is smaller)
        ctx.drawImage(
          creatureImg,
          imageX,
          imageY,
          imageSize,
          imageSize
        );
        // Draw again with normal mode for full visibility
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.8; // Additional pass for brightness
        ctx.drawImage(
          creatureImg,
          imageX,
          imageY,
          imageSize,
          imageSize
        );
        ctx.globalCompositeOperation = savedComposite;
        ctx.globalAlpha = 1.0; // Reset to full opacity
      }
      
      // Hard edge/membrane - brighter when shocked
      const edgeAlpha = isClose 
        ? Math.min(0.7, (0.5 + 0.2*normalizedResonance) * closeIntensity * (1 + currentShockIntensity * 0.15))
        : (0.5 + 0.2*normalizedResonance) * (1 + currentShockIntensity * 0.15);
      ctx.beginPath();
      ctx.arc(shockCx, shockCy, finalR, 0, Math.PI*2);
      ctx.strokeStyle = currentShockIntensity > 0 
        ? `rgba(${100 + currentShockIntensity * 25}, ${100 + currentShockIntensity * 25}, ${150 + currentShockIntensity * 25}, ${edgeAlpha})`
        : `rgba(80, 80, 100, ${edgeAlpha})`;
      ctx.lineWidth = Math.max(1, 2.5 * devicePixelRatio * (1 + currentShockIntensity * 0.1));
      ctx.stroke();

      // Draw target frequency circle - red when orb is larger, gold when smaller
      // Intensity increases when close
      const orbLarger = finalR > targetRadius;
      const overshootAmount = orbLarger ? Math.min(1, (finalR - targetRadius) / (maxOrbRadius * 0.2)) : 0; // How much larger (0-1)
      
      // Interpolate from gold (255, 215, 0) to red (255, 0, 0) when orb is larger
      // Shock effect: make target circle brighter and more electric
      const targetR = 255;
      const targetG = orbLarger ? Math.floor(215 * (1 - overshootAmount)) : 215;
      const targetB = orbLarger ? 0 : (currentShockIntensity > 0 ? Math.floor(currentShockIntensity * 50) : 0);
      const targetAlpha = isClose 
        ? Math.min(1, 0.8 * closeIntensity * (1 + currentShockIntensity * 0.15))
        : 0.8 * (1 + currentShockIntensity * 0.15);
      
      ctx.beginPath();
      ctx.arc(shockCx, shockCy, targetRadius, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(${targetR}, ${targetG}, ${targetB}, ${targetAlpha})`;
      const targetLineWidth = isClose 
        ? Math.max(2, 5 * devicePixelRatio * closeIntensity * (1 + currentShockIntensity * 0.1))
        : Math.max(2, 4 * devicePixelRatio * (1 + currentShockIntensity * 0.1));
      ctx.lineWidth = targetLineWidth;
      ctx.setLineDash([8, 4]); // Dashed line
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash
      
      // Shock effect: draw electrical sparks around orb when shocked
      if (currentShockIntensity > 0) {
        const sparkCount = 6; // Reduced from 8 to 6
        for (let i = 0; i < sparkCount; i++) {
          const angle = (i / sparkCount) * Math.PI * 2;
          const sparkLength = finalR * (1.1 + Math.random() * 0.2) * currentShockIntensity; // Reduced from 1.2 + 0.3
          const sparkX = shockCx + Math.cos(angle) * sparkLength;
          const sparkY = shockCy + Math.sin(angle) * sparkLength;
          
          ctx.beginPath();
          ctx.moveTo(shockCx, shockCy);
          ctx.lineTo(sparkX, sparkY);
          ctx.strokeStyle = `rgba(200, 240, 255, ${currentShockIntensity * 0.5})`; // Reduced from 0.8 to 0.5
          ctx.lineWidth = Math.max(1, 1.5 * devicePixelRatio * currentShockIntensity); // Reduced from 2 to 1.5
          ctx.stroke();
        }
        
        // Shock effect: bright flash overlay on vessel (drawn last so it's on top) - reduced intensity
        const flashAlpha = currentShockIntensity * 0.15; // Reduced from 0.3 to 0.15
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
        ctx.fillRect(0, 0, w, h);
      }

      raf=requestAnimationFrame(loop);
    }
    raf=requestAnimationFrame(loop);
    return ()=> cancelAnimationFrame(raf);
  }, [resonanceHz, targetHz]);

  const isBelow = resonanceHz < targetHz;
  const isAbove = resonanceHz > targetHz;

  return (
    <div className={styles.container}>
      <div className={styles.infoBar}>
        <div className={styles.potSection}>
          <div className={styles.potLabel}>Pot Size</div>
          <div className={styles.potValue}>{pot.toLocaleString()} NGT</div>
        </div>
        <div className={styles.timerSection}>
          <div className={styles.timerLabel}>Experiment Fails In:</div>
          <div className={`${styles.timerValue} ${danger ? styles.timerDanger : ''}`}>{label}</div>
        </div>
      </div>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {isBelow ? (
            <div className={styles.resonanceDisplay}>
              <div className={styles.currentLabel}>Pulse</div>
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
              <div className={styles.currentLabel}>Pulse</div>
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

