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

    function loop(t:number){
      const w = canvas.width  = canvas.clientWidth  * devicePixelRatio;
      const h = canvas.height = canvas.clientHeight * devicePixelRatio;
      ctx.clearRect(0,0,w,h);

      // Draw a clean sine wave that reflects the TARGET frequency (not specimen)
      const baseline = h * 0.5;
      const amp  = Math.min(h*0.35, 140);
      const freq = 2 * Math.PI * (targetHz / 1000); // scaled so 0..10k is usable
      const speed = 0.0016;

      ctx.save();
      ctx.translate(0, baseline);
      ctx.lineWidth = 3 * devicePixelRatio;
      ctx.strokeStyle = 'rgba(125,255,176,0.65)';
      ctx.beginPath();
      for (let x = 0; x <= w; x += 3*devicePixelRatio){
        const y = Math.sin((x * 0.01) * freq + t*speed) * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    raf = requestAnimationFrame(function tick(ts){ loop(ts); raf = requestAnimationFrame(tick); });
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
