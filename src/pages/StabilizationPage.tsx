import { StabilizationDashboard } from '../components/stabilization/StabilizationDashboard';
import { useWhitelistStatus } from '../hooks/stabilizationV3';
import styles from './StabilizationPage.module.css';

export default function StabilizationPage() {
  const { whitelistEnabled, isTester, isReadOnly, isOwner } = useWhitelistStatus();

  return (
    <div className={styles.pageContainer}>
      <div className={styles.titleContainer}>
        <h1 className={styles.title}>Dashboard</h1>
      </div>
      {whitelistEnabled && (
        <div className={styles.whitelistBanner}>
          {isTester ? (
            <span>
              <strong>
                {isOwner 
                  ? "Owner Access - Full gameplay enabled." 
                  : "Whitelist Access granted, full gameplay enabled."}
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
        whitelistEnabled={whitelistEnabled}
        isTester={isTester}
        isReadOnly={isReadOnly}
      />
    </div>
  );
}

