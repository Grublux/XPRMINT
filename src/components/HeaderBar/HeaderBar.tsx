"use client";

import { useState, useRef, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import styles from './HeaderBar.module.css';

export default function HeaderBar() {
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [mounted, setMounted] = useState(false);
  const walletMenuRef = useRef<HTMLDivElement>(null);
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close wallet menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (walletMenuRef.current && !walletMenuRef.current.contains(event.target as Node)) {
        setShowWalletMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleWalletClick = () => {
    if (isConnected && address) {
      setShowWalletMenu(!showWalletMenu);
    } else {
      const injected = connectors.find((c) => c.id === 'injected') ?? connectors[0];
      if (injected) {
        connect({ connector: injected });
      }
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setShowWalletMenu(false);
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <div className={styles.headerLeft}>
          <span className={styles.forgeIcon}>⚒️</span>
          <div className={styles.titleText}>Bland_Forge1</div>
        </div>
        <div className={styles.headerRight}>
          {mounted ? (
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
                  <div className={styles.walletAddress}>{address}</div>
                  <button className={styles.walletMenuItem} onClick={handleDisconnect}>
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.walletMenuContainer}>
              <button className={styles.walletButton} disabled>
                Connect Wallet
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

