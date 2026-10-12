# Dependency Triage Guide

## Supported Inputs

Provide the root `package.json` before and after an update. Supplying npm `package-lock.json` version 2 or 3 enables exact version resolution and captures installed transitive instances. Yarn, pnpm, and npm lockfile v1 are not supported.

The source tree scanner accepts `.js`, `.jsx`, `.ts`, `.tsx`, `.cjs`, `.mjs`, `.cts`, and `.mts` files. It skips hidden directories, symlinks, build/vendor directories, minified `.min.js` files, and individual files exceeding 500 KB. The total scan limit is 1,500 files or 15 MiB.

The TypeScript compiler API resolves local ESM imports and simple CommonJS bindings, detects local shadowing, and records file and line coordinates. Dynamic imports, cross-file re-exports, and runtime reflection emit coverage warnings.

## Release Evidence Format

`notes.json` contains an array of release note objects:

```json
[
  {
    "package": "@example/client",
    "version": "2.0.0",
    "text": "Breaking: removed `oldMethod`; migrate to `newMethod`.",
    "url": "https://example.com/releases/2.0.0",
    "source": "user_supplied"
  }
]
```

Notes are correlated only when exact versions are available and the note version satisfies `oldVersion < version <= newVersion`.

The optional `releases` command collects published GitHub releases:

```sh
node bin/pcnaid-triage.mjs releases \
  --repository OWNER/REPOSITORY \
  --package PACKAGE_NAME \
  --from 1.0.0 \
  --to 2.0.0 \
  --out local-output/notes.json
```

## Priority Categories

- `routine`: No escalation signals detected in version intervals, release notes, or static references. Standard CI and human review apply.
- `review`: Unresolved versions, missing evidence, major or pre-1.0 version jumps, changed engine or peer constraints, transitive updates, or coverage gaps require inspection.
- `migration_required`: A breaking-change release note references a symbol that directly matches an identified static call site.

Use `--fail-on review` or `--fail-on migration_required` to exit with code 2 upon matching conditions. Exit code 0 indicates success with no triggered policy failure.

## Retrospective Benchmark Harness

Run `node scripts/benchmark.mjs cases.json results.json` to evaluate triage performance against a dataset of labeled update outcomes.
