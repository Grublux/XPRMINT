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

// Creature mapping: name -> image file
const CREATURE_IMAGES: Record<string, string> = {
  'Ruevee': '/creature_transparent.png',
  'Rose': '/rose_trans.png',
};

const CREATURE_SHOCKED_IMAGES: Record<string, string> = {
  'Ruevee': '/creature_shocked_transparent.png',
  'Rose': '/rose_trans.png', // Use same image for shocked (or add shocked version later)
};

type CreatureCanvasProps = {
  creature?: string;
};

export default function CreatureCanvas({ creature = 'Ruevee' }: CreatureCanvasProps){
  const { resonanceHz, targetHz, pot, lastMoveAt, status } = useGame();
  const cathodeBottomRef = useRef<HTMLImageElement>(null);
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

  // Load creature images based on selected creature
  useEffect(() => {
    const creatureImg = CREATURE_IMAGES[creature] || CREATURE_IMAGES['Ruevee'];
    const shockedImg = CREATURE_SHOCKED_IMAGES[creature] || CREATURE_SHOCKED_IMAGES['Ruevee'];
    
    const img = new Image();
    img.src = creatureImg;
    img.onload = () => {
      creatureImageRef.current = img;
    };
    
    const shockedImage = new Image();
    shockedImage.src = shockedImg;
    shockedImage.onload = () => {
      creatureShockedImageRef.current = shockedImage;
    };
  }, [creature]);

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
      // Position orb lower to sit in the liquid area of the jug
      // On mobile (smaller canvas), position higher (smaller percentage) to keep creature in jug
      // On wider viewports, position higher to shift creature up
      // Shifted lower to accommodate taller jug2 image (115% height)
      const isMobile = clientH < 450; // Detect mobile viewport
      const isWide = clientW > 900; // Detect wide viewport
      let verticalPercent;
      if (isMobile) {
        verticalPercent = 0.65; // Mobile positioning
      } else if (isWide) {
        verticalPercent = 0.65; // Wide viewport positioning
      } else {
        verticalPercent = 0.65; // Desktop positioning
      }
      const refCy = refHeight * verticalPercent;
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
      
      // Calculate base creature image size (needed for target circle calculation)
      // Make creature 1.5x larger across entire gradient
      const baseImageSize = maxOrbRadius * 1.8 * 1.5; // 1.5x larger
      
      // Orb size range
      const minOrbRadius = maxOrbRadius * 0.1; // Minimum 10% of max size at 0 Hz
      const normalizedResonance = Math.min(resonanceHz / 10000, 1); // 0 to 1 - used for visual effects
      
      // Target ring size is always the same - 80% of base creature size (diameter)
      // Radius is 40% of baseImageSize to create a circle that's 80% of the base creature size
      const targetRadius = baseImageSize * 0.4; // Fixed size, independent of target frequency
      
      // Calculate orb size: scale proportionally with frequency ratio
      // When resonanceHz = targetHz, orb should match target circle size exactly
      // When resonanceHz > targetHz, orb should be proportionally larger
      // When resonanceHz < targetHz, orb should be proportionally smaller
      let baseRadius;
      if (targetHz > 0) {
        // Scale proportionally: if specimen is 2x target, orb should be 2x the target circle
        const frequencyRatio = resonanceHz / targetHz;
        baseRadius = targetRadius * frequencyRatio;
        
        // Only clamp minimum to prevent negative/zero sizes
        // Allow orb to exceed maxOrbRadius when frequency is higher (user said it's ok to go outside liquid)
        baseRadius = Math.max(minOrbRadius, baseRadius);
      } else {
        // Fallback: use normalized resonance if target is 0
        baseRadius = minOrbRadius + (maxOrbRadius - minOrbRadius) * normalizedResonance;
      }
      
      // Calculate initial orb breathing for closeness calculation
      const initialBreathingAmplitude = 0.02;
      const initialBreathingSpeed = 0.004;
      const initialIntenseBreathing = 1 + initialBreathingAmplitude * Math.sin(t*initialBreathingSpeed);
      const initialFinalR = baseRadius * initialIntenseBreathing;
      
      // Calculate creature size based on how close frequency is to target
      // Size increases as frequency approaches target from either direction (above or below)
      const minImageSize = baseImageSize * 0.7; // Start at 70% when far from target
      const maxImageSize = baseImageSize * 1.15; // Grow to 115% (15% larger) when matching target
      
      // Calculate closeness based on frequency difference (works from both directions)
      const frequencyDiff = Math.abs(resonanceHz - targetHz); // Distance from target (always positive)
      const maxFrequencyDiff = 10000; // Maximum possible difference (0 to 10000 Hz range)
      // Closeness: 1.0 when matching (diff = 0), 0.0 when maximum difference
      const frequencyCloseness = Math.max(0, 1 - (frequencyDiff / maxFrequencyDiff));
      
      // Creature size based on frequency closeness - grows as it approaches target from either direction
      const creatureBaseSize = minImageSize + (maxImageSize - minImageSize) * frequencyCloseness;
      
      // Calculate match percentage based on frequency difference
      // Match percentage: 100% when frequencies match exactly, 0% when maximum difference
      const matchPercentage = frequencyCloseness * 100; // 0-100%
      
      // Determine match thresholds
      const isWithin10Percent = matchPercentage >= 90; // Within 10% of target
      const isWithin5Percent = matchPercentage >= 95; // Within 5% of target
      
      // Calculate closeness for visual effects (orb vs target ring)
      // targetRadius is already defined above
      const sizeDiff = Math.abs(initialFinalR - targetRadius);
      const maxSizeDiff = maxOrbRadius - minOrbRadius;
      const closeness = Math.max(0, 1 - (sizeDiff / (maxSizeDiff * 0.1)));
      const isClose = closeness > 0.7; // Threshold for "very close"
      
      // Intensity multiplier based on match percentage
      // Within 10%: 1.5x to 2.0x intensity
      // Within 5%: 2.5x to 3.5x intensity (VERY intense)
      let closeIntensity = 1.0;
      if (isWithin5Percent) {
        // Very intense: 2.5x to 3.5x based on how close (95-100%)
        const fivePercentProgress = (matchPercentage - 95) / 5; // 0 to 1
        closeIntensity = 2.5 + (fivePercentProgress * 1.0); // 2.5 to 3.5
      } else if (isWithin10Percent) {
        // More intense: 1.5x to 2.5x based on how close (90-95%)
        const tenPercentProgress = (matchPercentage - 90) / 5; // 0 to 1
        closeIntensity = 1.5 + (tenPercentProgress * 1.0); // 1.5 to 2.5
      } else if (isClose) {
        // Original close intensity
        closeIntensity = 1.0 + (closeness * 1.0);
      }
      
      // Recalculate breathing with intensity based on match percentage
      // Use match percentage thresholds for breathing intensity
      const useIntenseBreathing = isWithin10Percent || isClose;
      const breathingAmplitude = useIntenseBreathing ? 0.04 * closeIntensity : 0.02;
      const breathingSpeed = useIntenseBreathing ? (isWithin5Percent ? 0.008 : 0.006) : 0.004; // Faster breathing when close, even faster within 5%
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
      const ringCount = 2 + Math.floor(5 * normalizedResonance) + (isWithin10Percent ? 2 : 0); // More rings when close
      const useIntensePulses = isWithin10Percent || isClose;
      const pulseSpeed = useIntensePulses ? (isWithin5Percent ? 0.0035 : 0.0025) : 0.0015; // Faster pulses when close, even faster within 5%
      // Shock effect: more intense pulses when shocked (reduced from 0.5 to 0.25)
      const shockPulseBoost = 1 + currentShockIntensity * 0.25;
      for (let i=0; i<ringCount; i++){
        const k = (i + (t*pulseSpeed)) % 1;
        const rr = finalR * (1.4 + k*1.1);
        const baseAlpha = (1-k) * (0.25 + 0.40*normalizedResonance);
        const alpha = useIntensePulses 
          ? Math.min(1, baseAlpha * closeIntensity * shockPulseBoost)
          : baseAlpha * shockPulseBoost;
        ctx.beginPath();
        ctx.arc(shockCx, shockCy, rr, 0, Math.PI*2);
        ctx.strokeStyle = currentShockIntensity > 0
          ? `rgba(200, 240, 255, ${Math.min(1, alpha)})`
          : `rgba(255,255,255,${alpha})`;
        const lineWidth = useIntensePulses 
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
      const useIntenseOrb = isWithin10Percent || isClose;
      const intensity = useIntenseOrb ? Math.min(0.7, baseIntensity * closeIntensity) : baseIntensity;
      const coreAlpha = useIntenseOrb 
        ? Math.min(0.7, (0.3 + 0.15*normalizedResonance) * closeIntensity * shockBrightness)
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
      
      // Hard edge/membrane - brighter when shocked or close
      const useIntenseEdge = isWithin10Percent || isClose;
      const edgeAlpha = useIntenseEdge 
        ? Math.min(0.9, (0.5 + 0.2*normalizedResonance) * closeIntensity * (1 + currentShockIntensity * 0.15))
        : (0.5 + 0.2*normalizedResonance) * (1 + currentShockIntensity * 0.15);
      ctx.beginPath();
      ctx.arc(shockCx, shockCy, finalR, 0, Math.PI*2);
      ctx.strokeStyle = currentShockIntensity > 0 
        ? `rgba(${100 + currentShockIntensity * 25}, ${100 + currentShockIntensity * 25}, ${150 + currentShockIntensity * 25}, ${edgeAlpha})`
        : `rgba(80, 80, 100, ${edgeAlpha})`;
      ctx.lineWidth = Math.max(1, 2.5 * devicePixelRatio * (1 + currentShockIntensity * 0.1));
      ctx.stroke();

      // Draw target frequency circle - red when orb is larger, gold when smaller
      // Intensity increases when close, blinking when within 10%
      const orbLarger = finalR > targetRadius;
      const overshootAmount = orbLarger ? Math.min(1, (finalR - targetRadius) / (maxOrbRadius * 0.2)) : 0; // How much larger (0-1)
      
      // Interpolate from gold (255, 215, 0) to red (255, 0, 0) when orb is larger
      // Shock effect: make target circle brighter and more electric
      const targetR = 255;
      const targetG = orbLarger ? Math.floor(215 * (1 - overshootAmount)) : 215;
      const targetB = orbLarger ? 0 : (currentShockIntensity > 0 ? Math.floor(currentShockIntensity * 50) : 0);
      
      // Blinking effect when within 10% - faster blink within 5%
      let targetAlpha;
      if (isWithin10Percent) {
        const blinkSpeed = isWithin5Percent ? 0.02 : 0.015; // Faster blink within 5%
        const blinkPhase = Math.sin(t * blinkSpeed);
        const blinkAmount = (blinkPhase + 1) / 2; // 0 to 1
        const baseAlpha = 0.8 * closeIntensity * (1 + currentShockIntensity * 0.15);
        targetAlpha = baseAlpha * (0.5 + blinkAmount * 0.5); // Blink between 50% and 100% of base alpha
      } else {
        const useIntenseTarget = isClose;
        targetAlpha = useIntenseTarget 
          ? Math.min(1, 0.8 * closeIntensity * (1 + currentShockIntensity * 0.15))
          : 0.8 * (1 + currentShockIntensity * 0.15);
      }
      
      ctx.beginPath();
      ctx.arc(shockCx, shockCy, targetRadius, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(${targetR}, ${targetG}, ${targetB}, ${targetAlpha})`;
      const useIntenseTarget = isWithin10Percent || isClose;
      const targetLineWidth = useIntenseTarget 
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

  return (
    <div className={styles.container}>
      <div className={styles.infoBar}>
        <div className={styles.potSection}>
          <div className={styles.potLabel}>Pot Size</div>
          <div className={styles.potValue}>{pot.toLocaleString()} NGT</div>
        </div>
        <div className={styles.headerCenter}>
          <div className={styles.titleText}>XPRMINT</div>
        </div>
        <div className={styles.timerSection}>
          <div className={styles.timerLabel}>XPRMINT Fails In:</div>
          <div className={`${styles.timerValue} ${danger ? styles.timerDanger : ''}`}>{label}</div>
        </div>
      </div>
      <div className={styles.panel}>
        <div className={styles.frequencyTopLeft}>
          <div className={styles.targetSection}>
            <div className={styles.targetLabel}>Target</div>
            <div className={styles.targetValue}>{Math.round(targetHz)} Hz</div>
          </div>
        </div>
        <div className={styles.frequencyTopRight}>
          <div className={`${styles.resonanceDisplay} ${resonanceHz > targetHz ? styles.resonanceAbove : styles.resonanceBelow}`}>
            <div className={styles.currentLabel}>Specimen</div>
            <div className={styles.resonanceValue}>{Math.round(resonanceHz)} Hz</div>
          </div>
        </div>
        <canvas ref={ref} className={styles.canvas} data-specimen-canvas="true" />
        <img 
          ref={cathodeBottomRef}
          src="/cathode_bottom.png" 
          alt="Cathode bottom" 
          className={styles.cathodeBottom}
          data-cathode-bottom="true"
        />
      </div>
    </div>
  );
}

