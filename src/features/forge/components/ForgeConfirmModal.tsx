"use client";

import { useState } from 'react';
import styles from './ForgeConfirmModal.module.css';

type ForgeConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  recipeId: number;
  numCoins: number;
  npcId: bigint;
  ngtPerCoin: number;
  lockDuration: bigint;
  isPending?: boolean;
  isConfirming?: boolean;
  isSuccess?: boolean;
  transactionHash?: string;
  onSeeMyCoins?: () => void;
};

const APESCAN_BASE_URL = 'https://apescan.io/tx';

export default function ForgeConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  recipeId,
  numCoins,
  npcId,
  ngtPerCoin,
  lockDuration,
  isPending = false,
  isConfirming = false,
  isSuccess = false,
  transactionHash,
  onSeeMyCoins,
}: ForgeConfirmModalProps) {
  if (!isOpen) return null;

  const totalNGT = numCoins * ngtPerCoin;
  const npcFee = totalNGT * 0.1; // 10%
  const lockDurationSeconds = Number(lockDuration);
  const lockDurationText = lockDurationSeconds === 0 
    ? '0 seconds' 
    : lockDurationSeconds < 60
    ? `${lockDurationSeconds} second${lockDurationSeconds !== 1 ? 's' : ''}`
    : lockDurationSeconds < 3600
    ? `${Math.floor(lockDurationSeconds / 60)} minute${Math.floor(lockDurationSeconds / 60) !== 1 ? 's' : ''}`
    : lockDurationSeconds < 86400
    ? `${Math.floor(lockDurationSeconds / 3600)} hour${Math.floor(lockDurationSeconds / 3600) !== 1 ? 's' : ''}`
    : `${Math.floor(lockDurationSeconds / 86400)} day${Math.floor(lockDurationSeconds / 86400) !== 1 ? 's' : ''}`;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isPending && !isConfirming && !isSuccess) {
      onClose();
    }
  };

  const handleCloseClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isPending && !isConfirming && !isSuccess) {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button 
          className={styles.closeButton} 
          onClick={handleCloseClick}
          type="button"
          disabled={isPending || isConfirming || isSuccess}
        >
          ×
        </button>

        {isSuccess ? (
          <div className={styles.successState}>
            <div className={styles.successIcon}>✓</div>
            <div className={styles.successMessage}>
              <div className={styles.successTitle}>You successfully crafted {numCoins} coin{numCoins !== 1 ? 's' : ''}!</div>
              {transactionHash && (
                <a
                  href={`${APESCAN_BASE_URL}/${transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.transactionLink}
                >
                  Transaction #{transactionHash.slice(0, 10)}...
                </a>
              )}
            </div>
            <div className={styles.successActions}>
              {onSeeMyCoins && (
                <button
                  className={styles.seeMyCoinsButton}
                  onClick={onSeeMyCoins}
                >
                  See my coins
                </button>
              )}
              <button
                className={styles.okButton}
                onClick={onClose}
              >
                OK
              </button>
            </div>
          </div>
        ) : (isPending || isConfirming) ? (
          <div className={styles.pendingState}>
            <div className={styles.spinner}></div>
            <div className={styles.pendingMessage}>
              {isPending ? 'Waiting for transaction...' : 'Confirming transaction...'}
            </div>
          </div>
        ) : (
          <>
            <div className={styles.hazardIcon}>⚠️</div>
            <h2 className={styles.title}>Confirm Forge</h2>
            
            <div className={styles.confirmDetails}>
              <div className={styles.confirmDetailItem}>
                • You will place <strong>{totalNGT.toLocaleString(undefined, { maximumFractionDigits: 2 })} NGT</strong> into {numCoins} coin{numCoins !== 1 ? 's' : ''}.
              </div>
              <div className={styles.confirmDetailItem}>
                • It will be locked for <strong>{lockDurationText}</strong> before it can be destroyed and the $NGT reclaimed by the bearer.
              </div>
              <div className={styles.confirmDetailItem}>
                • <strong>{npcFee.toLocaleString(undefined, { maximumFractionDigits: 2 })} NGT</strong> (10%) of the $NGT will be routed to the crafter NPC {npcId.toString()} when the coin{numCoins !== 1 ? 's are' : ' is'} destroyed.
              </div>
              <div className={styles.confirmDetailItem}>
                • NPC {npcId.toString()} will receive 6.9% secondary royalties.
              </div>
            </div>

            <div className={styles.actions}>
              <button 
                className={styles.cancelBtn} 
                onClick={onClose}
                disabled={isPending || isConfirming}
              >
                Cancel
              </button>
              <button 
                className={styles.confirmBtn}
                onClick={onConfirm}
                disabled={isPending || isConfirming}
              >
                Confirm and Forge
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

