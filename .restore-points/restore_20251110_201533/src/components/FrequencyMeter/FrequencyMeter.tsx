import { useMemo } from 'react';
import { useGame } from '../../state/gameStore';
import { map } from '../../lib/mapping';
import styles from './FrequencyMeter.module.css';

export default function FrequencyMeter(){
  const { goal, resonance } = useGame();
  const width = 360;
  const domainMax = Math.max(goal*1.2, goal+50);
  const xG = useMemo(()=> map(goal, 0, domainMax, 0, width), [goal]);
  const xC = useMemo(()=> map(resonance, 0, domainMax, 0, width), [resonance, goal]);
  const dist = Math.abs(goal - resonance);
  const near = dist <= 3;
  const over = resonance > goal;

  return (
    <div className={styles.panel}>
      <div className={styles.label}>GLOBAL RESONANCE: {resonance}</div>
      <svg viewBox={`0 0 ${width} 28`} className={styles.svg}>
        <rect x="0" y="4" width={width} height="20" rx="10" className={styles.track}/>
        <rect x={xG-6} y="2" width="12" height="24" rx="6" className={styles.goal}/>
        <circle cx={xC} cy="14" r="8"
          className={`${styles.handle} ${near ? styles.near : over ? styles.over : styles.under}`}/>
      </svg>
      <div className={styles.hint}>
        {over ? 'Above goal — consider subtracting' : 'Below goal — consider adding'}
      </div>
    </div>
  );
}

