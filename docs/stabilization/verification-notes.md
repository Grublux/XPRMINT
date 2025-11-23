# ApeScan Verification Notes

## Compiler Settings for Production Deployments

All stabilization system contracts must be compiled with the following exact settings for ApeScan verification to match deployed bytecode:

### Foundry Configuration

```toml
[profile.default]
solc_version = "0.8.24"
evm_version = "cancun"
optimizer = true
optimizer_runs = 200
via_ir = false
```

### Critical Settings

- **`via_ir = false`**: This is **required** for ApeScan verification. The via-IR pipeline produces bytecode that is harder to verify on block explorers.
- **`solc_version = "0.8.24"**: Must match exactly between deployment and verification.
- **`evm_version = "cancun"**: EVM version for ApeChain compatibility.
- **`optimizer = true`** with **`optimizer_runs = 200`**: Standard optimization settings.

### Verification Process

When verifying contracts on ApeScan:

1. Use the **exact compiler settings** listed above.
2. Select **Solidity (Standard JSON Input)** as the compiler type.
3. Ensure the compiler version is **0.8.24**.
4. Enable optimization with **200 runs**.
5. **Do NOT** enable "via-IR" or "via Yul" options.

### Contracts to Verify

- `ItemCatalog.sol` (implementation)
- `ItemToken1155.sol` (implementation)
- `CreatureStabilizer.sol` (implementation)
- `ItemImageDeployer.sol`
- `ProxyAdmin.sol` (from OpenZeppelin)

### Important Notes

- **Any change to these compiler settings must be deliberate and coordinated** to avoid mismatch between deployed bytecode and verification settings.
- If you need to change compiler settings (e.g., for gas optimization), ensure:
  1. All contracts are recompiled with the new settings
  2. All contracts are redeployed
  3. Verification settings are updated to match
  4. Documentation is updated

### Checking Current Settings

To verify your current Foundry configuration:

```bash
forge config
```

Ensure `via_ir` is set to `false` in the output.


