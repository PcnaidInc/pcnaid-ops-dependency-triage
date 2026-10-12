# @pcnaid/ops-dependency-triage

Local-first npm dependency upgrade triage tool for evaluating package updates using version interval changes, release evidence notes, and TypeScript AST static symbol binding analysis.

## What and why

Upgrading dependencies in large JavaScript and TypeScript codebases requires prioritizing developer review effort. Simple semver increments alone do not reveal whether your application actually invokes deprecated or breaking symbols.

`pcnaid-triage` performs local-first, static inspection:
- Resolves exact version transitions from root `package.json` and `package-lock.json` (v2/v3).
- Uses the TypeScript compiler API to parse source files, track imported symbols, distinguish local variable shadowing, and locate call sites.
- Correlates release notes and breaking change signals with direct static code references.
- Classifies updates into three advisory priority levels: `routine`, `review`, and `migration_required`.

The tool parses source files without executing code, installing dependencies, or modifying files.

## Install-free quickstart

Requires **Node.js >= 22.16.0**. Zero third-party npm registry dependencies.

```sh
# Verify vendored library integrity
npm run verify:vendor

# Syntax check all scripts and tests
npm run check

# Run tests
npm test

# Generate a fictional demonstration report
npm run demo
```

## Commands

### Run triage assessment
```sh
node bin/pcnaid-triage.mjs triage \
  --before examples/triage/before.package.json \
  --after examples/triage/after.package.json \
  --base-lock examples/triage/before.package-lock.json \
  --head-lock examples/triage/after.package-lock.json \
  --repo examples/triage/repository \
  --notes examples/triage/notes.json \
  --out reports/triage \
  --as-of 2026-10-05T12:00:00Z
```

Outputs:
- `report.json`: Machine-readable triage findings, static call references, and priority labels
- `report.html`: Self-contained HTML summary report
- `findings.csv`: CSV export of update queue and reasons
- `packet.zip`: Unsigned ZIP STORE packet with SHA-256 manifest

### Policy enforcement via exit code
Add `--fail-on review` or `--fail-on migration_required`. The tool writes all reports, then exits with code 2 if matching updates are identified:
```sh
node bin/pcnaid-triage.mjs triage \
  --before examples/triage/before.package.json \
  --after examples/triage/after.package.json \
  --repo examples/triage/repository \
  --out reports/triage \
  --fail-on migration_required
```

### Fetch published GitHub releases (read-only GET)
```sh
node bin/pcnaid-triage.mjs releases \
  --repository OWNER/REPOSITORY \
  --package PACKAGE_NAME \
  --from 1.0.0 \
  --to 2.0.0 \
  --out local-output/notes.json
```

### Retrospective benchmark harness
```sh
node scripts/benchmark.mjs cases.json results.json
```
Evaluates triage precision, recall, and escalation rates across a set of labeled historical upgrade cases.

## Data handling and security model

- **Source Code is Never Executed**: All AST scanning uses TypeScript's compiler parser in read-only mode without executing code or lifecycle scripts.
- **Strict Network Isolation**: The `triage` engine is fully offline. Only `releases` performs HTTPS GET requests to GitHub's public API.
- **Filesystem Traversal Protection**: Relative POSIX paths are strictly enforced; paths with `..` or leading slashes are rejected.
- **Vendored Dependencies**: TypeScript 5.8.3 and semver 7.7.2 are vendored directly and checksummed via `vendor-manifest.json` (`npm run verify:vendor`).

## Operating limits

1. **Advisory Prioritization**: Classification is heuristic and does not guarantee that a routine update is free of runtime bugs.
2. **Dynamic Imports & Re-exports**: Cross-file alias reassignment, re-exports, dynamic module loading, and runtime reflection are reported as coverage warnings rather than resolved call graphs.
3. **Lockfile Scope**: Supports npm `package-lock.json` v2/v3. Yarn/pnpm and automatic workspace resolution are not included.
