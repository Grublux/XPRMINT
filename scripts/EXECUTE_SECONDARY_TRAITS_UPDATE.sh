#!/bin/bash
# Execute Secondary Traits Update - Complete Process
# 
# This script executes all three steps:
# 1. Upgrade ItemCatalog contract
# 2. Update all secondary traits
# 3. Verify all updates

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
RPC_URL="${RPC_URL:-https://apechain.calderachain.xyz/http}"
CATALOG_PROXY="${ITEM_CATALOG_PROXY:-0x06266255ee081AcA64328dE8fcc939923eE6e8c8}"

echo -e "${GREEN}=== Secondary Traits Update - Complete Process ===${NC}\n"

# Check required environment variables
if [ -z "$DEPLOYER_PRIVATE_KEY" ] && [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}ERROR: DEPLOYER_PRIVATE_KEY or PRIVATE_KEY must be set${NC}"
    exit 1
fi

echo "Configuration:"
echo "  RPC URL: $RPC_URL"
echo "  Catalog Proxy: $CATALOG_PROXY"
echo "  Deployer: $(cast wallet address $([ -n "$DEPLOYER_PRIVATE_KEY" ] && echo "$DEPLOYER_PRIVATE_KEY" || echo "$PRIVATE_KEY") 2>/dev/null || echo "N/A")"
echo ""

# Step 1: Upgrade Contract
echo -e "${YELLOW}=== Step 1: Upgrading ItemCatalog Contract ===${NC}"
read -p "Press Enter to continue with contract upgrade, or Ctrl+C to cancel..."

ITEM_CATALOG_PROXY="$CATALOG_PROXY" \
forge script scripts/UpgradeItemCatalogForSecondaryTraits.s.sol:UpgradeItemCatalogForSecondaryTraits \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --verify

if [ $? -eq 0 ]; then
    echo -e "${GREEN}[OK] Contract upgraded successfully${NC}\n"
else
    echo -e "${RED}[ERROR] Contract upgrade failed${NC}"
    exit 1
fi

# Wait a bit for the transaction to be mined
echo "Waiting 10 seconds for transaction to be mined..."
sleep 10

# Step 2: Update Templates
echo -e "${YELLOW}=== Step 2: Updating Secondary Traits ===${NC}"
read -p "Press Enter to continue with template updates, or Ctrl+C to cancel..."

ITEM_CATALOG_PROXY="$CATALOG_PROXY" \
forge script scripts/UpdateSecondaryTraits.s.sol:UpdateSecondaryTraits \
  --rpc-url "$RPC_URL" \
  --broadcast

if [ $? -eq 0 ]; then
    echo -e "${GREEN}[OK] Templates updated successfully${NC}\n"
else
    echo -e "${RED}[ERROR] Template update failed${NC}"
    exit 1
fi

# Wait a bit for transactions to be mined
echo "Waiting 10 seconds for transactions to be mined..."
sleep 10

# Step 3: Verify Updates
echo -e "${YELLOW}=== Step 3: Verifying Updates ===${NC}"

ITEM_CATALOG_PROXY="$CATALOG_PROXY" \
forge script scripts/VerifySecondaryTraits.s.sol:VerifySecondaryTraits \
  --rpc-url "$RPC_URL"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}[OK] All templates verified successfully!${NC}\n"
else
    echo -e "${RED}[ERROR] Verification failed${NC}"
    exit 1
fi

echo -e "${GREEN}=== Complete! ===${NC}"
echo "All secondary traits have been updated successfully."
echo ""
echo "Next steps:"
echo "1. Clear frontend cache (localStorage, React Query)"
echo "2. Test item display in simulation mode"
echo "3. Test item display in real mode"
echo "4. Monitor marketplace indexing (Magic Eden, etc.)"

