// src/hooks/stabilizationV3/useSimulatedItems.ts
// Hook to return all items (0-63) for simulation mode

export function useSimulatedItems() {
  // Return all 64 items (IDs 0-63) with balance of 1 each
  const items = Array.from({ length: 64 }, (_, i) => ({
    id: i,
    balance: 1n,
  }));

  return {
    items,
    isLoading: false,
    isError: false,
  };
}

