import { useEffect, useRef, useState, useMemo } from 'react';
import { useGame } from '../../state/gameStore';
// import { useTimer } from '../../hooks/useTimer'; // Commented out - timer feature removed
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
  'Slime': '/Slime_fixed.webp',
  'Bob': '/creature_transparent.png',
};

const CREATURE_SHOCKED_IMAGES: Record<string, string> = {
  'Ruevee': '/creature_shocked_transparent.png',
  'Rose': '/rose_trans.png', // Use same image for shocked (or add shocked version later)
  'Slime': '/slime1_shockeda.png',
  'Bob': '/creature_shocked_transparent.png',
};

type CreatureCanvasProps = {
  creature?: string;
};

export default function CreatureCanvas({ creature = 'Ruevee' }: CreatureCanvasProps){
  const { resonanceHz, targetHz } = useGame();
  const [selectedTrait, setSelectedTrait] = useState<string>('Frequency');
  const [selectedGoob, setSelectedGoob] = useState<number>(Math.floor(Math.random() * 2700) + 1);
  const [showGoobDropdown, setShowGoobDropdown] = useState<boolean>(false);
  const [vibes] = useState<number>(100); // TODO: Connect to actual vibes value
  const cathodeBottomRef = useRef<HTMLImageElement>(null);
  const cathodeBottomRightRef = useRef<HTMLImageElement>(null);
  // Timer logic commented out - timer feature removed
  // const { label, remaining } = useTimer(lastMoveAt);
  // const danger = remaining <= 60_000 && status==='active';
  
  // Calculate closest hit from recent moves
  // const closestHit = useMemo(() => {
  //   if (recentMoves.length === 0) return null;
  //   let closestDistance = Infinity;
  //   let closestFreq = null;
  //   recentMoves.forEach(move => {
  //     const distance = Math.abs(move.frequency - targetHz);
  //     if (distance < closestDistance) {
  //       closestDistance = distance;
  //       closestFreq = move.frequency;
  //     }
  //   });
  //   return closestFreq;
  // }, [recentMoves, targetHz]);
  
  // Calculate player's rank (using same logic as MovesTicker)
  // Use a seeded random generator based on targetHz to keep mock players stable
  // Commented out - not currently used in UI
  // const playerRank = useMemo(() => {
  //   // Seed-based random function for consistent mock players per target
  //   const seededRandom = (seed: number) => {
  //     const x = Math.sin(seed) * 10000;
  //     return x - Math.floor(x);
  //   };
  //   
  //   const seed = targetHz; // Use targetHz as seed so mock players are consistent per round
  //   
  //   // Generate 6 stable mock players based on targetHz seed
  //   const randomPlayers: Array<{ distance: number }> = [];
  //   for (let i = 0; i < 6; i++) {
  //     const frequency = Math.floor(seededRandom(seed + i) * 10000);
  //     const distance = Math.abs(frequency - targetHz);
  //     randomPlayers.push({ distance });
  //   }
  //   
  //   // Add player
  //   const playerDistance = Math.abs(resonanceHz - targetHz);
  //   const allPlayers = [...randomPlayers, { distance: playerDistance }];
  //   
  //   // Sort by distance (closest first) and find player's rank
  //   const sorted = [...allPlayers].sort((a, b) => a.distance - b.distance);
  //   const rank = sorted.findIndex(p => p.distance === playerDistance) + 1;
  //   return rank;
  // }, [resonanceHz, targetHz]);
  
  // Format player distance from target
  // Commented out - not currently used in UI
  // const playerDistanceFormatted = (() => {
  //   const diff = resonanceHz - targetHz;
  //   return diff >= 0 ? `+${Math.round(diff)} Hz` : `${Math.round(diff)} Hz`;
  // })();
  
  // Format closest hit distance - always show ± format
  // const closestHitDistance = closestHit !== null ? Math.abs(closestHit - targetHz) : 0;
  // const closestHitFormatted = closestHit !== null
  //   ? `±${Math.round(closestHitDistance)} Hz`
  //   : '±-- Hz';
  
  // Calculate current distance from target
  // const currentDistance = resonanceHz - targetHz;
  // const currentDistanceFormatted = currentDistance >= 0 
  //   ? `+${Math.round(currentDistance)} Hz` 
  //   : `${Math.round(currentDistance)} Hz`;
  const ref = useRef<HTMLCanvasElement|null>(null);
  const skyRef = useRef<HTMLCanvasElement|null>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const lastBubbleSpawnRef = useRef<number>(0);
  const [shockIntensity, setShockIntensity] = useState(0);
  const shockRef = useRef<number>(0);
  const shockIntensityRef = useRef<number>(0);
  const creatureImageRef = useRef<HTMLImageElement | null>(null);
  const creatureShockedImageRef = useRef<HTMLImageElement | null>(null);
  const creatureImgElementRef = useRef<HTMLImageElement | null>(null);
  const creaturePositionRef = useRef<{ x: number; y: number; size: number } | null>(null);
  const rueveeRef = useRef<{ width: number; height: number } | null>(null);

  // Load Ruevee first to get reference dimensions
  useEffect(() => {
    const rueveeImg = new Image();
    rueveeImg.src = CREATURE_IMAGES['Ruevee'];
    rueveeImg.onload = () => {
      rueveeRef.current = {
        width: rueveeImg.width,
        height: rueveeImg.height
      };
    };
  }, []);

  // Check if creature image is animated (GIF or WebP)
  const isAnimated = useMemo(() => {
    const creatureImg = CREATURE_IMAGES[creature] || CREATURE_IMAGES['Ruevee'];
    const lower = creatureImg.toLowerCase();
    return lower.endsWith('.gif') || lower.endsWith('.webp');
  }, [creature]);

  // Load creature images based on selected creature
  useEffect(() => {
    const creatureImg = CREATURE_IMAGES[creature] || CREATURE_IMAGES['Ruevee'];
    const shockedImg = CREATURE_SHOCKED_IMAGES[creature] || CREATURE_SHOCKED_IMAGES['Ruevee'];
    
    const img = new Image();
    img.src = creatureImg;
    img.onload = () => {
      creatureImageRef.current = img;
      console.log(`Creature image loaded: ${creature}`, img.width, img.height, creatureImg);
      if (creature === 'Bob') {
        console.log('BOB IMAGE LOADED:', {
          width: img.width,
          height: img.height,
          complete: img.complete,
          src: img.src
        });
      }
      // Log dimensions for debugging scale calculation
      if (rueveeRef.current && creature === 'Slime') {
        const rueveeMax = Math.max(rueveeRef.current.width, rueveeRef.current.height);
        const slimeMax = Math.max(img.width, img.height);
        const baseRatio = rueveeMax / slimeMax;
        console.log(`Ruevee max dimension: ${rueveeMax}, Slime max dimension: ${slimeMax}`);
        console.log(`Base normalization ratio: ${baseRatio}`);
        console.log(`Slime needs additional scale: ${1 / baseRatio} to match Ruevee's starting size`);
        console.log(`Current creatureScaleMultiplier will be: ${baseRatio < 1 ? baseRatio * 0.5 : 0.3}`);
      }
    };
    img.onerror = (e) => {
      console.error(`Failed to load creature image: ${creature}`, creatureImg, e);
    };
    
    const shockedImage = new Image();
    shockedImage.src = shockedImg;
    shockedImage.onload = () => {
      creatureShockedImageRef.current = shockedImage;
      if (creature === 'Slime') {
        console.log(`Shocked Slime image loaded:`, shockedImage.width, shockedImage.height, shockedImg);
      }
    };
    shockedImage.onerror = (e) => {
      console.error(`Failed to load shocked image: ${creature}`, shockedImg, e);
    };

    // Set the img element src when creature changes - ONLY for animated images
    // Force reload by adding timestamp to ensure image updates
    if (isAnimated && creatureImgElementRef.current) {
      const timestamp = new Date().getTime();
      creatureImgElementRef.current.src = `${creatureImg}?t=${timestamp}`;
    }
  }, [creature, isAnimated]);

  // Update animated img element position when position changes
  useEffect(() => {
    const updatePosition = () => {
      if (isAnimated && creatureImgElementRef.current && creaturePositionRef.current) {
        const pos = creaturePositionRef.current;
        const canvas = ref.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const scaleX = canvas.width / rect.width;
          const scaleY = canvas.height / rect.height;
          creatureImgElementRef.current.style.left = `${pos.x / scaleX}px`;
          creatureImgElementRef.current.style.top = `${pos.y / scaleY}px`;
          creatureImgElementRef.current.style.width = `${pos.size / scaleX}px`;
          creatureImgElementRef.current.style.height = `${pos.size / scaleY}px`;
          creatureImgElementRef.current.style.display = 'block';
        }
      } else if (isAnimated && creatureImgElementRef.current) {
        creatureImgElementRef.current.style.display = 'none';
      }
    };
    
    // Update immediately
    updatePosition();
    
    // Also update on animation frame for smooth updates
    const rafId = requestAnimationFrame(() => updatePosition());
    return () => cancelAnimationFrame(rafId);
  });

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

  // Moonlight reflection animation - DISABLED to match backgrounds
  // useEffect(() => {
  //   const skyCanvas = skyRef.current;
  //   if (!skyCanvas) return;
  //   
  //   const ctx = skyCanvas.getContext('2d');
  //   if (!ctx) return;
  //   
  //   let raf = 0;
  //   let frame = 0;
  //   
  //   function animateMoonlight() {
  //     if (!skyCanvas || !ctx) return;
  //     const w = skyCanvas.width = skyCanvas.clientWidth * devicePixelRatio;
  //     const h = skyCanvas.height = skyCanvas.clientHeight * devicePixelRatio;
  //     ctx.clearRect(0, 0, w, h);
  //     
  //     // Subtle moonlight gradient - soft blue-white light from top
  //     const gradient = ctx.createLinearGradient(0, 0, 0, h);
  //     gradient.addColorStop(0, 'rgba(200, 220, 255, 0.08)'); // Soft blue-white at top
  //     gradient.addColorStop(0.3, 'rgba(180, 200, 240, 0.05)'); // Fading
  //     gradient.addColorStop(0.6, 'rgba(150, 180, 220, 0.03)'); // More faded
  //     gradient.addColorStop(1, 'rgba(100, 130, 180, 0.01)'); // Very subtle at bottom
  //     ctx.fillStyle = gradient;
  //     ctx.fillRect(0, 0, w, h);
  //     
  //     // Subtle pulsing moonlight effect
  //     frame++;
  //     const pulse = Math.sin(frame * 0.01) * 0.02 + 0.98; // Very slow, subtle pulse
  //     
  //     // Moonlight beam effect - soft radial gradient from top center
  //     const centerX = w * 0.5;
  //     const centerY = h * 0.15;
  //     const radialGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, h * 0.8);
  //     radialGradient.addColorStop(0, `rgba(220, 235, 255, ${0.06 * pulse})`);
  //     radialGradient.addColorStop(0.4, `rgba(200, 220, 245, ${0.04 * pulse})`);
  //     radialGradient.addColorStop(0.7, `rgba(180, 200, 230, ${0.02 * pulse})`);
  //     radialGradient.addColorStop(1, 'rgba(150, 170, 200, 0)');
  //     
  //     ctx.fillStyle = radialGradient;
  //     ctx.fillRect(0, 0, w, h);
  //     
  //     raf = requestAnimationFrame(animateMoonlight);
  //   }
  //   
  //   animateMoonlight();
  //   return () => cancelAnimationFrame(raf);
  // }, []);

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

      // Update shock intensity (fade out over 600ms - reduced by 0.2 seconds)
      // Use ref to avoid re-renders every frame
      if (shockIntensityRef.current > 0) {
        const shockAge = Date.now() - shockRef.current;
        const newIntensity = Math.max(0, 1 - (shockAge / 600));
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
      const shockShakeX = currentShockIntensity > 0 ? (Math.random() - 0.5) * currentShockIntensity * 6 : 0; // Increased from 4 to 6 for more side-to-side shake
      const shockShakeY = currentShockIntensity > 0 ? (Math.random() - 0.5) * currentShockIntensity * 2 : 0; // Less vertical shake
      const shockCx = cx + shockShakeX;
      const shockCy = cy + shockShakeY;

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
      const minImageSize = baseImageSize * 0.33; // Start at 33% when far from target
      // Reduce Slime's maximum size by 10%
      const maxImageSizeMultiplier = creature === 'Slime' ? 1.197 : 1.33; // Slime: 119.7% (10% reduction from 133%), Others: 133%
      const maxImageSize = baseImageSize * maxImageSizeMultiplier; // Grow to max size when matching target
      
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

      // Bubble system - spawn rate based on frequency closeness
      // Most rapid when frequencies match, very little when furthest apart
      // Calculate frequency closeness (already calculated above)
      const bubbleCloseness = frequencyCloseness; // 1.0 when matching, 0.0 when furthest
      const minSpawnInterval = 5000; // 5 seconds when furthest from match (very little bubbling)
      const maxSpawnInterval = 50; // 0.05 seconds when matching (most rapid bubbling)
      const spawnInterval = minSpawnInterval - (minSpawnInterval - maxSpawnInterval) * bubbleCloseness;
      
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
      
      // Always use normal image dimensions for scaling calculations to ensure consistency
      const normalCreatureImg = creatureImageRef.current;
      
      if (creatureImg && creatureImg.complete && normalCreatureImg && normalCreatureImg.complete && creatureBaseSize > 0) {
        // Creature size is based on frequency closeness (calculated above)
        // Add pulse animation to creature image (independent of orb pulse)
        const creaturePulseAmplitude = 0.05; // Reduced from 0.08 to 0.05 (5% pulse)
        const creaturePulseSpeed = 0.008; // Slightly faster than orb breathing
        const creaturePulse = 1 + creaturePulseAmplitude * Math.sin(t * creaturePulseSpeed);
        const imageSize = creatureBaseSize * creaturePulse;
        
        // Normalize all creatures to Ruevee's base size
        // Use Ruevee's dimensions as the reference for consistent sizing
        // Use normal image dimensions for scaling calculation (not shocked image)
        let sizeRatio = 1.0;
        if (rueveeRef.current) {
          const rueveeMaxSize = Math.max(rueveeRef.current.width, rueveeRef.current.height);
          const creatureMaxSize = Math.max(normalCreatureImg.width, normalCreatureImg.height);
          sizeRatio = rueveeMaxSize / creatureMaxSize;
        } else {
          // If Ruevee not loaded yet, use current creature's natural size
          sizeRatio = 1.0;
        }
        
        const normalizedImageSize = imageSize * sizeRatio;
        
        // Add vertical bounce animation
        const bounceAmplitude = maxOrbRadius * 0.15; // 15% of max orb radius
        const bounceSpeed = 0.005; // Bounce speed
        const bounceOffset = bounceAmplitude * Math.sin(t * bounceSpeed);
        
        // Center image on orb with bounce offset, moved up slightly
        const verticalOffset = -maxOrbRadius * 0.1; // Move up by 10% of max orb radius
        const imageX = shockCx - normalizedImageSize / 2;
        const imageY = shockCy - normalizedImageSize / 2 + bounceOffset + verticalOffset;
        
        // For PNGs (Ruevee, Rose, Bob), draw directly to canvas
        if (!isAnimated) {
          // Make creature brighter - draw with lighter composite mode
          const savedComposite = ctx.globalCompositeOperation;
          ctx.globalCompositeOperation = 'lighten'; // Makes image brighter while preserving colors
          ctx.globalAlpha = 0.92; // Slightly reduced opacity to feel "behind glass"
          ctx.filter = 'blur(0.3px)'; // Subtle blur to simulate glass refraction
          
          // Draw the creature image scaled to match Ruevee's size
          ctx.drawImage(
            creatureImg,
            imageX,
            imageY,
            normalizedImageSize,
            normalizedImageSize
          );
          // Draw again with normal mode for full visibility
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 0.8; // Additional pass for brightness
          ctx.drawImage(
            creatureImg,
            imageX,
            imageY,
            normalizedImageSize,
            normalizedImageSize
          );
          
          ctx.globalCompositeOperation = savedComposite;
          ctx.globalAlpha = 1.0; // Reset to full opacity
          ctx.filter = 'none'; // Reset filter
        } else {
          // For WebP (Slime), store position for img element
          creaturePositionRef.current = {
            x: imageX,
            y: imageY,
            size: normalizedImageSize
          };

          // Update img element position directly in animation loop - ONLY for animated images
          if (creatureImgElementRef.current) {
            const scaleX = w / clientW;
            const scaleY = h / clientH;
            const left = imageX / scaleX;
            let top = imageY / scaleY;
            const width = normalizedImageSize / scaleX;
            const height = normalizedImageSize / scaleY;
            
            // Apply Slime-specific vertical adjustment for wide viewports directly to the img element
            const isWideViewport = clientW > 900;
            const isWidestViewport = clientW > 1200;
            if (creature === 'Slime') {
              if (isWidestViewport) {
                top += (clientH * 0.25); // Move down 25% of viewport height on widest viewports
              } else if (isWideViewport) {
                top += (clientH * 0.2); // Move down 20% of viewport height on wide viewports
              } else {
                top += (clientH * 0.05); // Move down 5% on normal viewports
              }
            }
            
            // Always set the exact same dimensions for both WebP and shocked PNG
            creatureImgElementRef.current.style.left = `${left}px`;
            creatureImgElementRef.current.style.top = `${top}px`;
            creatureImgElementRef.current.style.width = `${width}px`;
            creatureImgElementRef.current.style.height = `${height}px`;
            creatureImgElementRef.current.style.display = 'block';
            creatureImgElementRef.current.style.visibility = 'visible';
            // Force exact dimensions - override any natural image sizing
            creatureImgElementRef.current.style.maxWidth = `${width}px`;
            creatureImgElementRef.current.style.maxHeight = `${height}px`;
            creatureImgElementRef.current.style.minWidth = `${width}px`;
            creatureImgElementRef.current.style.minHeight = `${height}px`;
            
            // Switch to shocked image when shocked
            // Important: Use the same size calculation for both normal and shocked images
            // to ensure consistent sizing
            const isShocked = currentShockIntensity > 0;
            const shockedImg = CREATURE_SHOCKED_IMAGES[creature] || CREATURE_SHOCKED_IMAGES['Ruevee'];
            const normalImg = CREATURE_IMAGES[creature] || CREATURE_IMAGES['Ruevee'];
            const targetSrc = isShocked ? shockedImg : normalImg;
            
            // Calculate scale factor if shocked image is larger than normal image
            // This ensures the shocked image appears the same size as the normal image
            let sizeMultiplier = 1.0;
            if (isShocked && creatureShockedImageRef.current?.complete && normalCreatureImg?.complete) {
              const normalMax = Math.max(normalCreatureImg.width, normalCreatureImg.height);
              const shockedMax = Math.max(creatureShockedImageRef.current.width, creatureShockedImageRef.current.height);
              
              // Always log for Slime when shocked (first frame only)
              if (creature === 'Slime' && t === 0) {
                console.log('Slime size comparison (shocked):', {
                  normalSize: `${normalCreatureImg.width}x${normalCreatureImg.height}`,
                  shockedSize: `${creatureShockedImageRef.current.width}x${creatureShockedImageRef.current.height}`,
                  normalMax,
                  shockedMax,
                  calculatedMultiplier: shockedMax > normalMax ? normalMax / shockedMax : 1.0,
                  willApply: shockedMax > normalMax
                });
              }
              
              if (shockedMax > normalMax) {
                // If shocked image is larger, scale it down to match normal image size
                sizeMultiplier = normalMax / shockedMax;
              }
            } else if (isShocked && creature === 'Slime' && t === 0) {
              // Debug why multiplier isn't being calculated
              console.log('Slime shocked but multiplier not calculated:', {
                shockedImageComplete: creatureShockedImageRef.current?.complete,
                normalImageComplete: normalCreatureImg?.complete,
                hasShockedRef: !!creatureShockedImageRef.current,
                hasNormalRef: !!normalCreatureImg
              });
            }
            
            // Function to apply dimensions - use this consistently
            // CRITICAL: These dimensions must match exactly between normal and shocked images
            const applyDimensions = () => {
              if (creatureImgElementRef.current) {
                // Apply size multiplier for shocked images that are naturally larger
                const exactWidth = `${width * sizeMultiplier}px`;
                const exactHeight = `${height * sizeMultiplier}px`;
                
                // Apply dimensions using every method possible to ensure they stick
                creatureImgElementRef.current.style.width = exactWidth;
                creatureImgElementRef.current.style.height = exactHeight;
                creatureImgElementRef.current.style.setProperty('width', exactWidth, 'important');
                creatureImgElementRef.current.style.setProperty('height', exactHeight, 'important');
                creatureImgElementRef.current.style.setProperty('max-width', exactWidth, 'important');
                creatureImgElementRef.current.style.setProperty('max-height', exactHeight, 'important');
                creatureImgElementRef.current.style.setProperty('min-width', exactWidth, 'important');
                creatureImgElementRef.current.style.setProperty('min-height', exactHeight, 'important');
                creatureImgElementRef.current.style.objectFit = 'fill';
                creatureImgElementRef.current.style.objectPosition = 'center';
                
                // Remove any natural width/height attributes that might override
                creatureImgElementRef.current.removeAttribute('width');
                creatureImgElementRef.current.removeAttribute('height');
                
                // Force reflow to ensure dimensions are applied
                void creatureImgElementRef.current.offsetWidth;
              }
            };
            
            // ALWAYS apply dimensions every frame - critical for matching sizes
            applyDimensions();
            
            // Always update src to ensure correct creature is displayed
            // Check if we need to update (different image path or shock state changed)
            const currentSrc = creatureImgElementRef.current.src;
            // Extract just the filename from current src (handle full URLs)
            const currentPath = currentSrc.split('/').pop()?.split('?')[0] || '';
            const targetPath = targetSrc.split('/').pop() || '';
            const needsUpdate = currentPath !== targetPath;
            
            if (needsUpdate) {
              // Lock dimensions BEFORE switching src
              applyDimensions();
              
              creatureImgElementRef.current.src = targetSrc;
              
              // Apply immediately after src change
              applyDimensions();
              
              // Apply after load with multiple attempts to ensure it sticks
              creatureImgElementRef.current.onload = () => {
                applyDimensions();
                setTimeout(applyDimensions, 10);
                setTimeout(applyDimensions, 50);
                setTimeout(applyDimensions, 100);
                setTimeout(applyDimensions, 200);
                setTimeout(applyDimensions, 500);
                
                // Debug: Check actual rendered size
                if (creature === 'Slime' && isShocked && creatureImgElementRef.current) {
                  const imgElement = creatureImgElementRef.current;
                  const rect = imgElement.getBoundingClientRect();
                  console.log('Shocked Slime size check:', {
                    targetWidth: width,
                    targetHeight: height,
                    actualWidth: rect.width,
                    actualHeight: rect.height,
                    styleWidth: imgElement.style.width,
                    styleHeight: imgElement.style.height
                  });
                }
              };
            }
          }
        }
      } else {
        // Clear position if not drawing
        creaturePositionRef.current = null;
        if (creatureImgElementRef.current) {
          creatureImgElementRef.current.style.display = 'none';
        }
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
  }, [resonanceHz, targetHz, creature]);

  // Generate random ProtoGoob number (1-2700)
  // Generate 4 random Goob options (excluding the currently selected one)
  const goobOptions = useMemo(() => {
    const options: number[] = [];
    while (options.length < 4) {
      const randomGoob = Math.floor(Math.random() * 2700) + 1;
      if (randomGoob !== selectedGoob && !options.includes(randomGoob)) {
        options.push(randomGoob);
      }
    }
    return options;
  }, [selectedGoob]);

  const handleGoobSelect = (goobNumber: number) => {
    setSelectedGoob(goobNumber);
    setShowGoobDropdown(false);
  };

  // Close dropdown when clicking outside
  const goobSectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (goobSectionRef.current && !goobSectionRef.current.contains(event.target as Node)) {
        setShowGoobDropdown(false);
      }
    };

    if (showGoobDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showGoobDropdown]);

  return (
    <div className={styles.container}>
      <div className={styles.goobBar}>
        <div className={styles.goobTypeSection}>
          <div className={styles.goobTypeLabel}>Type</div>
          <div className={styles.goobTypeValue}>{creature}</div>
        </div>
        <div 
          ref={goobSectionRef}
          className={`${styles.currentGoobSection} ${showGoobDropdown ? styles.goobDropdownOpen : ''}`}
          onClick={() => setShowGoobDropdown(!showGoobDropdown)}
        >
          <div className={styles.currentGoobLabel}>Current Goob</div>
          <div className={styles.currentGoobValue}>
            ProtoGoob #{selectedGoob}
            <span className={styles.goobDropdownIndicator}>▼</span>
          </div>
          {showGoobDropdown && (
            <div className={styles.goobDropdown}>
              {goobOptions.map((goobNum) => (
                <div
                  key={goobNum}
                  className={styles.goobOption}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGoobSelect(goobNum);
                  }}
                >
                  ProtoGoob #{goobNum}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={`${styles.vibesSection} ${vibes <= 10 ? styles.vibesLow : vibes <= 50 ? styles.vibesMedium : styles.vibesHigh}`}>
          <div className={styles.vibesLabel}>Vibes</div>
          <div className={styles.vibesValue}>{vibes}%</div>
        </div>
      </div>
      <div className={styles.infoBar}>
        <button 
          className={`${styles.readoutSection} ${selectedTrait === 'pH' ? styles.selected : ''}`}
          onClick={() => setSelectedTrait('pH')}
        >
          <div className={styles.readoutLabel}>pH</div>
          <div className={styles.readoutValue}>--</div>
        </button>
        <button 
          className={`${styles.readoutSection} ${selectedTrait === 'Temperature' ? styles.selected : ''}`}
          onClick={() => setSelectedTrait('Temperature')}
        >
          <div className={styles.readoutLabel}>Temperature</div>
          <div className={styles.readoutValue}>--</div>
        </button>
        <button 
          className={`${styles.readoutSection} ${selectedTrait === 'Salinity' ? styles.selected : ''}`}
          onClick={() => setSelectedTrait('Salinity')}
        >
          <div className={styles.readoutLabel}>Salinity</div>
          <div className={styles.readoutValue}>--</div>
        </button>
        <button 
          className={`${styles.readoutSection} ${selectedTrait === 'Frequency' ? styles.selected : ''}`}
          onClick={() => setSelectedTrait('Frequency')}
        >
          <div className={styles.readoutLabel}>Frequency</div>
          <div className={styles.readoutValue}>--</div>
        </button>
      </div>
      <div className={styles.specimenWrapper}>
        {/* Removed readouts - keeping values for later use:
          - targetHz: {Math.round(targetHz)} Hz
          - resonanceHz: {Math.round(resonanceHz)} Hz
          - closestHit: {closestHitFormatted}
          - currentDistance: {currentDistanceFormatted}
        */}
        <div 
          className={`${styles.panel} ${shockIntensity > 0 ? styles.shaking : ''}`}
          data-selected-trait={selectedTrait}
        >
        <canvas ref={skyRef} className={styles.skyCanvas} />
        <canvas ref={ref} className={styles.canvas} data-specimen-canvas="true" />
        {/* Use img element ONLY for animated images (WebP/GIF like Slime) */}
        {/* PNGs (Ruevee, Rose, Bob) are drawn directly to canvas above */}
        {isAnimated && (
          <img 
            ref={creatureImgElementRef}
            src={CREATURE_IMAGES[creature] || CREATURE_IMAGES['Ruevee']}
            alt={creature}
            className={styles.creatureGif}
            key={`creature-${creature}`}
            onLoad={() => console.log('Animated creature image loaded:', CREATURE_IMAGES[creature])}
            onError={(e) => console.error('Animated creature image failed to load:', CREATURE_IMAGES[creature], e)}
          />
        )}
        <img 
          ref={cathodeBottomRef}
          src="/anode_cart.png" 
          alt="Anode bottom left" 
          className={styles.cathodeBottom}
          data-cathode-bottom="true"
        />
        <img 
          ref={cathodeBottomRightRef}
          src="/anode_cart.png" 
          alt="Anode bottom right" 
          className={styles.cathodeBottomRight}
          data-cathode-bottom-right="true"
        />
        <div className={styles.glassOverlay}></div>
        </div>
      </div>
    </div>
  );
}

