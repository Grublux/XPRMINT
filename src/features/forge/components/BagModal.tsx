"use client";

import { useState, useEffect } from "react";
import styles from "./BagModal.module.css";
import { useCoinTokens } from "../hooks/useCoinTokens";
import type { CoinToken } from "../hooks/useCoinTokens";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount } from "wagmi";
import { MASTER_CRAFTER_V4_PROXY } from "@/features/crafted/constants";
import { useNGTBalance } from "../hooks/useNGTBalance";

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

const GET_DESTROY_QUOTE_ABI = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getDestroyQuote',
    inputs: [
      { name: 'posId', type: 'uint256' },
      { name: 'destroyer', type: 'address' },
    ],
    outputs: [
      { name: 'totalLocked', type: 'uint256' },
      { name: 'npcFee', type: 'uint256' },
      { name: 'teamFee', type: 'uint256' },
      { name: 'refund', type: 'uint256' },
    ],
  },
] as const;

const APESCAN_BASE_URL = 'https://apescan.io/tx';

function CoinCard({ 
  token, 
  onExpand,
  isExpanded
}: { 
  token: CoinToken;
  onExpand: (token: CoinToken) => void;
  isExpanded?: boolean;
}) {
  const formatNGT = (amount: bigint | undefined) => {
    if (!amount) return '0';
    return (Number(amount) / 1e18).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div 
      className={`${styles.coinCard} ${isExpanded ? styles.coinCardExpanded : ''}`}
      onClick={() => onExpand(token)}
    >
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
  isDestroying,
  isConfirming,
  isSuccess,
  transactionHash,
  refundAmount,
  destroyQuote,
  isCrafter,
  quoteLoading,
}: {
  token: CoinToken;
  onClose: () => void;
  onDestroy: () => void;
  isDestroying?: boolean;
  isConfirming?: boolean;
  isSuccess?: boolean;
  transactionHash?: string;
  refundAmount?: string;
  destroyQuote?: readonly [string, string, string, string] | undefined;
  isCrafter?: boolean;
  quoteLoading?: boolean;
}) {
  const formatNGT = (amount: bigint | undefined) => {
    if (!amount) return '0';
    return (Number(amount) / 1e18).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };
  

  const formatDate = (timestamp: bigint | undefined) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCloseClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  return (
    <div className={styles.expandedOverlay} onClick={handleOverlayClick}>
      <div className={styles.expandedModal} onClick={e => e.stopPropagation()}>
        <button 
          className={styles.closeButton} 
          onClick={handleCloseClick}
          type="button"
        >
          ×
        </button>
        
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
              {quoteLoading ? (
                <>
                  Loading destruction quote...
                </>
              ) : destroyQuote && refundAmount !== undefined ? (
                isCrafter ? (
                  <>
                    You <strong>crafted</strong> this coin. You will receive <strong>{formatNGT(BigInt(refundAmount))} NGT</strong>
                    {BigInt(destroyQuote[2]) > 0n && (
                      <> (after <strong>{formatNGT(BigInt(destroyQuote[2]))} NGT</strong> team fee)</>
                    )}
                    {BigInt(destroyQuote[2]) === 0n && <> and pay no fees</>} if you destroy it.
                  </>
                ) : (
                  <>
                    You <strong>did not craft</strong> this coin. You will receive <strong>{formatNGT(BigInt(refundAmount))} NGT</strong> total after paying <strong>{formatNGT(BigInt(destroyQuote[1]))} NGT</strong> (destruction fee) to the crafter
                    {BigInt(destroyQuote[2]) > 0n && (
                      <> and <strong>{formatNGT(BigInt(destroyQuote[2]))} NGT</strong> team fee</>
                    )}.
                  </>
                )
              ) : token.ngtLocked !== undefined ? (
                // Fallback to old calculation if quote not available
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
            
            {isSuccess ? (
              <div className={styles.successState}>
                <div className={styles.successIcon}>✓</div>
                <div className={styles.successMessage}>
                  <div className={styles.successTitle}>Coin successfully destroyed!</div>
                  {refundAmount !== undefined && (
                    <div className={styles.successRefund}>
                      You received {formatNGT(refundAmount)} NGT
                    </div>
                  )}
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
                <button
                  className={styles.okButton}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onClose();
                  }}
                  type="button"
                >
                  OK
                </button>
              </div>
            ) : (isDestroying || isConfirming) ? (
              <div className={styles.destroyingState}>
                <div className={styles.spinner}></div>
                <div className={styles.destroyingMessage}>
                  Destroying {token.name} #{token.tokenId.toString()}
                </div>
              </div>
            ) : (
              <button
                className={`${styles.destroyButton} ${styles.destroyButtonLarge} ${token.isLocked ? styles.destroyButtonDisabled : ''}`}
                onClick={onDestroy}
                disabled={token.isLocked}
              >
                {token.isLocked ? '🔒 Still Locked' : '💥 DESTROY'}
              </button>
            )}
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
  const { address: accountAddress } = useAccount();
  
  // Get NGT balance refetch function to update balance after destroy
  const { refetch: refetchNGTBalance } = useNGTBalance();
  
  const { writeContract, data: hash, isPending: isDestroying } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isTxSuccess, data: receipt } = useWaitForTransactionReceipt({ hash });
  
  // Track if we've had a successful transaction to refetch on any close
  const hasSuccessfulTx = isTxSuccess;
  
  // Get destroy quote to calculate refund amount and fees
  const { data: destroyQuote, isLoading: quoteLoading } = useReadContract({
    address: MASTER_CRAFTER_V4_PROXY,
    abi: GET_DESTROY_QUOTE_ABI,
    functionName: 'getDestroyQuote',
    args: expandedToken && accountAddress 
      ? [expandedToken.tokenId, accountAddress] 
      : undefined,
    query: {
      enabled: !!expandedToken && !!accountAddress,
    },
  });
  
  // Extract quote data
  const totalLocked = destroyQuote?.[0];
  const npcFee = destroyQuote?.[1];
  const teamFee = destroyQuote?.[2];
  const refundAmount = destroyQuote?.[3]; // refund is the 4th return value
  
  // Determine if destroyer is the crafter by comparing refund calculation
  // Crafter: refund = totalLocked - teamFee
  // Non-crafter: refund = totalLocked - npcFee - teamFee
  const isCrafter = destroyQuote && totalLocked && refundAmount && teamFee
    ? refundAmount === (totalLocked - teamFee)
    : undefined;

  // Don't trigger scan here - useCoinTokens already auto-scans on mount
  // The hook handles scanning automatically, so we don't need to call it again

  const handleExpand = (token: CoinToken) => {
    // Small delay to prevent ghosting on mobile touch
    requestAnimationFrame(() => {
      setExpandedToken(token);
    });
  };

  const handleDestroy = async (token: CoinToken) => {
    if (token.isLocked) return;
    
    try {
      await writeContract({
        address: MASTER_CRAFTER_V4_PROXY,
        abi: DESTROY_ABI,
        functionName: 'destroyPosition',
        args: [token.tokenId],
      });
    } catch (err) {
      console.error('[BagModal] Destroy failed:', err);
    }
  };

  // Refresh tokens and NGT balance after transaction completes (but keep expanded view open for success message)
  useEffect(() => {
    if (isTxSuccess && expandedToken) {
      // Refresh NGT balance immediately
      refetchNGTBalance();
      
      // Refresh tokens after destroy
      setTimeout(() => {
        scan();
      }, 1000);
    }
  }, [isTxSuccess, expandedToken, scan, refetchNGTBalance]);

  // Handle close with NGT balance refetch if there was a successful transaction
  const handleClose = () => {
    if (hasSuccessfulTx) {
      refetchNGTBalance();
    }
    onClose();
  };

  if (!isOpen) return null;

  const hasItems = coinBalance > 0;
  const filteredTokens = showCraftedOnly 
    ? tokens.filter(t => t.craftedByMe) 
    : tokens;

  return (
    <>
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={handleClose}>×</button>
        
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
                      isExpanded={expandedToken?.tokenId === token.tokenId}
                    />
                  ))}
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
        onClose={() => {
          // Immediately close - no async operations should block this
          setExpandedToken(null);
          // Reset transaction state when closing (async, but doesn't block close)
          if (hasSuccessfulTx) {
            // Refresh NGT balance one more time to ensure it's up to date
            refetchNGTBalance();
            // Small delay to allow state cleanup
            setTimeout(() => {
              // Force refresh tokens one more time
              scan();
            }, 500);
          }
        }}
        onDestroy={() => handleDestroy(expandedToken)}
        isDestroying={isDestroying}
        isConfirming={isConfirming}
        isSuccess={isTxSuccess}
        transactionHash={hash}
        refundAmount={refundAmount ? String(refundAmount) : undefined}
        destroyQuote={destroyQuote ? destroyQuote.map(q => String(q)) as readonly [string, string, string, string] : undefined}
        isCrafter={isCrafter}
        quoteLoading={quoteLoading}
      />
    )}
    </>
  );
}

