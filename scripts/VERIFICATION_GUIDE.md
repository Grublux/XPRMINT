# ApeScan Verification Guide

## Settings for All Contracts

- **License**: MIT
- **Compiler Type**: Solidity (Single file)
- **Compiler Version**: `0.8.24`
- **EVM Version**: `cancun`
- **Optimization**: Enabled
- **Optimization Runs**: `200`
- **via IR**: NO (must be unchecked/false)

## Contract Addresses & Flattened Files

### 1. ItemCatalog Implementation
- **Address**: `0x2ebceB5ede40137EBfF4b41415b8E2d22111814C`
- **ApeScan**: https://apescan.io/address/0x2ebceB5ede40137EBfF4b41415b8E2d22111814C#code
- **Flattened File**: `scripts/flattened/ItemCatalog_flattened.sol`
- **Constructor Args**: None (empty)

### 2. ItemToken1155 Implementation
- **Address**: `0x0cB8e24e15eB039888e29c98560f92B4dFfe7b43`
- **ApeScan**: https://apescan.io/address/0x0cB8e24e15eB039888e29c98560f92B4dFfe7b43#code
- **Flattened File**: `scripts/flattened/ItemToken1155_flattened.sol`
- **Constructor Args**: None (empty)

### 3. CreatureStabilizer Implementation
- **Address**: `0xcfAd6C9A826ABe43125eA57b86c9392F515B130B`
- **ApeScan**: https://apescan.io/address/0xcfAd6C9A826ABe43125eA57b86c9392F515B130B#code
- **Flattened File**: `scripts/flattened/CreatureStabilizer_flattened.sol`
- **Constructor Args**: None (empty)

### 4. ItemImageDeployer
- **Address**: `0xE72e4F0316767A9655A2e4b1Dc2A26a7AAf6FB03`
- **ApeScan**: https://apescan.io/address/0xE72e4F0316767A9655A2e4b1Dc2A26a7AAf6FB03#code
- **Flattened File**: `scripts/flattened/ItemImageDeployer_flattened.sol`
- **Constructor Args**: None (empty)

## Step-by-Step Verification Process

1. Visit the contract address on ApeScan
2. Click the **"Contract"** tab
3. Click **"Verify and Publish"**
4. Select:
   - **Compiler Type**: `Solidity (Single file)`
   - **License**: `MIT License (MIT)`
5. Paste the entire contents of the flattened `.sol` file
6. Fill in the settings:
   - **Compiler Version**: `0.8.24`
   - **EVM Version**: `cancun`
   - **Optimization**: Check **Enabled**
   - **Runs**: `200`
   - **via IR**: Leave **unchecked** (must be false)
7. **Constructor Arguments**: Leave empty (all contracts have no constructor args)
8. Click **"Verify and Publish"**

## Quick Copy-Paste Commands

To view flattened contracts:
```bash
cat scripts/flattened/ItemCatalog_flattened.sol
cat scripts/flattened/ItemToken1155_flattened.sol
cat scripts/flattened/CreatureStabilizer_flattened.sol
cat scripts/flattened/ItemImageDeployer_flattened.sol
```

## Notes

- All contracts use MIT license
- All contracts have no constructor arguments (empty)
- Proxies are OpenZeppelin standard contracts and can be verified separately
- Flattened files include all dependencies (OpenZeppelin, etc.)


