import { useState, useRef, useEffect } from 'react';
import styles from './HamburgerMenu.module.css';

type HamburgerMenuProps = {
  onHowToPlayClick: () => void;
};

export default function HamburgerMenu({ onHowToPlayClick }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleHowToPlay = () => {
    onHowToPlayClick();
    setIsOpen(false);
  };

  return (
    <div className={styles.menuContainer} ref={menuRef}>
      <button
        className={`${styles.hamburger} ${isOpen ? styles.open : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
      {isOpen && (
        <div className={styles.menu}>
          <button className={styles.menuItem} onClick={handleHowToPlay}>
            How to Play
          </button>
        </div>
      )}
    </div>
  );
}

