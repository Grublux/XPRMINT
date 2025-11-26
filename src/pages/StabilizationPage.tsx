import { useState } from 'react';
import { useAccount } from 'wagmi';
import { StabilizationDashboard } from '../components/stabilization/StabilizationDashboard';
import { useWhitelistStatus } from '../hooks/stabilizationV3';
import styles from './StabilizationPage.module.css';

export default function StabilizationPage() {
  const { address } = useAccount();
  const { whitelistEnabled, isTester, isReadOnly, isContractOwner } = useWhitelistStatus();
  const [isSimulationOn, setIsSimulationOn] = useState(false);

  return (
    <div className={styles.pageContainer}>
      {isTester && address && (
        <div className={styles.simulationToggleContainer}>
          <button
            className={`${styles.simulationToggle} ${isSimulationOn ? styles.simulationToggleOn : ''}`}
            onClick={() => setIsSimulationOn(!isSimulationOn)}
          >
            Simulation {isSimulationOn ? 'On' : 'Off'}
          </button>
        </div>
      )}
      <div className={styles.titleContainer}>
        <h1 className={styles.title}>Dashboard</h1>
      </div>
      {address && whitelistEnabled && (
        <div className={isTester ? styles.whitelistBanner : styles.whitelistBannerNoAccess}>
          {isTester ? (
            <span>
              <strong>
                {isContractOwner 
                  ? "Owner Access Granted" 
                  : "Whitelist Access Granted"}
              </strong>
            </span>
          ) : (
            <span>
              <strong>No Whitelist, Ask M3 for access!</strong>
            </span>
          )}
        </div>
      )}
      <StabilizationDashboard
        isReadOnly={isReadOnly}
        isSimulating={isSimulationOn}
        isWhitelisted={isTester}
        onEnableSimulation={() => setIsSimulationOn(true)}
      />
    </div>
  );
}

