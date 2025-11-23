#!/bin/bash
# Verify all deployed contracts on ApeScan
# Usage: ./scripts/verify_contracts.sh
#
# Note: ApeChain supports Sourcify verification. If forge verify-contract doesn't work,
# use the ApeScan UI: https://apescan.io/address/<CONTRACT_ADDRESS>#code

set -e

source .env

# Compiler settings (must match foundry.toml)
SOLC_VERSION="0.8.24"
OPTIMIZER_RUNS=200
EVM_VERSION="cancun"
CHAIN_ID=33139

echo "=== Verifying Contracts on ApeScan (Chain ID: $CHAIN_ID) ==="
echo "Compiler: $SOLC_VERSION, Optimizer: enabled (runs=$OPTIMIZER_RUNS), EVM: $EVM_VERSION"
echo ""

# Try Sourcify first (recommended for ApeChain)
VERIFIER="sourcify"

echo "Using verifier: $VERIFIER"
echo ""

# Verify implementations (these have constructor args)
echo "1. Verifying ItemCatalog Implementation..."
forge verify-contract \
    --verifier $VERIFIER \
    --verifier-url https://sourcify.dev/server \
    --chain-id $CHAIN_ID \
    --num-of-optimizations $OPTIMIZER_RUNS \
    --compiler-version $SOLC_VERSION \
    0x2ebceB5ede40137EBfF4b41415b8E2d22111814C \
    contracts/stabilization/items/ItemCatalog.sol:ItemCatalog \
    --constructor-args $(cast abi-encode "constructor()") 2>&1 || echo "⚠️  Failed - try manual verification via ApeScan UI"

echo ""
echo "2. Verifying ItemToken1155 Implementation..."
forge verify-contract \
    --verifier $VERIFIER \
    --verifier-url https://sourcify.dev/server \
    --chain-id $CHAIN_ID \
    --num-of-optimizations $OPTIMIZER_RUNS \
    --compiler-version $SOLC_VERSION \
    0x0cB8e24e15eB039888e29c98560f92B4dFfe7b43 \
    contracts/stabilization/items/ItemToken1155.sol:ItemToken1155 \
    --constructor-args $(cast abi-encode "constructor()") 2>&1 || echo "⚠️  Failed - try manual verification via ApeScan UI"

echo ""
echo "3. Verifying CreatureStabilizer Implementation..."
forge verify-contract \
    --verifier $VERIFIER \
    --verifier-url https://sourcify.dev/server \
    --chain-id $CHAIN_ID \
    --num-of-optimizations $OPTIMIZER_RUNS \
    --compiler-version $SOLC_VERSION \
    0xcfAd6C9A826ABe43125eA57b86c9392F515B130B \
    contracts/stabilization/CreatureStabilizer.sol:CreatureStabilizer \
    --constructor-args $(cast abi-encode "constructor()") 2>&1 || echo "⚠️  Failed - try manual verification via ApeScan UI"

echo ""
echo "4. Verifying ItemImageDeployer..."
forge verify-contract \
    --verifier $VERIFIER \
    --verifier-url https://sourcify.dev/server \
    --chain-id $CHAIN_ID \
    --num-of-optimizations $OPTIMIZER_RUNS \
    --compiler-version $SOLC_VERSION \
    0xE72e4F0316767A9655A2e4b1Dc2A26a7AAf6FB03 \
    contracts/stabilization/items/ItemImageDeployer.sol:ItemImageDeployer \
    --constructor-args $(cast abi-encode "constructor()") 2>&1 || echo "⚠️  Failed - try manual verification via ApeScan UI"

echo ""
echo "=== Manual Verification (if automated fails) ==="
echo ""
echo "For each contract, visit: https://apescan.io/address/<ADDRESS>#code"
echo "Click 'Verify and Publish' and use these settings:"
echo "  - Compiler: $SOLC_VERSION"
echo "  - EVM Version: $EVM_VERSION"
echo "  - Optimizer: Enabled"
echo "  - Runs: $OPTIMIZER_RUNS"
echo "  - via IR: NO (must be false)"
echo ""
echo "Contract Addresses:"
echo "  ItemCatalog: https://apescan.io/address/0x2ebceB5ede40137EBfF4b41415b8E2d22111814C#code"
echo "  ItemToken1155: https://apescan.io/address/0x0cB8e24e15eB039888e29c98560f92B4dFfe7b43#code"
echo "  CreatureStabilizer: https://apescan.io/address/0xcfAd6C9A826ABe43125eA57b86c9392F515B130B#code"
echo "  ItemImageDeployer: https://apescan.io/address/0xE72e4F0316767A9655A2e4b1Dc2A26a7AAf6FB03#code"
echo ""
echo "=== Note: Proxies are OpenZeppelin standard contracts ==="
echo "Proxies can be verified via ApeScan UI using OpenZeppelin's verified source code."
echo ""
echo "=== Verification Complete ==="

