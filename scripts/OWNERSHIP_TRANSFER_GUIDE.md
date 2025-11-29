# Ownership Transfer Guide

## Problem
The main ProxyAdmin (`0x0bdB9d6Cb50aD1DC1f1c664F9e8995Cd68e6C448`) is a **contract** that owns the individual ProxyAdmins:
- Catalog ProxyAdmin: `0xeAd73E3c41ae5277951cC13ef4192e47daD015Ae`
- ItemToken ProxyAdmin: `0xF5139B9f873a16f7b75a8E6AEBb2443cd6c068Ee`

Since the main ProxyAdmin is a contract (not an EOA), we cannot sign transactions as it to transfer ownership.

## Solutions

### Option 1: Manual Transfer via ApeScan (If Supported)
1. Go to ApeScan and connect your wallet
2. Navigate to each ProxyAdmin contract
3. Use the "Write Contract" tab to call `transferOwnership(newOwner)`
4. Sign the transaction

**Note:** This will only work if ApeScan supports contract-to-contract calls or if there's a way to execute as the contract owner.

### Option 2: Use a Multisig
If the main ProxyAdmin is controlled by a multisig:
1. Create a proposal to transfer ownership
2. Get required signatures
3. Execute the proposal

### Option 3: Deploy a Helper Contract
Deploy a contract that the main ProxyAdmin can call (though ProxyAdmin only has `upgradeAndCall` for proxies, so this is complex).

### Option 4: Accept Current Structure
If upgrades are infrequent, you can:
- Keep the current ownership structure
- Use the main ProxyAdmin's owner to coordinate upgrades
- Document the process for future upgrades

## Current Status
- ✅ New implementations deployed
- ⚠️  Ownership transfer pending
- ⏳ Upgrades waiting on ownership transfer

## Next Steps After Ownership Transfer
Once ownership is transferred to the deployer:
1. Run `UpgradeContracts.s.sol` to upgrade both contracts
2. Run `DeployItemImages.s.sol` to deploy images



