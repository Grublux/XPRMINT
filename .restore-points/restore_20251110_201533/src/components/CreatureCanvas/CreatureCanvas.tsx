import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../state/gameStore';
import styles from './CreatureCanvas.module.css';

export default function CreatureCanvas(){
  const { resonanceHz, targetHz } = useGame();
  const ref = useRef<HTMLCanvasElement|null>(null);
  const [electrify, setElectrify] = useState(false);

  useEffect(() => {
    const handleElectrify = () => {
      setElectrify(true);
      setTimeout(() => setElectrify(false), 200);
    };
    window.addEventListener('bolt-hit', handleElectrify);
    return () => window.removeEventListener('bolt-hit', handleElectrify);
  }, []);

  useEffect(()=>{
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let raf=0;

    function loop(t:number){
      const w = canvas.width = canvas.clientWidth * devicePixelRatio;
      const h = canvas.height = canvas.clientHeight * devicePixelRatio;
      ctx.clearRect(0,0,w,h);

      const cx = w/2;

      // Calculate distance from target (0 = perfect match, 1 = max distance)
      const diff = targetHz - resonanceHz;
      const adiff = Math.abs(diff);
      const maxDistance = 10000;
      const normalizedDistance = Math.min(adiff / maxDistance, 1); // 0 to 1
      const closeness = 1 - normalizedDistance; // 1 = perfect match, 0 = far away
      const isAbove = diff < 0;

      // Color gradient: cold blue (far) -> warm gold (close) -> hot red (above)
      // Use normalizedDistance for smooth gradient
      let targetColor;
      if (isAbove) {
        // Above target: red/orange gradient based on how far above
        const heatFactor = Math.min(adiff / 5000, 1);
        targetColor = {
          r: 255,
          g: 200 - heatFactor * 100,
          b: 100 - heatFactor * 150,
          a: 0.7 + heatFactor * 0.2
        };
      } else {
        // Below target: smooth gradient from blue (far) to gold (close)
        // closeness goes from 0 (far) to 1 (perfect match)
        targetColor = {
          r: 100 + (closeness * 155), // 100 -> 255
          g: 180 + (closeness * 36),  // 180 -> 216
          b: 255 - (closeness * 138), // 255 -> 117
          a: 0.5 + (closeness * 0.4)  // 0.5 -> 0.9
        };
      }

      // base breathing + proximity growth
      const baseScale = 1 + 0.02 * Math.sin(t*0.004);
      const scale = baseScale + 0.09 * closeness;
      const r = Math.min(w,h) * 0.12 * scale;

      // Vat dimensions - FULL vat
      const vatWidth = w * 0.65;
      const vatHeight = h * 0.65;
      const vatX = (w - vatWidth) / 2;
      const vatY = h * 0.12;
      const liquidTop = vatY + 2;
      const liquidBottom = vatY + vatHeight - 2;
      const liquidHeight = vatHeight - 4;

      // Draw vat container
      ctx.save();
      ctx.strokeStyle = 'rgba(180,200,220,0.6)';
      ctx.lineWidth = 3 * devicePixelRatio;
      const radius = 10 * devicePixelRatio;
      ctx.beginPath();
      ctx.moveTo(vatX + radius, vatY);
      ctx.lineTo(vatX + vatWidth - radius, vatY);
      ctx.quadraticCurveTo(vatX + vatWidth, vatY, vatX + vatWidth, vatY + radius);
      ctx.lineTo(vatX + vatWidth, vatY + vatHeight - radius);
      ctx.quadraticCurveTo(vatX + vatWidth, vatY + vatHeight, vatX + vatWidth - radius, vatY + vatHeight);
      ctx.lineTo(vatX + radius, vatY + vatHeight);
      ctx.quadraticCurveTo(vatX, vatY + vatHeight, vatX, vatY + vatHeight - radius);
      ctx.lineTo(vatX, vatY + radius);
      ctx.quadraticCurveTo(vatX, vatY, vatX + radius, vatY);
      ctx.closePath();
      ctx.stroke();
      
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1 * devicePixelRatio;
      ctx.beginPath();
      ctx.moveTo(vatX + radius + 2, vatY + 2);
      ctx.lineTo(vatX + vatWidth - radius - 2, vatY + 2);
      ctx.quadraticCurveTo(vatX + vatWidth - 2, vatY + 2, vatX + vatWidth - 2, vatY + radius + 2);
      ctx.stroke();
      ctx.restore();

      // Liquid color uses targetColor (smooth gradient)
      let liquidBaseColor = {...targetColor};
      if (electrify) {
        liquidBaseColor = {r: 180, g: 220, b: 255, a: 1.0}; // Bright electric blue-white flash
      }

      // Draw FULL liquid with depth gradient
      const liquidRadius = 8 * devicePixelRatio;
      const liquidGrad = ctx.createLinearGradient(vatX, liquidTop, vatX, liquidBottom);
      liquidGrad.addColorStop(0, `rgba(${liquidBaseColor.r},${liquidBaseColor.g},${liquidBaseColor.b},${liquidBaseColor.a * 0.7})`);
      liquidGrad.addColorStop(0.3, `rgba(${liquidBaseColor.r},${liquidBaseColor.g},${liquidBaseColor.b},${liquidBaseColor.a * 0.9})`);
      liquidGrad.addColorStop(0.7, `rgba(${liquidBaseColor.r},${liquidBaseColor.g},${liquidBaseColor.b},${liquidBaseColor.a})`);
      liquidGrad.addColorStop(1, `rgba(${liquidBaseColor.r * 0.6},${liquidBaseColor.g * 0.6},${liquidBaseColor.b * 0.6},${liquidBaseColor.a})`);
      
      ctx.save();
      ctx.fillStyle = liquidGrad;
      ctx.beginPath();
      ctx.moveTo(vatX + 2 + liquidRadius, liquidTop);
      ctx.lineTo(vatX + vatWidth - 2 - liquidRadius, liquidTop);
      ctx.quadraticCurveTo(vatX + vatWidth - 2, liquidTop, vatX + vatWidth - 2, liquidTop + liquidRadius);
      ctx.lineTo(vatX + vatWidth - 2, liquidBottom - liquidRadius);
      ctx.quadraticCurveTo(vatX + vatWidth - 2, liquidBottom, vatX + vatWidth - 2 - liquidRadius, liquidBottom);
      ctx.lineTo(vatX + 2 + liquidRadius, liquidBottom);
      ctx.quadraticCurveTo(vatX + 2, liquidBottom, vatX + 2, liquidBottom - liquidRadius);
      ctx.lineTo(vatX + 2, liquidTop + liquidRadius);
      ctx.quadraticCurveTo(vatX + 2, liquidTop, vatX + 2 + liquidRadius, liquidTop);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Caustics
      ctx.save();
      ctx.globalAlpha = 0.2;
      for (let i = 0; i < 4; i++) {
        const causticX = vatX + (vatWidth * 0.2) + (i * vatWidth * 0.2) + Math.sin(t * 0.001 + i) * 25;
        const causticY = liquidTop + (liquidHeight * 0.2) + (i * liquidHeight * 0.25);
        const causticGrad = ctx.createRadialGradient(causticX, causticY, 0, causticX, causticY, 50);
        causticGrad.addColorStop(0, 'rgba(255,255,255,0.7)');
        causticGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = causticGrad;
        ctx.beginPath();
        ctx.arc(causticX, causticY, 50, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // Specimen orb FULLY SUBMERGED - uses targetColor gradient
      const orbY = liquidTop + (liquidHeight * 0.5);

      // Outer glow uses targetColor
      const outerTint = `rgba(${targetColor.r},${targetColor.g},${targetColor.b},${targetColor.a * 0.6})`;

      // Pulse rings
      const rings = 2 + Math.floor(3*closeness);
      for (let i=0; i<rings; i++){
        const k = (i + (t*0.0015)) % 1;
        const rr = r * (1.4 + k*1.1);
        const alpha = (1-k) * (0.25 + 0.40*closeness);
        ctx.beginPath();
        ctx.arc(cx, orbY, rr, 0, Math.PI*2);
        ctx.strokeStyle = outerTint;
        ctx.lineWidth = Math.max(1, 3*devicePixelRatio*(0.7 + 0.7*closeness));
        ctx.globalAlpha = alpha;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Chamber glow
      const g1 = ctx.createRadialGradient(cx,orbY, r*0.5, cx,orbY, r*2.0);
      g1.addColorStop(0, outerTint);
      g1.addColorStop(0.5, outerTint.replace(/, [\d.]+\)$/, ', 0.3)'));
      g1.addColorStop(1, outerTint.replace(/, [\d.]+\)$/, ', 0)'));
      ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(cx,orbY,r*2.0,0,Math.PI*2); ctx.fill();

      // Specimen core - uses targetColor gradient
      const coreGradient = ctx.createRadialGradient(cx, orbY, r*0.25, cx, orbY, r);
      coreGradient.addColorStop(0, `rgba(${targetColor.r},${targetColor.g},${targetColor.b},${targetColor.a * 1.1})`);
      coreGradient.addColorStop(1, `rgba(${targetColor.r * 0.7},${targetColor.g * 0.7},${targetColor.b * 0.7},${targetColor.a * 0.8})`);
      ctx.fillStyle = coreGradient; ctx.beginPath(); ctx.arc(cx, orbY, r, 0, Math.PI*2); ctx.fill();

      // Liquid distortion around orb
      ctx.save();
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < 3; i++) {
        const rippleR = r * (1.3 + i * 0.4) + Math.sin(t * 0.003 + i) * 5;
        ctx.strokeStyle = `rgba(${liquidBaseColor.r},${liquidBaseColor.g},${liquidBaseColor.b},0.6)`;
        ctx.lineWidth = 2 * devicePixelRatio;
        ctx.beginPath();
        ctx.arc(cx, orbY, rippleR, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // Bubbles
      if (closeness > 0.5) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        for (let i = 0; i < 3; i++) {
          const bubbleX = cx + (Math.sin(t * 0.002 + i * 2) * r * 0.8);
          const bubbleY = orbY - r - (t * 0.1 % (liquidHeight * 0.5)) - (i * 15);
          if (bubbleY > liquidTop) {
            const bubbleSize = 3 + Math.sin(t * 0.005 + i) * 2;
            ctx.fillStyle = `rgba(255,255,255,0.6)`;
            ctx.beginPath();
            ctx.arc(bubbleX, bubbleY, bubbleSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(255,255,255,0.9)`;
            ctx.beginPath();
            ctx.arc(bubbleX - bubbleSize * 0.3, bubbleY - bubbleSize * 0.3, bubbleSize * 0.3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // Heartbeat near perfect match
      if (closeness > 0.97){
        const p = (Math.sin(t*0.01) + 1)/2;
        ctx.beginPath();
        ctx.arc(cx - r*0.2 + p*r*0.4, orbY - r*0.2, r*0.3, 0, Math.PI*2);
        ctx.fillStyle = `rgba(255,255,255, ${0.12 + 0.18*Math.sin(t*0.02)})`;
        ctx.fill();
      }

      raf=requestAnimationFrame(loop);
    }
    raf=requestAnimationFrame(loop);
    return ()=> cancelAnimationFrame(raf);
  }, [resonanceHz, targetHz, electrify]);

  return (
    <div className={styles.panel} aria-labelledby="specimenTitle">
      <div className={styles.header}>
        <div id="specimenTitle" className={styles.title}>Specimen</div>
        <div className={styles.meta}>Specimen Resonance: <strong>{resonanceHz}</strong> Hz</div>
      </div>
      <canvas ref={ref} className={styles.canvas} />
    </div>
  );
}
