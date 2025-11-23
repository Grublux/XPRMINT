import React, { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

interface ApplyOrBurnItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatureId: bigint;
  itemId: bigint;
  stabilizerAddress: `0x${string}`;
  itemTokenAddress: `0x${string}`;
}

const STABILIZER_ABI = [
  {
    inputs: [
      { name: 'creatureId', type: 'uint256' },
      { name: 'itemId', type: 'uint256' },
    ],
    name: 'applyItem',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'creatureId', type: 'uint256' },
      { name: 'itemId', type: 'uint256' },
    ],
    name: 'burnItemForSP',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export function ApplyOrBurnItemModal({
  isOpen,
  onClose,
  creatureId,
  itemId,
  stabilizerAddress,
  itemTokenAddress,
}: ApplyOrBurnItemModalProps) {
  const [action, setAction] = useState<'apply' | 'burn' | null>(null);

  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleApply = () => {
    if (!stabilizerAddress || !creatureId || !itemId) {
      console.error('Missing required parameters for applyItem');
      return;
    }
    setAction('apply');
    writeContract({
      address: stabilizerAddress,
      abi: STABILIZER_ABI,
      functionName: 'applyItem',
      args: [creatureId, itemId],
    });
  };

  const handleBurn = () => {
    if (!stabilizerAddress || !creatureId || !itemId) {
      console.error('Missing required parameters for burnItemForSP');
      return;
    }
    setAction('burn');
    writeContract({
      address: stabilizerAddress,
      abi: STABILIZER_ABI,
      functionName: 'burnItemForSP',
      args: [creatureId, itemId],
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Item Action</h2>
        <div className="modal-actions">
          <button onClick={handleApply} disabled={isPending || isConfirming}>
            {isPending && action === 'apply' ? 'Applying...' : 'Apply Item'}
          </button>
          <button onClick={handleBurn} disabled={isPending || isConfirming}>
            {isPending && action === 'burn' ? 'Burning...' : 'Burn for SP'}
          </button>
          <button onClick={onClose}>Cancel</button>
        </div>
        {error && <div className="error">Error: {error.message}</div>}
        {isSuccess && (
          <div className="success">
            {action === 'apply' ? 'Item applied!' : 'Item burned for SP!'}
            <button onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

