# Agent Guidelines for @pcnaid/ops-dependency-triage

This file provides architectural context and operational constraints for AI agents and automation working in this repository.

## Architecture

- `bin/pcnaid-triage.mjs`: CLI binary entry point.
- `src/cli.mjs`: CLI routing, argument parsing, policy exit code management, and report export.
- `src/triage/analyze.mjs`: Core dependency comparison, lockfile version resolution, AST symbol usage scanner using TypeScript, release note matching, and priority heuristic.
- `src/triage/releases.mjs`: GitHub release collector (read-only HTTPS GET).
- `scripts/benchmark.mjs`: Retrospective confusion-matrix benchmark harness.
- `scripts/verify-vendor.mjs`: SHA-256 integrity verifier for vendored libraries.
- `vendor/`: Vendored copies of `semver` and `typescript`.
- `vendor-manifest.json`: Checksums for vendored files.

## Operating Principles

1. **Zero External Dependencies**: Zero registry dependencies. Keep the vendored copies intact.
2. **Never Execute User Code**: User source code must only be passed into the TypeScript compiler parser (`createSourceFile`), never evaluated or imported dynamically.
3. **SSRF Protections**: Network requests in `releases` must enforce strict URL validation and public IP address checks.
4. **Advisory Outputs**: Clearly preserve unknown and review states when evidence or lockfile records are missing.
