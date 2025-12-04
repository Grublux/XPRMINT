import { Link } from 'react-router-dom';
import styles from './LeaderPage.module.css';

export default function LeaderPage2() {
  return (
    <div className={styles.leaderPage}>
      <div className={styles.paginator}>
        <Link to="/leader" className={styles.paginatorLink}>← 1</Link>
        <span className={styles.paginatorCurrent}>2</span>
      </div>
      <div className={styles.imageWrapper}>
        <div className={`${styles.imageContainer} ${styles.imageContainerLeader2}`}>
          <img src="/leader_plains.webp" alt="Leaderboard" className={styles.backgroundImageLeader2} />
          <div className={`${styles.progressContainer} ${styles.progressContainerLeader2}`}>
            <div className={styles.progressLabel}>soon</div>
            <div className={styles.dotsContainer}>
              <span className={styles.dot}>.</span>
              <span className={styles.dot}>.</span>
              <span className={styles.dot}>.</span>
              <span className={styles.dot}>.</span>
              <span className={styles.dot}>.</span>
              <span className={styles.dot}>.</span>
              <span className={styles.dot}>.</span>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.content}>
        {/* Leaderboard content will go here */}
      </div>
    </div>
  );
}

