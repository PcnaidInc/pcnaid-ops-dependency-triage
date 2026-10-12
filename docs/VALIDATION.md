# Validation Record — Dependency Triage Tool v0.1.0

This record describes the automated checks and test coverage for the dependency triage tool.

## Execution Environment

- Node.js >= 22.16.0
- Linux x86_64
- Zero runtime npm registry dependencies; vendored TypeScript 5.8.3 and semver 7.7.2

## Automated Checks

| Check | Result | Exit Code |
|---|---|---|
| Vendored Integrity Check (`node scripts/verify-vendor.mjs`) | **51 vendored files matched manifest** | **0** |
| Unit & Integration Tests (`node scripts/test.mjs`) | **77 passed; 0 failed** | **0** |
| Syntax Verification (`node scripts/check.mjs`) | **19 files passed** | **0** |
| Fictional Demo Generation (`node scripts/demo.mjs`) | **Generated reports/triage** | **0** |

## Test Scope

Tests exercise:
- Differentiation between routine updates and breaking changes
- Named import aliases and local parameter shadowing
- Namespace property access (`sdk.createInvoice()`)
- Destructured CommonJS require bindings and shadowed `require` functions
- Dynamic import and re-export coverage warnings
- Syntactic parse errors and legacy lockfile warnings
- Transitive dependency version tracking
- Path traversal rejection in source file inputs
- Policy exit codes (`--fail-on`)
- Retrospective benchmark harness metric calculations
- SSRF and network URL validation for GitHub releases
