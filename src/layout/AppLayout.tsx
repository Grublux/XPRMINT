import { Outlet } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import HamburgerMenu from '../components/HamburgerMenu/HamburgerMenu';
import HowToPlayOverlay from '../components/Overlays/HowToPlayOverlay';
import styles from './AppLayout.module.css';

export default function AppLayout(){
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const walletMenuRef = useRef<HTMLDivElement>(null);
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error: connectError, reset: resetConnect } = useConnect();
  const { disconnect } = useDisconnect();

  // Reset connect state when error occurs (user dismissed prompt, connection rejected, etc.)
  useEffect(() => {
    if (connectError) {
      // Reset immediately when there's an error to clear the pending state
      resetConnect();
    }
  }, [connectError, resetConnect]);

  // Timeout: if isPending has been true for more than 30 seconds without connecting, reset
  useEffect(() => {
    if (isPending && !isConnected) {
      const timeout = setTimeout(() => {
        resetConnect();
      }, 30000); // 30 second timeout
      return () => clearTimeout(timeout);
    }
  }, [isPending, isConnected, resetConnect]);

  // Close wallet menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (walletMenuRef.current && !walletMenuRef.current.contains(event.target as Node)) {
        setShowWalletMenu(false);
      }
    };

    if (showWalletMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showWalletMenu]);

  const handleWalletClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only show menu if actually connected with an address
    if (isConnected && address) {
      setShowWalletMenu(!showWalletMenu);
    } else {
      // Use the first available connector (usually injected/MetaMask)
      const connector = connectors[0];
      if (connector) {
        connect({ connector });
      }
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setShowWalletMenu(false);
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
            <div className={styles.walletMenuContainer} ref={walletMenuRef}>
              <button 
                className={styles.walletButton}
                onClick={handleWalletClick}
                disabled={isPending}
              >
                {isPending 
                  ? 'Connecting...' 
                  : isConnected && address 
                    ? `${address.slice(0, 6)}...${address.slice(-4)}` 
                    : 'Connect Wallet'}
              </button>
              {isConnected && address && showWalletMenu && (
                <div className={styles.walletMenu}>
                  <div className={styles.walletAddress}>
                    {address}
                  </div>
                  <button 
                    className={styles.walletMenuItem}
                    onClick={handleDisconnect}
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className={styles.main}><Outlet/></main>
      <HowToPlayOverlay isOpen={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
    </div>
  );
}

