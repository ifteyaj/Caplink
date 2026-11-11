# Caplink Documentation

Documentation index for the Caplink project — an EWU-only platform for discovering capstone project teammates.

## Reading order

| Document | Purpose |
|---|---|
| [`CURRENT-STATUS.md`](CURRENT-STATUS.md) | One-page orientation: where the project is right now |
| [`product-overview.md`](product-overview.md) | What Caplink is, who it's for, what it does and will do |
| [`specs/002-authentication.md`](specs/002-authentication.md) | Phase 1 specification: verified accounts, OTP, sessions, rate limits |
| [`project/roadmap.md`](project/roadmap.md) | Phase 0–5 plan with exit conditions |
| [`project/implementation-status.md`](project/implementation-status.md) | Current state: completed, verified, deferred, limitations |
| [`project/changelog.md`](project/changelog.md) | Dated record of meaningful changes |
| [`project/dependency-review.md`](project/dependency-review.md) | npm audit classification and remediation decisions |
| [`2026-11-11-phase1-technical-audit.md`](2026-11-11-phase1-technical-audit.md) | Read-only technical audit the current work is based on |

## Development workflow

```sh
npm install          # install locked dependencies
npm run dev          # start dev server (runs migrations automatically)
npm run typecheck    # TypeScript check (same as lint)
npm test             # unit + integration tests (isolated temp databases)
npm run build        # production frontend build
```

Documentation rules:

- Update `project/implementation-status.md` when project state changes.
- Add a dated entry to `project/changelog.md` for durable decisions and meaningful work.
- Feature work follows the phase specs in the product requirements document.
