import { useMemo } from 'react';
import { useGame } from '../../state/gameStore';
import { map } from '../../lib/mapping';
import styles from './FrequencyMeter.module.css';

export default function FrequencyMeter(){
  const { targetHz, resonanceHz } = useGame();
  const width = 360;
  const domainMax = Math.max(targetHz*1.2, targetHz+50);
  const xG = useMemo(()=> map(targetHz, 0, domainMax, 0, width), [targetHz]);
  const xC = useMemo(()=> map(resonanceHz, 0, domainMax, 0, width), [resonanceHz, targetHz]);
  const dist = Math.abs(targetHz - resonanceHz);
  const near = dist <= 3;
  const over = resonanceHz > targetHz;

  return (
    <div className={styles.panel}>
      <div className={styles.label}>GLOBAL RESONANCE: {resonanceHz}</div>
      <svg viewBox={`0 0 ${width} 28`} className={styles.svg}>
        <rect x="0" y="4" width={width} height="20" rx="10" className={styles.track}/>
        <rect x={xG-6} y="2" width="12" height="24" rx="6" className={styles.goal}/>
        <circle cx={xC} cy="14" r="8"
          className={`${styles.handle} ${near ? styles.near : over ? styles.over : styles.under}`}/>
      </svg>
      <div className={styles.hint}>
        {over ? 'Above target — consider subtracting' : 'Below target — consider adding'}
      </div>
    </div>
  );
}


