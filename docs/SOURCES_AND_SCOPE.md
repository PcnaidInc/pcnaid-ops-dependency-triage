# Sources and Scope Decisions — Dependency Triage Tool

## Technical Scope Decisions

1. **Static AST Analysis**: The tool inspects JavaScript and TypeScript source files using the official TypeScript Compiler API. It never executes source code or runs package scripts.
2. **Lockfile Version Resolution**: Supports npm `package-lock.json` v2 and v3. Lock v1, yarn, and pnpm formats are not expanded.
3. **No Automated Code Changes**: The tool prioritizes upgrades for human review; it does not install packages, edit code, or merge pull requests.

## Primary Technical References Consulted

- TypeScript Compiler API documentation: https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
- GitHub Releases REST API documentation: https://docs.github.com/en/rest/releases/releases
- Node.js HTTPS module documentation: https://nodejs.org/api/https.html
- Semantic Versioning 2.0.0 specification: https://semver.org/
