import React from 'react';
import { useItemBalances, useItemData } from '../../hooks/useItemBalances';

interface ItemInventoryProps {
  itemTokenAddress: `0x${string}`;
  creatureId: bigint;
}

const RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic'];
const TRAIT_NAMES = ['Salinity', 'pH', 'Temperature', 'Frequency', 'None'];

export function ItemInventory({ itemTokenAddress, creatureId }: ItemInventoryProps) {
  const { balances, isLoading } = useItemBalances(itemTokenAddress);

  if (isLoading) {
    return <div>Loading items...</div>;
  }

  return (
    <div className="item-inventory">
      <h3>Item Inventory</h3>
      <div className="items-grid">
        {balances
          .filter((b) => b.balance > 0n)
          .map(({ itemId, balance }) => (
            <ItemCard
              key={itemId.toString()}
              itemTokenAddress={itemTokenAddress}
              itemId={itemId}
              balance={balance}
              creatureId={creatureId}
            />
          ))}
      </div>
    </div>
  );
}

function ItemCard({
  itemTokenAddress,
  itemId,
  balance,
  creatureId,
}: {
  itemTokenAddress: `0x${string}`;
  itemId: bigint;
  balance: bigint;
  creatureId: bigint;
}) {
  const { data: itemData, isLoading } = useItemData(itemTokenAddress, itemId);

  if (isLoading || !itemData) {
    return <div>Loading...</div>;
  }

  const rarity = RARITY_NAMES[itemData.rarity] || 'Unknown';
  const primaryTrait = TRAIT_NAMES[itemData.primaryTrait] || 'None';
  const itemName = itemData.name || `${rarity} Item`;

  return (
    <div className="item-card">
      <div className="item-name">{itemName}</div>
      <div className="item-rarity">{rarity}</div>
      <div className="item-details">
        <div>Primary: {primaryTrait} (magnitude: {Math.abs(Number(itemData.primaryDelta))})</div>
        {itemData.secondaryTrait !== 4 && (
          <div>Secondary: {TRAIT_NAMES[itemData.secondaryTrait]} (magnitude: {Math.abs(Number(itemData.secondaryDelta))})</div>
        )}
        <div>Balance: {balance.toString()}</div>
        {itemData.description && (
          <div className="item-description">{itemData.description}</div>
        )}
      </div>
      <div className="item-actions">
        <button>Apply</button>
        <button>Burn for SP</button>
      </div>
    </div>
  );
}

