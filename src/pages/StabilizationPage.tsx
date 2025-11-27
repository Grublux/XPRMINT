import { useState, useEffect, useMemo, useRef } from 'react';
import { useAccount } from 'wagmi';
import { StabilizationDashboard } from '../components/stabilization/StabilizationDashboard';
import { useWhitelistStatus } from '../hooks/stabilizationV3';
import { useUserGoobs } from '../hooks/goobs/useUserGoobs';
import { useSimulatedGoobs } from '../hooks/goobs/useSimulatedGoobs';
import { useWalletItemsSummary } from '../hooks/stabilizationV3/useWalletItemsSummary';
import { useWalletSP } from '../hooks/stabilizationV3/useWalletSP';
import styles from './StabilizationPage.module.css';

export default function StabilizationPage() {
  const { address } = useAccount();
  const { whitelistEnabled, isTester, isReadOnly, isContractOwner } = useWhitelistStatus();
  
  // Initialize isSimulationOn from localStorage for persistence
  const [isSimulationOn, setIsSimulationOn] = useState(() => {
    try {
      const stored = localStorage.getItem('isSimulationOn');
      if (stored !== null) {
        return stored === 'true';
      }
    } catch {}
    return false;
  });
  
  // Persist isSimulationOn to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('isSimulationOn', String(isSimulationOn));
    } catch (error) {
      console.error('Failed to save isSimulationOn to localStorage', error);
    }
  }, [isSimulationOn]);
  
  // Get data for stats
  const { goobs: walletGoobs } = useUserGoobs();
  const { goobs: simulatedGoobs } = useSimulatedGoobs();
  const { items: walletItems } = useWalletItemsSummary();
  const { sp } = useWalletSP();
  
  // Calculate totals
  const totalGoobs = useMemo(() => {
    const goobs = isSimulationOn ? simulatedGoobs : walletGoobs;
    return goobs?.length || 0;
  }, [isSimulationOn, simulatedGoobs, walletGoobs]);
  
  const totalItems = useMemo(() => {
    if (isSimulationOn) {
      // In simulation mode, items are managed in StabilizationDashboard
      // For now, we'll need to pass this up or use context - showing 0 as placeholder
      return 0;
    }
    return walletItems?.reduce((sum, item) => sum + Number(item.balance), 0) || 0;
  }, [isSimulationOn, walletItems]);
  
  const globalSP = useMemo(() => {
    return sp ? Number(sp) : 0;
  }, [sp]);
  
  // Daily Drip timer logic
  const [timeUntilDrip, setTimeUntilDrip] = useState<number | null>(null);
  const [canClaimDrip, setCanClaimDrip] = useState(false);
  const canClaimDripRef = useRef(false);
  
  // Check if page reload - simulate 1 minute left
  const isPageReload = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navEntries.length > 0) {
        return navEntries[0].type === 'reload' || navEntries[0].type === 'navigate';
      }
    } catch {}
    return false;
  }, []);
  
  // Sync ref with state
  useEffect(() => {
    canClaimDripRef.current = canClaimDrip;
  }, [canClaimDrip]);
  
  useEffect(() => {
    const calculateTimeUntilDrip = () => {
      const now = new Date();
      const noon = new Date(now);
      noon.setHours(12, 0, 0, 0);
      
      // If it's past noon today, set to noon tomorrow
      if (now > noon) {
        noon.setDate(noon.getDate() + 1);
      }
      
      // On page reload, simulate 1 minute left
      if (isPageReload) {
        return 60 * 1000; // 1 minute in milliseconds
      }
      
      return noon.getTime() - now.getTime();
    };
    
    // Initialize with calculated time
    const initialTime = calculateTimeUntilDrip();
    if (initialTime > 0) {
      setTimeUntilDrip(initialTime);
      setCanClaimDrip(false);
      canClaimDripRef.current = false;
    } else {
      setCanClaimDrip(true);
      canClaimDripRef.current = true;
      setTimeUntilDrip(null);
    }
    
    const interval = setInterval(() => {
      // Don't update if claim button is already showing - wait for user to click it
      if (canClaimDripRef.current) {
        return; // Stop counting down, button is visible
      }
      
      setTimeUntilDrip(prev => {
        if (prev === null) {
          // Recalculate if null
          const recalculated = calculateTimeUntilDrip();
          if (recalculated > 0) {
            setCanClaimDrip(false);
            canClaimDripRef.current = false;
            return recalculated;
          } else {
            setCanClaimDrip(true);
            canClaimDripRef.current = true;
            return null;
          }
        }
        
        // Decrement by 1 second
        const newTime = prev - 1000;
        
        if (newTime <= 0) {
          setCanClaimDrip(true);
          canClaimDripRef.current = true;
          return null;
        } else {
          return newTime;
        }
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isPageReload]);
  
  // Handle claim drip button click - reset timer after claim
  const handleClaimDrip = () => {
    // TODO: Implement actual claim logic
    // After claim is successful, reset the timer
    const now = new Date();
    const noon = new Date(now);
    noon.setHours(12, 0, 0, 0);
    
    // If it's past noon today, set to noon tomorrow
    if (now > noon) {
      noon.setDate(noon.getDate() + 1);
    }
    
    const timeUntilNext = noon.getTime() - now.getTime();
    setTimeUntilDrip(timeUntilNext);
    setCanClaimDrip(false);
    canClaimDripRef.current = false;
  };
  
  // Format time until drip
  const formatTimeUntilDrip = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Check if user has initialized Goob (simplified - would need actual check)
  const hasInitializedGoob = totalGoobs > 0; // Simplified check

  return (
    <div className={styles.pageContainer}>
      {/* Top bar with Access Granted and Simulation On */}
      {(address && whitelistEnabled) || (isTester && address) ? (
        <div className={styles.topBar}>
          <div className={styles.topBarLeft}>
            {address && whitelistEnabled && (
              <div className={isTester ? styles.accessGranted : styles.accessGrantedNoAccess}>
                {isTester ? (
                  <span>
                    {isContractOwner 
                      ? "Owner Access Granted" 
                      : "Whitelist Access Granted"}
                  </span>
                ) : (
                  <span>No Whitelist, Ask M3 for access!</span>
                )}
              </div>
            )}
          </div>
          <div className={styles.topBarRight}>
            {isTester && address && (
              <button
                className={`${styles.simulationToggle} ${isSimulationOn ? styles.simulationToggleOn : ''}`}
                onClick={() => setIsSimulationOn(!isSimulationOn)}
              >
                Simulation {isSimulationOn ? 'On' : 'Off'}
              </button>
            )}
          </div>
        </div>
      ) : null}
      <div className={styles.titleContainer}>
        <h1 className={styles.title}>Dashboard</h1>
        <div className={styles.statsSection}>
          <div className={styles.statItem}>
            <div className={styles.statLabel}>My Goobs</div>
            <div className={styles.statValue}>{totalGoobs}</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statLabel}>Total Items</div>
            <div className={styles.statValue}>{totalItems}</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statLabel}>Global SP</div>
            <div className={styles.statValue}>{globalSP.toLocaleString()}</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statLabel}>Daily Drip In</div>
            {hasInitializedGoob ? (
              canClaimDrip ? (
                <button className={styles.claimDripButton} onClick={handleClaimDrip}>
                  Claim Drip
                </button>
              ) : timeUntilDrip !== null ? (
                <div className={styles.statValue}>{formatTimeUntilDrip(timeUntilDrip)}</div>
              ) : (
                <div className={styles.statValue}>—</div>
              )
            ) : (
              <div className={styles.statValue}>—</div>
            )}
          </div>
        </div>
      </div>
      <StabilizationDashboard
        isReadOnly={isReadOnly}
        isSimulating={isSimulationOn}
        isWhitelisted={isTester}
        onEnableSimulation={() => setIsSimulationOn(true)}
      />
    </div>
  );
}

