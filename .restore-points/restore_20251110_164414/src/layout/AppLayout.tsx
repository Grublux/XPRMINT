import { Outlet, NavLink } from 'react-router-dom';
import styles from './AppLayout.module.css';

export default function AppLayout(){
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>Experiment • Feed the Frequency</div>
        <nav className={styles.nav}>
          <NavLink to="/" className={({isActive})=> isActive? styles.active : ''}>Home</NavLink>
          <NavLink to="/experiment" className={({isActive})=> isActive? styles.active : ''}>Play</NavLink>
        </nav>
      </header>
      <main className={styles.main}><Outlet/></main>
    </div>
  );
}

