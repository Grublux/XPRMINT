import { useState } from 'react';
import CreatureCanvas from '../components/CreatureCanvas/CreatureCanvas';
import FrequencyReadout, { PlusButton } from '../components/FrequencyReadout/FrequencyReadout';
import CenterDial from '../components/CenterDial/CenterDial';
import WinOverlay from '../components/Overlays/WinOverlay';
import TimeoutOverlay from '../components/Overlays/TimeoutOverlay';
import JoinOverlay from '../components/Overlays/JoinOverlay';
import HowToPlayOverlay from '../components/Overlays/HowToPlayOverlay';
import { useRoundJudge } from '../hooks/useRoundJudge';
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { useGame } from '../state/gameStore';
import styles from './ExperimentPage.module.css';

export default function ExperimentPage(){
  useRoundJudge();
  useKeyboardControls();
  const { resonanceHz, setResonance } = useGame();
  const [selectedCreature, setSelectedCreature] = useState('Slime');
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  
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
        <div className={styles.titleLeft}>
          <a 
            href="#" 
            className={styles.howToPlayLink}
            onClick={(e) => {
              e.preventDefault();
              setShowHowToPlay(true);
            }}
          >
            How to Play
          </a>
        </div>
        <div className={styles.titleCenter}>
          <div className={styles.titleText}>XPRMINT</div>
        </div>
        <div className={styles.titleRight}>
          <button className={styles.walletButton}>Connect Wallet</button>
        </div>
      </div>
      <div className={styles.specimenRow}>
        <CreatureCanvas creature={selectedCreature}/>
      </div>
      
      <div className={styles.dialRow}>
        <FrequencyReadout/>
        <CenterDial/>
        <PlusButton/>
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
        <div className={styles.creatureControl}>
          <label htmlFor="creature-select" className={styles.creatureLabel}>
            Creature
          </label>
          <select
            id="creature-select"
            value={selectedCreature}
            onChange={(e) => setSelectedCreature(e.target.value)}
            className={styles.creatureSelect}
          >
            <option value="Ruevee">Ruevee</option>
            <option value="Rose">Rose</option>
            <option value="Slime">Slime</option>
          </select>
        </div>
      </div>

      {/* Overlays */}
      <JoinOverlay/>
      <WinOverlay/>
      <TimeoutOverlay/>
      <HowToPlayOverlay isOpen={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
    </div>
  );
}
