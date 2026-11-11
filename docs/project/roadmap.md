# Caplink Roadmap

Phased plan from the approved product requirements and technical architecture (v1.0, 2026-11-11). Each phase has an explicit exit condition; a phase is not complete until its specification is approved, criteria satisfied, and verification run.

| Phase | Focus | Exit condition |
|---|---|---|
| **0 — Project foundation** | Migration tooling, environment contract, upsert bug fix, test + CI infrastructure, strict TS, error handling, dependency review | Reproducible, tested, migration-safe development foundation |
| **1 — Secure student accounts** | Server-side opaque sessions, email OTP verification, rate limits, cookie/CSRF hardening | Only verified eligible accounts reach protected functionality |
| **2 — Student profiles** | `student_profiles` table, profile create/edit, department, academic year, skills, visibility rules | Every verified student can maintain a reusable profile |
| **3 — Capstone discovery & listings** | Project model replacing demo listings, creation/editing, required skills, slots, status, search/filter, pagination, no public contact exposure | Students can publish and discover meaningful capstone opportunities |
| **4 — Connection system** | Connection requests (incoming/outgoing/accepted), accept/decline/cancel, duplicate prevention, optional contact sharing after acceptance | Students can safely connect through project opportunities |
| **5 — Pilot readiness** | Error/loading states, accessibility review, moderation basics, privacy/security review, deployment + backups, real-student testing | Stable pilot suitable for a limited EWU launch |

## Locked architecture decisions

- Modular monolith (no microservices, brokers, or split deployments).
- React 19 + TypeScript + Vite frontend; Express + TypeScript backend.
- SQLite via better-sqlite3; versioned numbered SQL migrations; foreign keys and indexes on.
- Authentication: university email OTP; opaque random server-side sessions; HttpOnly cookies.
- Contact details become visible only after an accepted connection, and only if explicitly shared.
- Email domain allowlist via configuration (`EWU_ALLOWED_EMAIL_DOMAINS`), never a student-ID pattern.

## Current status

See [`implementation-status.md`](implementation-status.md) for what is done, verified, and deferred.
