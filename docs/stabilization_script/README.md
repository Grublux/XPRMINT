# Creature Stabilization System - Implementation

This directory contains the complete v1 implementation of the Creature Stabilization & Resonance System, including Python simulation layer, Solidity contracts, tests, and frontend integration.

## Directory Structure

```
docs/stabilization_script/
├── sim/
│   ├── items/
│   │   ├── item_core.py          # Deterministic item generation
│   │   ├── apply_item.py          # Trait movement logic
│   │   └── generate_fixtures.py  # JSON fixture generator
│   ├── analysis/                  # Analysis scripts (future)
│   └── output/fixtures/          # Generated JSON fixtures for tests
├── config.py                      # Simulation configuration
├── models.py                      # Data models
├── sim_single.py                  # Single-creature simulation
└── sim_multi.py                   # Multi-wallet simulation

contracts/stabilization/
├── items/
│   ├── ItemGenerator.sol         # Pure library for item generation
│   └── ItemToken1155.sol         # ERC-1155 upgradeable token
└── CreatureStabilizer.sol        # Main stabilization contract

test/stabilization/
├── ItemGenerator.t.sol           # ItemGenerator golden tests
└── ApplyItem.t.sol               # Item application tests

scripts/deploy/
└── DeployUpgradable.s.sol        # Proxy deployment script

apps/web/src/
├── hooks/
│   ├── useItemBalances.ts        # Item balance hook
│   └── useBatchClaim.ts          # Batch claim hook
└── components/stabilization/
    ├── ItemInventory.tsx         # Item inventory component
    └── ApplyOrBurnItemModal.tsx  # Item action modal
```

## Quick Start

### 1. Python Simulation

```bash
cd docs/stabilization_script/sim
python3 -m sim.sim_single trials 1000  # Run single-creature Monte Carlo
python3 -m sim.sim_multi              # Run multi-wallet simulation
```

### 2. Generate Fixtures

```bash
cd docs/stabilization_script/sim/items
python3 generate_fixtures.py
```

### 3. Compile Contracts

```bash
forge build
```

### 4. Run Tests

```bash
forge test
```

### 5. Deploy

```bash
forge script scripts/deploy/DeployUpgradable.s.sol --rpc-url $RPC_URL --broadcast
```

## Key Features

- **Deterministic Item Generation**: Python and Solidity generate identical items
- **Upgradeable Contracts**: EIP-1967 TransparentUpgradeableProxy
- **ERC-1155 Items**: Tradeable items with on-chain metadata
- **Batch Operations**: Claim items for multiple creatures in one transaction
- **Time Management**: Configurable day length + admin time shifting
- **Golden Tests**: Foundry tests verify parity with Python simulation

## Implementation Notes

1. **ItemGenerator** is a pure library (no state, no constructor)
2. **ItemToken1155** and **CreatureStabilizer** are upgradeable
3. **Storage layout** is fixed and cannot be reordered
4. **Item encoding** uses bit-packing for gas efficiency
5. **Epic items** unlock after Day 7 with 2% drop rate

## Testing

Golden tests verify:
- Item generation matches Python exactly
- Trait movement logic matches simulation
- Epic behavior matches spec
- Lock costs and SP yields correct

## Next Steps

See `docs/IMPLEMENTATION_STATUS.md` for detailed status and TODOs.


