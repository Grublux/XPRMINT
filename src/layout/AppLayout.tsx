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
  const connectionAttemptRef = useRef<number | null>(null);

  // Reset connect state immediately when error occurs
  useEffect(() => {
    if (connectError) {
      resetConnect();
      connectionAttemptRef.current = null;
    }
  }, [connectError, resetConnect]);

  // Detect when wallet prompt is dismissed by monitoring window focus
  // When user dismisses a modal/prompt, window often regains focus
  useEffect(() => {
    const handleFocus = () => {
      // If we're pending but not connected when window regains focus, reset
      if (isPending && !isConnected && !address && connectionAttemptRef.current) {
        const timeSinceAttempt = Date.now() - connectionAttemptRef.current;
        // Only reset if connection attempt was recent (within last 5 seconds)
        // This prevents false positives from normal window focus events
        if (timeSinceAttempt < 5000) {
          resetConnect();
          connectionAttemptRef.current = null;
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isPending, isConnected, address, resetConnect]);

  // Aggressive reset: check frequently and reset if pending without connection
  // Uses a very short grace period (200ms) to allow legitimate fast connections
  useEffect(() => {
    if (isPending && !isConnected && !address && connectionAttemptRef.current) {
      const timeSinceAttempt = Date.now() - connectionAttemptRef.current;
      
      // After 200ms grace period, start checking frequently and reset if still pending
      // This allows legitimate connections to complete but resets quickly for dismissed prompts
      if (timeSinceAttempt > 200) {
        const checkInterval = setInterval(() => {
          if (isPending && !isConnected && !address) {
            resetConnect();
            connectionAttemptRef.current = null;
          }
        }, 50); // Check every 50ms

        return () => clearInterval(checkInterval);
      }
    } else if (isConnected || address) {
      // Clear the ref when connection succeeds
      connectionAttemptRef.current = null;
    }
  }, [isPending, isConnected, address, resetConnect]);

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
      // Reset any previous connection state first
      if (isPending) {
        resetConnect();
      }
      // Track when we start the connection attempt
      connectionAttemptRef.current = Date.now();
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

