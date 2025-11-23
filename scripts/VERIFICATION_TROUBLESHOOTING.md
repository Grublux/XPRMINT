# ApeScan Verification Troubleshooting

## Bytecode Mismatch Error

If you get "Unable to find matching Contract Bytecode and ABI", try:

### Option 1: Use Standard JSON Input (Recommended)

Instead of "Single file", use **"Solidity (Standard JSON Input)"**:

1. Go to ApeScan verification page
2. Select **"Solidity (Standard JSON Input)"**
3. You'll need to generate the Standard JSON Input file

### Option 2: Check Compiler Settings Match Exactly

Ensure these match foundry.toml:
- Compiler: `0.8.24` (exact version, not ^0.8.20)
- EVM: `cancun`
- Optimizer: Enabled, Runs: `200`
- via IR: **NO** (unchecked)

### Option 3: Verify Pragma Version

The flattened contract uses `pragma solidity ^0.8.20;` but we compiled with `0.8.24`.
This should work, but if it doesn't, we may need to update the pragma in source files.

### Option 4: Try Without Flattening

Some explorers work better with Standard JSON Input that includes all source files separately.

