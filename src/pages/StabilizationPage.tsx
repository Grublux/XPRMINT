import { StabilizationDashboard } from '../components/stabilization/StabilizationDashboard';
import styles from './StabilizationPage.module.css';

export default function StabilizationPage() {
  return (
    <div className={styles.pageContainer}>
      <div className={styles.titleContainer}>
        <h1 className={styles.title}>Dashboard</h1>
      </div>
      <StabilizationDashboard />
    </div>
  );
}

