#!/usr/bin/env bash
set -euo pipefail

if [ -z "${RPC_URL:-}" ]; then
    echo "ERROR: RPC_URL environment variable is not set"
    echo "Set it with: export RPC_URL=https://your-rpc-url"
    exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "=========================================="
echo "Bytecode Verification"
echo "=========================================="
echo ""

echo "Step 1: Building local contracts"
echo "------------------------------------------------------------"
forge clean > /dev/null 2>&1 || true

# Build all three contracts explicitly
if ! forge build contracts/crafted/CraftedV5Positions.sol contracts/crafted/MasterCrafterV5.sol contracts/stats/NPCStatsV5.sol > /dev/null 2>&1; then
    echo "ERROR: Failed to build contracts"
    exit 1
fi
echo "Build complete"
echo ""

echo "Step 2: Extracting and comparing bytecode"
echo "------------------------------------------------------------"

FAILED=false

verify_bytecode() {
    local contract_name="$1"
    local contract_path="$2"
    local impl_address="$3"
    
    echo -n "Verifying $contract_name... "
    
    local_file=$(mktemp)
    chain_file=$(mktemp)
    
    # Extract bytecode from JSON artifact
    artifact_path="out/${contract_name}.sol/${contract_name}.json"
    if [ -f "$artifact_path" ]; then
        if ! jq -r '.deployedBytecode.object' "$artifact_path" > "$local_file" 2>/dev/null; then
            echo "FAIL - Could not extract local bytecode from artifact"
            rm -f "$local_file" "$chain_file"
            FAILED=true
            return
        fi
    else
        echo "FAIL - Artifact not found: $artifact_path"
        rm -f "$local_file" "$chain_file"
        FAILED=true
        return
    fi
    
    if ! cast code "$impl_address" --rpc-url "$RPC_URL" > "$chain_file" 2>/dev/null; then
        echo "FAIL - Could not fetch on-chain bytecode"
        rm -f "$local_file" "$chain_file"
        FAILED=true
        return
    fi
    
    local_hex=$(cat "$local_file" | tr -d '[:space:]' | sed 's/^0x//')
    chain_hex=$(cat "$chain_file" | tr -d '[:space:]' | sed 's/^0x//')
    
    if [ -z "$local_hex" ] || [ -z "$chain_hex" ]; then
        echo "FAIL - Empty bytecode"
        rm -f "$local_file" "$chain_file"
        FAILED=true
        return
    fi
    
    local_hash=$(echo -n "$local_hex" | xxd -r -p | sha256sum | cut -d' ' -f1)
    chain_hash=$(echo -n "$chain_hex" | xxd -r -p | sha256sum | cut -d' ' -f1)
    
    if [ "$local_hash" = "$chain_hash" ]; then
        echo "PASS"
    else
        echo "FAIL"
        echo "  Local hash:  $local_hash"
        echo "  Chain hash:  $chain_hash"
        FAILED=true
    fi
    
    rm -f "$local_file" "$chain_file"
}

verify_bytecode "CraftedV5Positions" "contracts/crafted/CraftedV5Positions.sol:CraftedV5Positions" "0x8fe0d49d2a4661fad205741394ba8dc738bda13c"
verify_bytecode "MasterCrafterV5" "contracts/crafted/MasterCrafterV5.sol:MasterCrafterV5" "0xaf1d8ceccd43e49f9a04a385c024b470aae70806"
verify_bytecode "NPCStatsV5" "contracts/stats/NPCStatsV5.sol:NPCStatsV5" "0x00322ab5bb7c37120373c053b4956f60786505be"

echo ""

if [ "$FAILED" = "true" ]; then
    echo "ERROR: Bytecode verification failed"
    exit 1
fi

echo "All bytecode verifications passed!"
