import { useGame } from '../../state/gameStore';
import styles from './HeaderBar.module.css';

export default function HeaderBar(){
  const { resonanceHz, setResonance } = useGame();
  
  // Map resonanceHz (0-10000) to slider value (0.1-2.0)
  // 0 Hz = 0.1, 10000 Hz = 2.0, linear mapping
  const sliderValue = 0.1 + (resonanceHz / 10000) * 1.9;
  const sizePercent = (resonanceHz / 10000) * 100;
  
  const handleSliderChange = (value: number) => {
    // Map slider value (0.1-2.0) back to resonanceHz (0-10000)
    const newResonance = ((value - 0.1) / 1.9) * 10000;
    setResonance(Math.max(0, Math.min(10000, newResonance)));
  };

  return (
    <div className={styles.header}>
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
  );
}

