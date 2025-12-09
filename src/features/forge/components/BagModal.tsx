"use client";

import { useState, useEffect } from "react";
import styles from "./BagModal.module.css";
import { useCoinTokens } from "../hooks/useCoinTokens";
import type { CoinToken } from "../hooks/useCoinTokens";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { MASTER_CRAFTER_ADDRESS } from "@/features/crafted/constants";

type BagModalProps = {
  isOpen: boolean;
  onClose: () => void;
  coinBalance: number;
  coinBalanceLoading: boolean;
  address?: string | null;
};

const DESTROY_ABI = [
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'destroyPosition',
    inputs: [{ name: 'posId', type: 'uint256' }],
    outputs: [],
  },
] as const;

function CoinCard({ 
  token, 
  onExpand 
}: { 
  token: CoinToken;
  onExpand: (token: CoinToken) => void;
}) {
  const formatNGT = (amount: bigint | undefined) => {
    if (!amount) return '0';
    return (Number(amount) / 1e18).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className={styles.coinCard} onClick={() => onExpand(token)}>
      {token.imageUrl ? (
        <img 
          src={token.imageUrl} 
          alt={token.name} 
          className={styles.coinImage}
        />
      ) : (
        <div className={styles.coinPlaceholder}>
          #{token.tokenId.toString()}
        </div>
      )}
      <span className={styles.coinName}>{token.name}</span>
      <span className={styles.coinId}>ID: {token.tokenId.toString()}</span>
      {token.ngtLocked !== undefined && (
        <span className={styles.ngtAmount}>{formatNGT(token.ngtLocked)} NGT</span>
      )}
      {token.craftedByMe !== undefined && (
        <span className={`${styles.craftedBadge} ${token.craftedByMe ? styles.craftedByMe : styles.notCrafted}`}>
          {token.craftedByMe ? "✓ Crafted by me" : "Not crafted by me"}
        </span>
      )}
    </div>
  );
}

function ExpandedCoinView({
  token,
  onClose,
  onDestroy,
}: {
  token: CoinToken;
  onClose: () => void;
  onDestroy: () => void;
}) {
  const formatNGT = (amount: bigint | undefined) => {
    if (!amount) return '0';
    return (Number(amount) / 1e18).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };
  
  console.log('[ExpandedCoinView] Token data:', {
    tokenId: token.tokenId.toString(),
    ngtLocked: token.ngtLocked?.toString(),
    craftedByMe: token.craftedByMe,
  });

  const formatDate = (timestamp: bigint | undefined) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString();
  };

  return (
    <div className={styles.expandedOverlay} onClick={onClose}>
      <div className={styles.expandedModal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>×</button>
        
        <div className={styles.expandedContent}>
          {token.imageUrl ? (
            <img 
              src={token.imageUrl} 
              alt={token.name} 
              className={styles.expandedImage}
            />
          ) : (
            <div className={styles.expandedPlaceholder}>
              #{token.tokenId.toString()}
            </div>
          )}
          
          <div className={styles.expandedDetails}>
            <h3 className={styles.expandedName}>{token.name}</h3>
            <div className={styles.expandedInfo}>
              <div className={styles.expandedInfoRow}>
                <span className={styles.expandedLabel}>Coin ID:</span>
                <span className={styles.expandedValue}>{token.tokenId.toString()}</span>
              </div>
              <div className={styles.expandedInfoRow}>
                <span className={styles.expandedLabel}>NGT Locked:</span>
                <span className={styles.expandedValue}>
                  {token.ngtLocked !== undefined ? `${formatNGT(token.ngtLocked)} NGT` : 'Loading...'}
                </span>
              </div>
              {token.unlockAt !== undefined && (
                <div className={styles.expandedInfoRow}>
                  <span className={styles.expandedLabel}>Unlocks At:</span>
                  <span className={styles.expandedValue}>{formatDate(token.unlockAt)}</span>
                </div>
              )}
              {token.isLocked && (
                <div className={styles.expandedInfoRow}>
                  <span className={styles.expandedLabel}>Status:</span>
                  <span className={styles.expandedValueLocked}>🔒 Time Locked</span>
                </div>
              )}
              {!token.isLocked && (
                <div className={styles.expandedInfoRow}>
                  <span className={styles.expandedLabel}>Status:</span>
                  <span className={styles.expandedValueUnlocked}>✓ Ready to Destroy</span>
                </div>
              )}
            </div>
            
            {/* Helper text above destroy button - ALWAYS SHOW */}
            <div className={styles.destroyHelperText}>
              {token.ngtLocked !== undefined ? (
                token.craftedByMe ? (
                  <>
                    You <strong>crafted</strong> this coin. You will receive <strong>{formatNGT(token.ngtLocked)} NGT</strong> and pay no fees if you destroy it.
                  </>
                ) : (
                  <>
                    You <strong>did not craft</strong> this coin. You will receive <strong>{formatNGT((token.ngtLocked * 90n) / 100n)} NGT</strong> total after paying <strong>{formatNGT((token.ngtLocked * 10n) / 100n)} NGT</strong> (destruction fee) to the crafter.
                  </>
                )
              ) : (
                <>
                  Loading position data...
                </>
              )}
            </div>
            
            <button
              className={`${styles.destroyButton} ${styles.destroyButtonLarge} ${token.isLocked ? styles.destroyButtonDisabled : ''}`}
              onClick={onDestroy}
              disabled={token.isLocked}
            >
              {token.isLocked ? '🔒 Still Locked' : '💥 DESTROY'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BagModal({
  isOpen,
  onClose,
  coinBalance,
  coinBalanceLoading,
  address,
}: BagModalProps) {
  const { tokens, isLoading, scan } = useCoinTokens();
  const [showCraftedOnly, setShowCraftedOnly] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [expandedToken, setExpandedToken] = useState<CoinToken | null>(null);
  
  const { writeContract, data: hash, isPending: isDestroying } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isOpen && address && !hasScanned) {
      scan();
      setHasScanned(true);
    }
  }, [isOpen, address, hasScanned, scan]);

  const handleExpand = (token: CoinToken) => {
    setExpandedToken(token);
  };

  const handleDestroy = async (token: CoinToken) => {
    if (token.isLocked) return;
    
    try {
      await writeContract({
        address: MASTER_CRAFTER_ADDRESS,
        abi: DESTROY_ABI,
        functionName: 'destroyPosition',
        args: [token.tokenId],
      });
    } catch (err) {
      console.error('[BagModal] Destroy failed:', err);
    }
  };

  // Close expanded view when transaction completes
  useEffect(() => {
    if (hash && !isConfirming && expandedToken) {
      setExpandedToken(null);
      // Refresh tokens after destroy
      setTimeout(() => {
        scan();
      }, 2000);
    }
  }, [hash, isConfirming, expandedToken, scan]);

  if (!isOpen) return null;

  const hasItems = coinBalance > 0;
  const filteredTokens = showCraftedOnly 
    ? tokens.filter(t => t.craftedByMe) 
    : tokens;

  return (
    <>
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>×</button>
        
        <h2 className={styles.title}>My Bag</h2>
        
        {!hasItems && !coinBalanceLoading ? (
          <div className={styles.empty}>
            <p>You have no items in your bag.</p>
          </div>
        ) : (
          <>
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Coins</h3>
                <label className={styles.filterLabel}>
                  <input
                    type="checkbox"
                    checked={showCraftedOnly}
                    onChange={(e) => setShowCraftedOnly(e.target.checked)}
                    className={styles.filterCheckbox}
                  />
                  <span>Crafted by me</span>
                </label>
              </div>
              <p className={styles.sectionHelperText}>Click coin to view/destroy</p>
              
              {isLoading ? (
                <div className={styles.loading}>
                  <div className={styles.spinner}></div>
                  <div className={styles.loadingMessage}>Loading coins...</div>
                </div>
              ) : filteredTokens.length === 0 ? (
                <div className={styles.empty}>
                  <p>{showCraftedOnly ? "No coins crafted by you." : "No coins found."}</p>
                </div>
              ) : (
                <div className={styles.grid}>
                  {filteredTokens.map(token => (
                    <CoinCard
                      key={token.tokenId.toString()}
                      token={token}
                      onExpand={handleExpand}
                    />
                  ))}
                  {/* Reserve space for loading items to prevent layout shift */}
                  {isLoading && filteredTokens.length > 0 && (
                    <div className={styles.coinCardPlaceholder}></div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    
    {expandedToken && (
      <ExpandedCoinView
        token={expandedToken}
        onClose={() => setExpandedToken(null)}
        onDestroy={() => handleDestroy(expandedToken)}
      />
    )}
    </>
  );
}

