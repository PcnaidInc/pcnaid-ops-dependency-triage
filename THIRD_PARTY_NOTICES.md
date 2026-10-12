# Third-Party Notices

This repository includes the following vendored software:

| Component | Version | Purpose | Included license |
|---|---|---|---|
| TypeScript | 5.8.3 | JavaScript/TypeScript parser and local symbol binding | `vendor/typescript/LICENSE.txt` (Apache 2.0); third-party notice file alongside it |
| node-semver | 7.7.2 | npm semantic-version comparison | `vendor/semver/LICENSE` (ISC) |

These components retain their respective copyright notices and terms. No credentials or private keys are included. Node.js itself is a prerequisite, not a bundled binary.

`vendor-manifest.json` records SHA-256 checksums of the delivered vendor files. `npm run verify:vendor` checks those files against the manifest. The application's `package.json` has zero registry-installed dependencies.
