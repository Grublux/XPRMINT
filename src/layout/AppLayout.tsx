import { Outlet } from 'react-router-dom';
import MovesTicker from '../components/MovesTicker/MovesTicker';
import styles from './AppLayout.module.css';

export default function AppLayout(){
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <MovesTicker/>
      </header>
      <main className={styles.main}><Outlet/></main>
    </div>
  );
}

