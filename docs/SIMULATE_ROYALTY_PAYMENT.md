# Simulating Royalty Payments for Testing

## Overview

This guide shows how to simulate the complete royalty payment flow on ApeChain to verify that royalties accrue to the correct NPC.

## The Flow

1. **Craft a coin** using an NPC
2. **Simulate a royalty payment** (marketplace sends tokens to RoyaltyRouter)
3. **Credit the royalty** to the NPC that crafted the coin
4. **Verify** the NPC has accrued the royalty
5. **Claim** as the NPC owner

## Prerequisites

Set these environment variables:

```bash
export CRAFTED_V4_POSITIONS_PROXY=0x010d7003e4Fb1b27Cb79b403906Cf3081f2c793E
export MASTER_CRAFTER_V4_PROXY=0xB461b4c9ff5F14fd8CEcF48600B9E95905199a29
export ROYALTY_ROUTER_PROXY=0xbD5A38A8EB70d04F4ba8EFa82F9e85F22EE2784e
export NGT_TOKEN=0x72CddB64A72176B442bdfD9C8Bb7968E652d8D1a
export ROYALTY_TOKEN=0x<APE_OR_WAPE_TOKEN_ADDRESS>  # Set this to the actual APE/WAPE token
export NPC_COLLECTION=0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA
export DEPLOYER_PRIVATE_KEY=0x<your_key>
export RPC_URL_APECHAIN=https://apechain.calderachain.xyz/http
```

## Option 1: Use the Simulation Script

The script `script/SimulateRoyaltyPayment.s.sol` automates the flow:

```bash
# If you want to craft a new coin in the same script:
export TEST_NPC_ID=1919  # Your NPC ID
export TEST_RECIPE_ID=1

# Or if you already have a coin:
export POSITION_ID=2  # Your existing position/token ID

forge script script/SimulateRoyaltyPayment.s.sol \
  --rpc-url $RPC_URL_APECHAIN \
  --broadcast \
  -vv
```

## Option 2: Manual Step-by-Step

### Step 1: Craft a Coin (if needed)

```bash
# Check your NPCs
cast call $NPC_COLLECTION "balanceOf(address)(uint256)" $YOUR_ADDRESS --rpc-url $RPC_URL_APECHAIN

# Craft a coin (replace NPC_ID with your NPC)
cast send $MASTER_CRAFTER_V4_PROXY \
  "craftWithNPC(uint256,uint256)" \
  1 $NPC_ID \
  --rpc-url $RPC_URL_APECHAIN \
  --private-key $DEPLOYER_PRIVATE_KEY
```

Note the position ID from the transaction receipt.

### Step 2: Verify Royalty Info

```bash
export POSITION_ID=2  # Replace with your position ID

cast call $CRAFTED_V4_POSITIONS_PROXY \
  "royaltyInfo(uint256,uint256)(address,uint256)" \
  $POSITION_ID \
  1000000000000000000 \
  --rpc-url $RPC_URL_APECHAIN
```

Should return:
- Receiver: `0xbD5A38A8EB70d04F4ba8EFa82F9e85F22EE2784e` (RoyaltyRouter)
- Amount: `69000000000000000` (6.9% of 1 APE)

### Step 3: Get NPC ID for Position

```bash
cast call $MASTER_CRAFTER_V4_PROXY \
  "positionNpcIdView(uint256)(uint256)" \
  $POSITION_ID \
  --rpc-url $RPC_URL_APECHAIN
```

This tells you which NPC crafted this coin.

### Step 4: Simulate Royalty Payment

Transfer royalty tokens to RoyaltyRouter (simulating marketplace payment):

```bash
# Calculate royalty for 1 APE sale (6.9%)
# Royalty = (1e18 * 690) / 10000 = 69000000000000000 wei

# Transfer APE/WAPE to router
cast send $ROYALTY_TOKEN \
  "transfer(address,uint256)" \
  $ROYALTY_ROUTER_PROXY \
  69000000000000000 \
  --rpc-url $RPC_URL_APECHAIN \
  --private-key $DEPLOYER_PRIVATE_KEY
```

### Step 5: Credit Royalty to NPC

**Important**: `creditRoyalty()` can only be called by the positions contract. Use `cast` with `--from` to simulate:

```bash
# This simulates calling from the positions contract
cast send $ROYALTY_ROUTER_PROXY \
  "creditRoyalty(uint256,uint256)" \
  $POSITION_ID \
  69000000000000000 \
  --from $CRAFTED_V4_POSITIONS_PROXY \
  --rpc-url $RPC_URL_APECHAIN \
  --private-key $DEPLOYER_PRIVATE_KEY
```

**Note**: The `--from` flag in cast doesn't actually change `msg.sender`. For a real transaction, you'd need to either:
- Add a function to CraftedV4Positions that calls `creditRoyalty()`
- Or use a multisig/relayer that can call from the positions contract

### Step 6: Verify NPC Balance

```bash
export NPC_ID=1919  # Replace with the NPC that crafted your coin

cast call $ROYALTY_ROUTER_PROXY \
  "claimableForNpc(uint256)(uint256)" \
  $NPC_ID \
  --rpc-url $RPC_URL_APECHAIN
```

Should show the accrued royalty amount.

### Step 7: Claim as NPC Owner

```bash
cast send $ROYALTY_ROUTER_PROXY \
  "claimForNpc(uint256)" \
  $NPC_ID \
  --rpc-url $RPC_URL_APECHAIN \
  --private-key $DEPLOYER_PRIVATE_KEY
```

## The Missing Link: Automatic Crediting

Currently, there's a gap in the flow:

1. ✅ Marketplaces call `royaltyInfo()` → get RoyaltyRouter as receiver
2. ✅ Marketplaces send tokens to RoyaltyRouter
3. ❌ **But RoyaltyRouter doesn't know which positionId the payment is for**

The `creditRoyalty()` function requires `positionId`, but ERC2981 doesn't provide this context when tokens are sent.

### Solutions

**Option A: Add a function to CraftedV4Positions** (Recommended)
Add a function that marketplaces can call after paying royalties:

```solidity
function forwardRoyalty(uint256 tokenId, uint256 amount) external {
    // Verify payment was made to router
    // Call router.creditRoyalty(tokenId, amount)
}
```

**Option B: Use events/off-chain indexing**
- Marketplaces emit events with tokenId when paying royalties
- Off-chain service watches events and calls `creditRoyalty()`

**Option C: Manual crediting**
- For now, manually call `creditRoyalty()` after each royalty payment
- Can be automated via a service that monitors RoyaltyRouter balance changes

## Testing with Foundry Scripts

The simulation script uses `vm.prank()` to call `creditRoyalty()` from the positions contract address, which works in Foundry but not in real transactions.

For real on-chain testing, you'd need to implement Option A above.

