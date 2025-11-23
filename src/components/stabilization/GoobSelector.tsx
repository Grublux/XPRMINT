// src/components/stabilization/GoobSelector.tsx

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { useUserGoobs } from '../../hooks/goobs/useUserGoobs';
import { useGoobMetadata } from '../../hooks/goobs/useGoobMetadata';

interface GoobSelectorProps {
  selectedId: bigint | null;
  onChange: (id: bigint | null) => void;
}

export const GoobSelector: React.FC<GoobSelectorProps> = ({ selectedId, onChange }) => {
  const { chain } = useAccount();
  const { goobs, isLoading, isError, error, progress } = useUserGoobs();
  const [manualId, setManualId] = useState<string>('');
  const [showManual, setShowManual] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm text-muted-foreground">{progress.message}</div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300 ease-out"
            style={{ width: `${progress.progress}%` }}
          />
        </div>
        <div className="text-xs text-muted-foreground/70">
          {progress.stage === 'balance' && 'Checking wallet...'}
          {progress.stage === 'enumerate' && 'Trying enumeration...'}
          {progress.stage === 'events' && 'Scanning blockchain events...'}
          {progress.stage === 'verify' && 'Verifying ownership...'}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-sm text-red-400">
        Unable to load Goobs: {error?.message || 'Unknown error'}. Check console for details.
      </div>
    );
  }

  if (!goobs.length) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm text-muted-foreground">
          No Goobs detected automatically on {chain?.name || 'current network'}. 
          {chain?.id !== 33139 && (
            <span className="block mt-1 text-xs text-yellow-400">
              ⚠️ Make sure you're connected to ApeChain (chain ID: 33139)
            </span>
          )}
        </div>
        {!showManual ? (
          <button
            onClick={() => setShowManual(true)}
            className="text-xs text-emerald-400 hover:text-emerald-300 underline"
          >
            Enter Goob ID manually
          </button>
        ) : (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Goob ID</label>
            <input
              type="number"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="Enter Goob token ID"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (manualId) {
                    onChange(BigInt(manualId));
                  }
                }}
                className="text-xs px-3 py-1 rounded bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30"
              >
                Use This ID
              </button>
              <button
                onClick={() => {
                  setShowManual(false);
                  setManualId('');
                }}
                className="text-xs px-3 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ paddingTop: '20px', width: '100%' }}>
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 99px)',
        gap: '2px',
        width: '100%',
        justifyContent: 'start',
      }}>
        {goobs.map((g) => {
          const isSelected = selectedId === g.tokenId;
          return (
            <GoobCard
              key={g.tokenId.toString()}
              tokenId={g.tokenId}
              isSelected={isSelected}
              onSelect={() => onChange(isSelected ? null : g.tokenId)}
            />
          );
        })}
      </div>
      {selectedId && (
        <div className="text-xs text-muted-foreground text-center">
          Selected: Goob #{selectedId.toString()}
        </div>
      )}
    </div>
  );
};

// Separate component for Goob card with metadata
const GoobCard: React.FC<{
  tokenId: bigint;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ tokenId, isSelected, onSelect }) => {
  const { metadata, isLoading } = useGoobMetadata(tokenId);

  // Get image URL (prefer image_data for on-chain, fallback to image)
  const imageUrl = metadata?.image_data || metadata?.image || null;

  return (
    <button
      onClick={onSelect}
      style={{ 
        background: 'transparent',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'rgba(16, 185, 129, 0.2)',
        width: '99px',
        height: 'auto',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '4px',
        border: isSelected ? '2px solid rgb(16, 185, 129)' : '1px solid rgba(255, 255, 255, 0.2)',
        overflow: 'visible',
        transition: 'all 0.2s',
        margin: '0',
        padding: '0',
        boxSizing: 'border-box',
        flexShrink: 0,
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
          e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
      onTouchStart={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
          e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
        }
      }}
      onTouchEnd={(e) => {
        if (!isSelected) {
          setTimeout(() => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }, 150);
        }
      }}
    >
      {/* Image Section */}
      <div 
        style={{ 
          width: 'auto',
          height: 'auto',
          backgroundColor: 'rgba(128, 128, 128, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
          flexShrink: 0,
          padding: '0',
          margin: '0',
          position: 'relative',
        }}
      >
        {isLoading ? (
          <div style={{ fontSize: '8px', color: 'var(--muted)' }}>Loading...</div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={`Goob #${tokenId.toString()}`}
            style={{ 
              width: '99px',
              height: 'auto',
              objectFit: 'contain',
              padding: '0',
              margin: '0',
              display: 'block',
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div style={{ fontSize: '8px', color: 'var(--muted)' }}>No image</div>
        )}
      </div>

      {/* Info Section */}
      <div 
        style={{ 
          width: '100%',
          height: '33px',
          minHeight: '33px',
          padding: '4px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      >
        <div 
          style={{ 
            fontSize: '12px',
            fontWeight: 300,
            lineHeight: '1.2',
            textAlign: 'center',
            color: isSelected ? 'rgb(110, 231, 183)' : 'var(--muted)',
            marginBottom: isSelected ? '2px' : '0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            width: '100%',
          }}
        >
          #{tokenId.toString()}
        </div>
        {isSelected && (
          <div style={{ fontSize: '10px', color: 'rgb(16, 185, 129)', fontWeight: 300 }}>✓</div>
        )}
      </div>

      {/* Essence traits preview (if available) */}
      {metadata?.essence && Object.keys(metadata.essence).length > 0 && (
        <div style={{ 
          position: 'absolute',
          top: '4px',
          right: '4px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
        }}>
          {Object.entries(metadata.essence).slice(0, 2).map(([key, value]) => (
            <div
              key={key}
              style={{ 
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                backdropFilter: 'blur(4px)',
                fontWeight: 300,
                color: 'var(--muted)',
              }}
            >
              {String(value)}
            </div>
          ))}
        </div>
      )}
    </button>
  );
};

