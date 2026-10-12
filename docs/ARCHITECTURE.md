# Architecture and Operating Boundaries — Dependency Triage Tool

## Execution Paths

The CLI reads input manifests, lockfiles, release notes, and source files, validates paths, and produces a prioritized upgrade brief.

1. **Manifest & Lockfile Diffing**: `src/triage/analyze.mjs` parses `package.json` dependency groups before and after updates. If npm `package-lock.json` v2/v3 is supplied, exact resolved versions for direct and transitive dependencies are extracted.
2. **Static Reference Scanner**: `scanUsage` initializes a virtual TypeScript program using the vendored TypeScript 5.8.3 compiler API (`ts.createProgram`, `ts.createSourceFile`). Source files are parsed into abstract syntax trees without executing code. The scanner identifies imported symbols, recognizes namespace calls, resolves destructured CommonJS bindings, and distinguishes local shadowing.
3. **Release Evidence Matching**: Release notes are scoped to exact version intervals (`from < version <= to`). Textual heuristic indicators (`breaking`, `deprecated`, `behavior`, `security`) are extracted and matched against static call sites.
4. **Heuristic Prioritization**: Dependencies are classified into `routine`, `review`, and `migration_required`.

## Data Lifecycle

- **Non-Execution Boundary**: Source files are parsed as data. No repository code, installation hooks, or lifecycle scripts are executed.
- **Safe Output Writing**: Reports are written to disk without overwriting existing files unless `--force` is specified. Symlinks are rejected.
- **Network Isolation**: The triage analysis is offline. The optional `releases` command performs read-only HTTPS GET requests against the public GitHub releases endpoint.

## Vendored Dependencies

TypeScript 5.8.3 and semver 7.7.2 are vendored directly in `vendor/`. Their file checksums are recorded in `vendor-manifest.json` and validated by `scripts/verify-vendor.mjs`.
