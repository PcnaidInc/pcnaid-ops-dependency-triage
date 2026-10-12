# Contributing to @pcnaid/ops-dependency-triage

Thank you for contributing to the dependency triage tool.

## Development Workflow

This codebase has **zero npm registry dependencies**. Vendored libraries (`semver` and `typescript`) are tracked and verified via `vendor-manifest.json`.

### Prerequisites
- Node.js >= 22.16.0
- npm >= 10.0.0

### Running Verification and Tests
Before opening a pull request, verify vendor integrity, syntax checks, and tests:

```sh
npm run verify:vendor
npm run check
npm test
npm run demo
```

All commands must exit cleanly with code 0.

## Coding Guidelines

1. **Security**: Maintain all security bounds. Never execute analyzed user source code; all inspection must use static AST parsing.
2. **Deterministic Triage**: Updates and findings must sort deterministically.
3. **Vendored Code Integrity**: Do not modify files in `vendor/` directly without updating `vendor-manifest.json` and accompanying notices.
4. **Transparent Warnings**: Surface coverage warnings whenever AST resolution cannot follow dynamic imports or re-exports.
