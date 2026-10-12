# Security Policy

## Reporting Security Vulnerabilities

If you identify a security issue or vulnerability in this repository, please report it privately through **GitHub Private Vulnerability Reporting** on this repository:

1. Navigate to the **Security** tab of this repository.
2. Under "Reporting", click **Report a vulnerability**.
3. Fill out the report with reproduction steps and impact details.

Do not submit public issues or pull requests for security vulnerabilities. All reports are handled through private GitHub advisory channels.

## Security Architecture

- **No Execution of Repository Code**: Source code under analysis is parsed statically via TypeScript's compiler API. No user scripts, package scripts, or repository binaries are run.
- **Vendored Integrity**: All vendored code is strictly verified against SHA-256 digests in `vendor-manifest.json`.
- **SSRF / DNS Protection**: Network operations (such as `releases`) validate URLs against exact approved hosts, require HTTPS on standard port 443, and reject loopback, private, documentation, and transitional IP addresses.
- **Non-Symlink Enforcement**: Filesystem readers reject symlinks, and output writers prevent unexpected overwrites without `--force`.
