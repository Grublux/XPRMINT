import { Link } from 'react-router-dom';
import styles from './HomePage.module.css';

export default function HomePage(){
  return (
    <section className={styles.wrap}>
      <h1>Welcome to the XPRMINT</h1>
      <p>Send your Goobs to the Stabilization Lab, claim your items and begin the XPRMINT!</p>
      <Link className={styles.cta} to="/dashboard">Go To Dashboard</Link>
    </section>
  );
}


