import { useEffect } from 'react';
import styles from './WinOverlay.module.css';
import { useGame } from '../../state/gameStore';
import { winSound } from '../../lib/audio';
import { buzzWin } from '../../lib/haptics';

export default function WinOverlay(){
  const { status, targetHz, resonanceHz, resetRound, soundOn } = useGame();
  
  useEffect(()=>{
    if (status === 'win' && soundOn) {
      winSound();
      buzzWin();
    }
  }, [status, soundOn]);

  if (status !== 'win') return null;
  return (
    <div className={styles.scrim} role="dialog" aria-modal="true">
      <div className={styles.box} tabIndex={-1}>
        <h2 className={styles.title}>Stabilization achieved!</h2>
        <p>Specimen Resonance matched Target Frequency ({Math.round(targetHz)} Hz).</p>
        <div className={styles.row}>
          <button className={styles.btn} onClick={resetRound}>Start New Round</button>
        </div>
      </div>
    </div>
  );
}
