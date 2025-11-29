import { useState, useEffect, useMemo, useRef } from 'react';
import { useAccount } from 'wagmi';
import { StabilizationDashboard } from '../components/stabilization/StabilizationDashboard';
import { useWhitelistStatus } from '../hooks/stabilizationV3';
import { useUserGoobs } from '../hooks/goobs/useUserGoobs';
import { useSimulatedGoobs } from '../hooks/goobs/useSimulatedGoobs';
import { useWalletItemsSummary } from '../hooks/stabilizationV3/useWalletItemsSummary';
import { useWalletSP } from '../hooks/stabilizationV3/useWalletSP';
import { ITEM_V3_ADDRESS } from '../config/contracts/stabilizationV3';
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
  const { sp, refetch: refetchSP } = useWalletSP();
  
  // Listen for SP update events and refetch/update
  const [spUpdateKey, setSPUpdateKey] = useState(0);
  useEffect(() => {
    const handleSPUpdate = () => {
      if (isSimulationOn) {
        // Force re-render to update Global SP display (reads from localStorage)
        setSPUpdateKey(prev => prev + 1);
      } else {
        // In real mode, refetch from contract
        refetchSP();
      }
    };
    window.addEventListener('sp-updated', handleSPUpdate);
    return () => window.removeEventListener('sp-updated', handleSPUpdate);
  }, [isSimulationOn, refetchSP]);
  
  // Calculate totals
  const totalGoobs = useMemo(() => {
    const goobs = isSimulationOn ? simulatedGoobs : walletGoobs;
    return goobs?.length || 0;
  }, [isSimulationOn, simulatedGoobs, walletGoobs]);
  
  // Track simulation items count from StabilizationDashboard
  const [simulationItemsCount, setSimulationItemsCount] = useState(0);
  
  // Listen for simulation items updates
  useEffect(() => {
    const handleSimulationItemsUpdate = (event: CustomEvent<number>) => {
      setSimulationItemsCount(event.detail);
    };
    window.addEventListener('simulation-items-updated', handleSimulationItemsUpdate as EventListener);
    return () => window.removeEventListener('simulation-items-updated', handleSimulationItemsUpdate as EventListener);
  }, []);
  
  const totalItems = useMemo(() => {
    if (isSimulationOn) {
      return simulationItemsCount;
    }
    return walletItems?.reduce((sum, item) => sum + Number(item.balance), 0) || 0;
  }, [isSimulationOn, walletItems, simulationItemsCount]);
  
  const globalSP = useMemo(() => {
    // In simulation mode, read from localStorage
    if (isSimulationOn) {
      try {
        const simulatedSP = localStorage.getItem('simulated-wallet-sp');
        return simulatedSP ? parseInt(simulatedSP, 10) : 0;
      } catch {
        return 0;
      }
    }
    return sp ? Number(sp) : 0;
  }, [sp, isSimulationOn, spUpdateKey]); // Include spUpdateKey to trigger re-render on SP updates
  
  // Daily Drip timer logic
  const [timeUntilDrip, setTimeUntilDrip] = useState<number | null>(null);
  const [canClaimDrip, setCanClaimDrip] = useState(false);
  const canClaimDripRef = useRef(false);
  
  // Check if page reload - reset simulated SP and simulate 1 minute left for drip
  const isPageReload = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navEntries.length > 0) {
        return navEntries[0].type === 'reload' || navEntries[0].type === 'navigate';
      }
      const perfNav = (performance as any).navigation;
      if (perfNav) {
        return perfNav.type === 1;
      }
    } catch {}
    return false;
  }, []);
  
  // Reset simulated SP on page reload (only in simulation mode)
  useEffect(() => {
    if (isPageReload && isSimulationOn) {
      try {
        localStorage.setItem('simulated-wallet-sp', '0');
        console.log('[StabilizationPage] Page reload detected - resetting simulated SP to 0');
        // Force re-render to update Global SP display
        setSPUpdateKey(prev => prev + 1);
      } catch (err) {
        console.error('[StabilizationPage] Failed to reset simulated SP:', err);
      }
    }
  }, [isPageReload, isSimulationOn]);
  
  // Sync ref with state
  useEffect(() => {
    canClaimDripRef.current = canClaimDrip;
  }, [canClaimDrip]);
  
  useEffect(() => {
    const calculateTimeUntilDrip = () => {
      // In simulation mode, always use 60 seconds (1 minute) as a "day"
      if (isSimulationOn) {
        return 60 * 1000; // 60 seconds in milliseconds
      }
      
      // Real mode: calculate based on noon
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
  }, [isPageReload, isSimulationOn]);
  
  // State for daily drip claim fake transaction
  const [showDripTransactionModal, setShowDripTransactionModal] = useState(false);
  const [showDripSuccessModal, setShowDripSuccessModal] = useState(false);
  const [dripItemsReceived, setDripItemsReceived] = useState<Array<{ 
    id: number; 
    name: string; 
    image?: string; 
    image_data?: string;
    quantity: number;
    category?: string;
    magnitude?: number;
    rarity?: string;
  }>>([]);
  const [showBagAnimation, setShowBagAnimation] = useState(false);
  const [showItemsFadeIn, setShowItemsFadeIn] = useState(false);
  const [webpKey, setWebpKey] = useState(0);
  const bagImageRef = useRef<HTMLImageElement | null>(null);
  const dripTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);


  // Handle claim drip button click - show fake transaction modal
  const handleClaimDrip = () => {
    setShowDripTransactionModal(true);
  };


  // Check if user has any Goobs (for counter display - counter shows if there are Goobs, even if not initialized yet)
  const hasAnyGoobs = useMemo(() => {
    const goobs = isSimulationOn ? simulatedGoobs : walletGoobs;
    return (goobs?.length || 0) > 0;
  }, [isSimulationOn, simulatedGoobs, walletGoobs]);

  // Handle fake transaction sign for daily drip
  const handleFakeDripSign = () => {
    setShowDripTransactionModal(false);
    
    // Get all initialized Goobs that are actively in the lab
    // getInitializedGoobs already filters for Goobs in lab AND initialized
    // Each Goob gets 1 item (or 2 if vibes == 10)
    let totalDripAmount = 0;
    const goobDripAmounts: Array<{ goobId: bigint; amount: number }> = [];
    
    // Get Goobs in the lab
    let goobsInLab: Set<string> = new Set();
    if (isSimulationOn) {
      try {
        const stored = localStorage.getItem('goobs-in-lab-simulation');
        if (stored) {
          const ids = JSON.parse(stored) as string[];
          goobsInLab = new Set(ids);
        }
      } catch (e) {
        console.error('[DripClaim] Error reading goobs-in-lab-simulation:', e);
      }
    } else {
      // Real mode - use all wallet Goobs for now
      if (walletGoobs) {
        goobsInLab = new Set(walletGoobs.map(g => g.tokenId.toString()));
      }
    }
    
    console.log('[DripClaim] Goobs in lab:', goobsInLab.size, Array.from(goobsInLab));
    
    // Get initialized Goobs that are in the lab
    const allGoobs = isSimulationOn ? simulatedGoobs : walletGoobs || [];
    const initializedGoobsInLab: bigint[] = [];
    
    for (const goob of allGoobs) {
      const goobId = goob.tokenId;
      const goobIdStr = goobId.toString();
      
      // Must be in lab
      if (!goobsInLab.has(goobIdStr)) continue;
      
      // Must be initialized (has non-zero targets)
      if (isSimulationOn) {
        try {
          const key = `simulated-creature-state-${goobIdStr}`;
          const stored = localStorage.getItem(key);
          if (stored) {
            const state = JSON.parse(stored);
            if (state && (state.targetFreq !== 0 || state.targetTemp !== 0 || state.targetPH !== 0 || state.targetSal !== 0)) {
              initializedGoobsInLab.push(goobId);
            }
          }
        } catch {}
      } else {
        // Real mode - assume initialized for now
        initializedGoobsInLab.push(goobId);
      }
    }
    
    console.log('[DripClaim] Initialized Goobs in lab:', initializedGoobsInLab.length);
    
    // Each initialized Goob in lab gets 1 item (or 2 if vibes == 10)
    if (initializedGoobsInLab.length === 0) {
      console.warn('[DripClaim] No initialized Goobs in lab found');
      // Still show modal but with 0 items for debugging
      setDripItemsReceived([]);
      setShowDripSuccessModal(true);
      setShowBagAnimation(true);
      setShowItemsFadeIn(false);
      setTimeout(() => {
        setShowItemsFadeIn(true);
      }, 3800);
      return;
    }
    
    for (const goobId of initializedGoobsInLab) {
      let dripAmount = 1; // Default: 1 item per Goob
      
      // Check vibes for enhanced drip (2 items if vibes == 10)
      if (isSimulationOn) {
        try {
          const key = `simulated-creature-state-${goobId.toString()}`;
          const stored = localStorage.getItem(key);
          if (stored) {
            const state = JSON.parse(stored);
            if (state.vibes === 10 && state.enhancedDrip) {
              dripAmount = 2; // Enhanced drip
            }
          }
        } catch {}
      }
      
      totalDripAmount += dripAmount;
      goobDripAmounts.push({ goobId, amount: dripAmount });
    }
    
    console.log('[DripClaim] Total drip amount:', totalDripAmount, 'from', goobDripAmounts.length, 'Goobs');
    
    const itemsReceived: Array<{ 
      id: number; 
      name: string; 
      image?: string; 
      image_data?: string;
      quantity: number;
      category?: string;
      magnitude?: number;
      rarity?: string;
    }> = [];
    
    // Generate random items for each drip
    for (const { amount } of goobDripAmounts) {
      for (let i = 0; i < amount; i++) {
        const randomItemId = Math.floor(Math.random() * 64); // Items 0-63
        
        // Get item metadata from localStorage cache
        try {
          const cached = localStorage.getItem(`item-metadata-${ITEM_V3_ADDRESS}-${randomItemId}`);
          if (cached) {
            const metadata = JSON.parse(cached);
            let category: string | undefined;
            let magnitude: number | undefined;
            let rarity: string | undefined;
            
            // Extract category, magnitude, and rarity from attributes
            if (metadata?.attributes && Array.isArray(metadata.attributes)) {
              for (const attr of metadata.attributes) {
                if (attr.trait_type === 'Rarity') {
                  const rarityValue = String(attr.value).trim();
                  if (rarityValue.toLowerCase() === 'epic') {
                    category = 'Epic';
                  }
                  rarity = rarityValue;
                } else if (attr.trait_type === 'Primary Trait') {
                  const value = String(attr.value).toLowerCase().trim();
                  if (value.includes('frequency')) category = 'Freq';
                  else if (value.includes('temperature')) category = 'Temp';
                  else if (value.includes('ph') || value === 'ph') category = 'pH';
                  else if (value.includes('salinity')) category = 'Salinity';
                } else if (attr.trait_type === 'Primary Delta Magnitude') {
                  magnitude = typeof attr.value === 'number' ? Math.abs(attr.value) : Math.abs(parseInt(String(attr.value), 10));
                }
              }
            }
            
            itemsReceived.push({
              id: randomItemId,
              name: metadata?.name || `Item #${randomItemId}`,
              image: metadata?.image,
              image_data: metadata?.image_data,
              quantity: 1,
              category,
              magnitude,
              rarity,
            });
          } else {
            itemsReceived.push({
              id: randomItemId,
              name: `Item #${randomItemId}`,
              quantity: 1,
            });
          }
        } catch {
          itemsReceived.push({
            id: randomItemId,
            name: `Item #${randomItemId}`,
            quantity: 1,
          });
        }
      }
    }

    console.log('[DripClaim] Generated items:', itemsReceived.length, itemsReceived);
    
    // Show bag animation immediately (no spinner delay)
    setDripItemsReceived(itemsReceived);
    setShowDripSuccessModal(true);
    setShowBagAnimation(true);
    setShowItemsFadeIn(false); // Start with items hidden
    setWebpKey(prev => prev + 1); // Force webp to remount and play from start
    
    // Clear any existing timeouts
    dripTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    dripTimeoutsRef.current = [];
    
    // No need to capture size anymore since webp freezes on final frame
    
    // Items appear at 3.8 seconds (0.8 seconds later than original 3 seconds)
    const itemsTimeout = setTimeout(() => {
      setShowItemsFadeIn(true);
      
      // Add items to simulation inventory when items appear
      if (isSimulationOn) {
        // Dispatch event to add items to inventory
        window.dispatchEvent(new CustomEvent('add-drip-items', { 
          detail: itemsReceived.map(item => ({ itemId: item.id, quantity: item.quantity }))
        }));
      }
    }, 3800);
    dripTimeoutsRef.current.push(itemsTimeout);
    
    // bag_ani_once.webp loops once and freezes on final frame - no need to switch to static image
  };

  // Handle closing drip success modal and reset timer
  const handleCloseDripSuccess = () => {
    // Clear all timeouts
    dripTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    dripTimeoutsRef.current = [];
    
    setShowDripSuccessModal(false);
    setShowBagAnimation(false);
    setShowItemsFadeIn(false);
    setDripItemsReceived([]);
    
    // Reset timer after claim
    // In simulation mode, always reset to 60 seconds (1 minute)
    if (isSimulationOn) {
      setTimeUntilDrip(60 * 1000); // 60 seconds in milliseconds
      setCanClaimDrip(false);
      canClaimDripRef.current = false;
    } else {
      // Real mode: calculate based on noon
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
    }
  };
  
  // Format time until drip
  const formatTimeUntilDrip = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  

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
            {hasAnyGoobs ? (
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

      {/* Daily Drip Fake Transaction Modal */}
      {showDripTransactionModal && (
        <div 
          className={styles.fakeTransactionOverlay}
          onClick={() => setShowDripTransactionModal(false)}
        >
          <div 
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className={styles.modalCloseButton}
              onClick={() => setShowDripTransactionModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <div className={styles.fakeTransactionText}>
              Approve and Claim Daily Drip
            </div>
            <button 
              className={styles.fakeTransactionButton}
              onClick={handleFakeDripSign}
            >
              Sign Fake Transaction
            </button>
          </div>
        </div>
      )}

      {/* Daily Drip Success Modal with Bag Animation */}
      {showDripSuccessModal && (
        <div 
          className={styles.modalOverlay}
          onClick={handleCloseDripSuccess}
        >
          <div 
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
            style={{ 
              position: 'relative', 
              minHeight: '600px',
              height: '600px', // Fixed height to prevent resizing when items appear
              width: '90vw', 
              maxWidth: '700px',
              padding: 0, // Remove padding so bag fills entire modal
              overflow: 'hidden', // Prevent any layout shifts
            }}
          >
            <button 
              className={styles.modalCloseButton}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCloseDripSuccess();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCloseDripSuccess();
              }}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                zIndex: 10,
                pointerEvents: 'auto',
              }}
              aria-label="Close"
            >
              ×
            </button>
            
            {/* Bag Image - stays visible as background */}
            {showBagAnimation && (
              <div 
                className={styles.bagAnimationContainer}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 1,
                  pointerEvents: 'none', // Allow clicks to pass through to items
                  padding: 0,
                  margin: 0,
                  overflow: 'hidden', // Prevent any layout shifts
                }}
              >
                <img 
                  key={`webp-animation-${webpKey}`}
                  ref={bagImageRef}
                  src={`/bag_ani_once.webp?t=${webpKey}`}
                  alt="Bag animation"
                  className={styles.bagAnimation}
                  style={{ 
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    margin: 0,
                    padding: 0,
                  }}
                />
              </div>
            )}

            {/* Items Fade In - always render if items exist, fade in when ready - ON TOP OF BAG */}
            {dripItemsReceived.length > 0 && (
              <div 
                className={styles.dripItemsContainer}
                style={{
                  opacity: showItemsFadeIn ? 1 : 0,
                  transition: 'opacity 0.3s ease-in',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 2,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px',
                  pointerEvents: showItemsFadeIn ? 'auto' : 'none',
                  overflow: 'auto', // Allow scrolling for items, but don't affect parent
                  boxSizing: 'border-box',
                }}
              >
                <h2 className={styles.modalTitle}>You received {dripItemsReceived.length} item{dripItemsReceived.length === 1 ? '' : 's'}:</h2>
                <div 
                  className={styles.modalItemsList}
                  style={{
                    maxHeight: dripItemsReceived.length > 1 ? '400px' : 'auto',
                    overflowY: dripItemsReceived.length > 1 ? 'auto' : 'visible',
                  }}
                >
                  {dripItemsReceived.map((item, index) => (
                    <div key={`${item.id}-${index}`} className={styles.modalItem}>
                      <div className={styles.modalItemImage}>
                        <img 
                          src={item.image || item.image_data || ''} 
                          alt={item.name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <div className={styles.modalItemInfo}>
                        <div className={styles.modalItemName}>{item.name}</div>
                        <div className={styles.modalItemDetails}>
                          {item.rarity && (
                            <span className={styles.modalItemRarity}>Rarity: {item.rarity}</span>
                          )}
                          {item.category && (
                            <span className={styles.modalItemCategory}>
                              {item.category}
                              {item.magnitude !== undefined && ` ${item.magnitude}`}
                            </span>
                          )}
                          <span className={styles.modalItemQuantity}>+{item.quantity}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Dismiss button - always visible at bottom, below bag image */}
            {showItemsFadeIn && (
              <button 
                className={styles.modalDismissButton}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCloseDripSuccess();
                }}
                style={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 3,
                  pointerEvents: 'auto',
                }}
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

