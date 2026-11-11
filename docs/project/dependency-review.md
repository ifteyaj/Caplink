# Dependency & Security Review — Phase 0

**Date:** 2026-11-11
**Method:** `npm audit --json` baseline → `npm audit fix` (non-forced) → full re-verification → final audit. Per SPEC-001 Workstream I: no `--force`, no blind upgrades.

## Result summary

| State | Critical | High | Moderate | Low | Total |
|---|---|---|---|---|---|
| Baseline (start of Phase 0, incl. test deps) | 3 | 12 | 8 | 2 | 25 |
| After `npm audit fix` (non-forced) | 2 | 0 | 6 | 1 | **9** |

Non-breaking fixes applied by `npm audit fix` resolved every high-severity finding, including the audit's critical `proxy-addr` (express chain) and all `path-to-regexp` ReDoS findings. Production runtime dependencies moved within semver ranges only: `zod 4.3.6 → 4.6.7`, `vite 6.4.1 → 6.4.6` (plus transitive bumps). `express` stays 4.22.1, `better-sqlite3` stays 12.6.2.

## Verification after dependency changes

- `npm run typecheck` (strict) — passed
- `npm test` — 29/29 passed
- `npm run build` — passed

## Remaining findings and planned actions

| Package | Severity | Dependency path | Production runtime? | Planned action |
|---|---|---|---|---|
| `vitest` (path traversal via @vitest/mocker) | critical | devDependency (test runner) | No — test-time only | Upgrade vitest 3 → 5 as a dedicated change; re-run the full suite |
| `tinypool` (prototype pollution → RCE) | critical | via vitest | No — test-time only | Same upgrade as above |
| `@vitest/coverage-v8`, `glob`, `minimatch`, `test-exclude`, `@vitest/mocker` | moderate | via vitest/coverage chain | No | Same upgrade as above |
| `qs` | moderate | express (query parsing) | Yes | Fix requires express chain bump not available in-range; monitor; risk is query-parser DoS — app has no trust-proxy and is same-origin |
| `esbuild` | low | vite dev server | No — dev/build only | Resolves with future vite minor/major |

## Rules honored

- `npm audit fix --force` was **not** run.
- No semver-major upgrade was hidden inside Phase 0 (vitest stays 3.2.7).
- Dev-only vs production reachability is recorded for every remaining finding.
- Full verification (typecheck, tests, build) ran after every dependency change.
