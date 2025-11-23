import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import HamburgerMenu from '../components/HamburgerMenu/HamburgerMenu';
import HowToPlayOverlay from '../components/Overlays/HowToPlayOverlay';
import styles from './AppLayout.module.css';

export default function AppLayout(){
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const handleWalletClick = () => {
    if (isConnected) {
      disconnect();
    } else {
      // Use the first available connector (usually injected/MetaMask)
      const connector = connectors[0];
      if (connector) {
        connect({ connector });
      }
    }
  };

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <HamburgerMenu onHowToPlayClick={() => setShowHowToPlay(true)} />
            <div className={styles.titleText}>XPRMINT</div>
          </div>
          <div className={styles.headerRight}>
            <button 
              className={styles.walletButton}
              onClick={handleWalletClick}
              disabled={isPending}
            >
              {isPending ? 'Connecting...' : isConnected ? `${address?.slice(0, 6)}...${address?.slice(-4)}` : 'Connect Wallet'}
            </button>
          </div>
        </div>
      </header>
      <main className={styles.main}><Outlet/></main>
      <HowToPlayOverlay isOpen={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
    </div>
  );
}

