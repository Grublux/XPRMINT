import { useEffect, useRef } from 'react';
import { useGame } from '../../state/gameStore';
import styles from './TargetFrequency.module.css';

export default function TargetFrequency(){
  const { targetHz } = useGame();
  const ref = useRef<HTMLCanvasElement|null>(null);

  useEffect(()=>{
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let startTime = performance.now();

    function loop(){
      const w = canvas.width  = canvas.clientWidth  * devicePixelRatio;
      const h = canvas.height = canvas.clientHeight * devicePixelRatio;
      ctx.clearRect(0,0,w,h);

      // Get time in seconds
      const t = (performance.now() - startTime) / 1000;

      // Draw waveform at the ACTUAL target frequency (0-10,000 Hz)
      const baseline = h * 0.5;
      const amp  = Math.min(h*0.35, 140);
      
      // Frequency in Hz: targetHz (0-10,000)
      // Higher frequency = faster oscillation, more cycles
      const cyclesPerWidth = (targetHz / 10000) * 20; // 0-20 cycles across width for max frequency
      const angularFreq = 2 * Math.PI * targetHz; // radians per second

      ctx.save();
      ctx.translate(0, baseline);
      ctx.lineWidth = 3 * devicePixelRatio;
      ctx.strokeStyle = 'rgba(125,255,176,0.65)';
      ctx.beginPath();
      for (let x = 0; x <= w; x += 3*devicePixelRatio){
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

    raf = requestAnimationFrame(function tick(){ loop(); raf = requestAnimationFrame(tick); });
    return ()=> cancelAnimationFrame(raf);
  }, [targetHz]);

  return (
    <div className={styles.panel} aria-labelledby="targetTitle">
      <div className={styles.header}>
        <div id="targetTitle" className={styles.title}>Target Frequency</div>
        <div className={styles.meta}><strong>{targetHz}</strong> Hz</div>
      </div>
      <canvas ref={ref} className={styles.canvas}/>
    </div>
  );
}
