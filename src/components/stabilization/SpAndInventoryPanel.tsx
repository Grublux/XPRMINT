// src/components/stabilization/SpAndInventoryPanel.tsx

import React from 'react';
import { useWalletSP } from '../../hooks/stabilizationV3/useWalletSP';
import { useWalletItemsSummary } from '../../hooks/stabilizationV3/useWalletItemsSummary';

export const SpAndInventoryPanel: React.FC = () => {
  const { sp, isLoading: spLoading } = useWalletSP();
  const { items, isLoading: itemsLoading } = useWalletItemsSummary();

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="rounded-xl border border-border bg-gradient-to-br from-slate-900/60 to-slate-900/20 p-4">
        <div className="text-xs font-medium text-muted-foreground">Stabilization Points (SP)</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">
          {spLoading ? '…' : sp.toString()}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Earned by burning items. SP is required to lock traits.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-background/60 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Item Inventory</h3>
          {itemsLoading && (
            <span className="text-[11px] text-muted-foreground">Loading…</span>
          )}
        </div>
        {items.length === 0 && !itemsLoading ? (
          <p className="text-xs text-muted-foreground">
            No stabilization items detected yet. Claim your starter pack or daily drip from the lab.
          </p>
        ) : (
          <div className="max-h-52 space-y-1 overflow-y-auto text-xs">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-md bg-slate-900/40 px-2 py-1"
              >
                <span className="font-mono text-[11px]">Item #{item.id}</span>
                <span className="text-[11px] text-emerald-300">x{item.balance.toString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

