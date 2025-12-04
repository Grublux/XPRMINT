import { Link } from 'react-router-dom';
import styles from './LeaderPage.module.css';

export default function LeaderPage() {
  return (
    <div className={styles.leaderPage}>
      <div className={styles.paginator}>
        <span className={styles.paginatorCurrent}>1</span>
        <Link to="/leader2" className={styles.paginatorLink}>2 →</Link>
      </div>
      <div className={styles.imageWrapper}>
        <div className={styles.imageContainer}>
          <img src="/output.webp" alt="Leaderboard" className={styles.backgroundImage} />
          <div className={styles.progressContainer}>
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

