import styles from './HomePage.module.css';
export default function HomePage(){
  return (
    <section className={styles.wrap}>
      <h1>Welcome to the Experiment</h1>
      <p>Stabilize the resonance by adding or subtracting your three numbers. Exact match wins instantly; 10-minute inactivity fails the experiment.</p>
      <a className={styles.cta} href="/experiment">Start Playing →</a>
    </section>
  );
}

