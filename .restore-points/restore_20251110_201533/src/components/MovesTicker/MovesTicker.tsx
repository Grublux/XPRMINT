import { useEffect, useRef } from 'react';
import { useGame } from '../../state/gameStore';
import styles from './MovesTicker.module.css';
import { nearChime } from '../../lib/audio';

const NEAR_WINDOW = 100; // Hz threshold for 0-10000 range

export default function MovesTicker(){
  const { recentMoves, resonanceHz, targetHz, soundOn } = useGame();
  const prevDist = useRef<number>(Math.abs(targetHz - resonanceHz));

  useEffect(()=>{
    const d = Math.abs(targetHz - resonanceHz);
    // chime when entering near window
    if (soundOn && prevDist.current > NEAR_WINDOW && d <= NEAR_WINDOW){
      nearChime();
    }
    prevDist.current = d;
  }, [resonanceHz, targetHz, soundOn]);

  const moves = recentMoves || [];

  return (
    <div className={styles.wrap} aria-live="polite" aria-atomic="true">
      <div className={styles.title}>Recent Moves</div>
      <ul className={styles.list}>
        {moves.map((m, i)=>(
          <li key={i} className={m.delta>0 ? styles.add : styles.sub}>
            {m.delta>0 ? `+${m.delta}` : `${m.delta}`}
          </li>
        ))}
        {moves.length===0 && <li className={styles.empty}>No moves yet</li>}
      </ul>
    </div>
  );
}
