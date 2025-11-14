import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import HamburgerMenu from '../components/HamburgerMenu/HamburgerMenu';
import HowToPlayOverlay from '../components/Overlays/HowToPlayOverlay';
import styles from './AppLayout.module.css';

export default function AppLayout(){
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.titleText}>XPRMINT</div>
          <div className={styles.headerRight}>
            <button className={styles.walletButton}>Connect Wallet</button>
            <HamburgerMenu onHowToPlayClick={() => setShowHowToPlay(true)} />
          </div>
        </div>
      </header>
      <main className={styles.main}><Outlet/></main>
      <HowToPlayOverlay isOpen={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
    </div>
  );
}

