import CreatureCanvas from '../components/CreatureCanvas/CreatureCanvas';
import FrequencyReadout from '../components/FrequencyReadout/FrequencyReadout';
import CenterDial from '../components/CenterDial/CenterDial';
import WinOverlay from '../components/Overlays/WinOverlay';
import TimeoutOverlay from '../components/Overlays/TimeoutOverlay';
import JoinOverlay from '../components/Overlays/JoinOverlay';
import MovesTicker from '../components/MovesTicker/MovesTicker';
import { useRoundJudge } from '../hooks/useRoundJudge';
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { useTimer } from '../hooks/useTimer';
import { useGame } from '../state/gameStore';
import styles from './ExperimentPage.module.css';

export default function ExperimentPage(){
  useRoundJudge();
  useKeyboardControls();
  const { pot, lastMoveAt, status, resonanceHz, setResonance } = useGame();
  const { label, remaining } = useTimer(lastMoveAt);
  const danger = remaining <= 60_000 && status==='active';
  
  // Orb size slider logic
  const sliderValue = 0.1 + (resonanceHz / 10000) * 1.9;
  const sizePercent = (resonanceHz / 10000) * 100;
  const handleSliderChange = (value: number) => {
    const newResonance = ((value - 0.1) / 1.9) * 10000;
    setResonance(Math.max(0, Math.min(10000, newResonance)));
  };

  return (
    <div className={styles.grid}>
      <div className={styles.titleRow}>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>XPRMINT</h1>
        </div>
      </div>

      <div className={styles.specimenRow}>
        <CreatureCanvas/>
      </div>
      
      <div className={styles.dialRow}>
        <FrequencyReadout direction="down"/>
        <CenterDial/>
        <FrequencyReadout direction="up"/>
      </div>

      <div className={styles.sliderRow}>
        <div className={styles.sizeControl}>
          <label htmlFor="orb-size" className={styles.sizeLabel}>
            Orb Size: {sizePercent.toFixed(0)}% ({Math.round(resonanceHz)} Hz)
          </label>
          <input
            id="orb-size"
            type="range"
            min="0.1"
            max="2.0"
            step="0.01"
            value={sliderValue}
            onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
            className={styles.sizeSlider}
          />
        </div>
      </div>

      {/* Overlays */}
      <JoinOverlay/>
      <WinOverlay/>
      <TimeoutOverlay/>
    </div>
  );
}
