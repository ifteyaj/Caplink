# Caplink — Product Overview

**For:** anyone who wants to understand what Caplink is, who it's for, and where it's going — without reading the full technical specification.
**Last updated:** 2026-11-11 · **Status:** Phase 0 complete, Phase 1 next

---

## What Caplink is

Caplink is a website for **East West University (EWU) students to find teammates for their capstone projects** — and for students who already have a project or a team to find the missing people they need.

In one line: **Find your people. Build your capstone.**

## The problem it solves

Every semester, capstone students face the same awkward search: they have an idea but no team, or a team but an empty seat, and no reliable place to connect. Group chats, Facebook groups, and word of mouth are noisy, untrustworthy, and disappear after graduation. Caplink gives that search one dedicated, trusted home.

## Who it's for

- **Students looking for a team** — you have the skills or the motivation, but no group yet.
- **Students building a team** — you have a project (or a partial team) and open slots to fill.
- **(Future) administrators** — internal role for moderation and platform management; the data model leaves room for it, but it does not delay the student launch.

Only verified EWU student accounts can participate. That rule is the foundation of everything else.

## What it does today (honest state)

Caplink is a working web app with a real core loop — you can log in, browse listings, post one, and manage your own:

- **Explore page** — browse student listings, search by name/idea/skill, filter by type (looking-for-group vs group-needs-members) and major.
- **Listings** — post a capstone opportunity with your course, major, project idea, skills needed, and open slots; delete your own listings.
- **Accounts** — sign in with an EWU-format student email; the platform remembers you between visits.

**What is deliberately not production-ready yet:** login is still the original demo mechanism (a signed-in cookie, not real verification), and contact details are visible to any logged-in user. Both are scheduled to be replaced in Phase 1 and Phase 3 — they are the top-priority items on the roadmap, not accidents. The technical audit in `docs/` lists every known issue.

## What it will do (the plan)

Development is phased; each phase must fully pass its exit condition before the next begins.

| Phase | What students get | Status |
|---|---|---|
| 0 — Foundation | Nothing visible — reliable migrations, tests, CI, strict type-safety underneath everything | ✅ **Complete** |
| 1 — Trusted accounts | Real email verification (one-time code), secure server-side sessions, rate limiting | ⏳ Next |
| 2 — Student profiles | A reusable profile: name, department, year, skills, interests, intro | Planned |
| 3 — Project discovery | The listing model becomes real **projects**: titles, descriptions, required skills, open slots, statuses (active/filled/closed), better search | Planned |
| 4 — Connections | Request-to-join flow: send, accept, decline, cancel — and only after an accepted connection is any contact detail shared, only if chosen | Planned |
| 5 — Pilot launch | Polish, accessibility, moderation basics, deployment + backups, testing with real EWU students | Planned |

The end state of the MVP: a verified EWU student completes a profile, publishes or finds a capstone opportunity, sends or receives a connection request, and ends up on an actual team — with contact details exchanged only between accepted connections.

## How it works (plain-language architecture)

Caplink is deliberately simple — **one app, one server, one database** (a "modular monolith"):

- **The website** (React) — everything you see and click, served by the same server.
- **The API** (Express/TypeScript) — the rules engine: who you are, what you may post, what you may edit or delete.
- **The database** (SQLite) — accounts, profiles, projects, and connections, with strict ownership rules; changes to its structure happen through numbered migrations that never destroy existing data.
- **Verification & sessions** (Phase 1) — prove you own an eligible EWU email with a one-time code, then get a secure, expiring, server-tracked session. Trust comes from a verified email + configured domain allowlist — never from a claimed student-ID pattern.

Nothing is outsourced to third parties for identity, and student emails are never sent to external avatar or tracking services.

## Trust & privacy principles

1. **Only verified EWU accounts** can post, browse contact info, or connect.
2. **Contact details are never public** — they are revealed only after an accepted connection, and only what a student chose to share.
3. **You control your own data** — edit your profile, close or reopen your listings; nobody else can delete your content.
4. **No scope creep** — no AI matching, in-app chat, mobile apps, or multi-university support until the core loop proves itself with real students.

## How success is measured

The pilot targets for launch: 50 verified accounts, 35 completed profiles, 15 active capstone listings, 20 connection requests, and **5 real teams formed**. Registrations don't matter; formed teams do.

## Where to read more

- [`project/roadmap.md`](project/roadmap.md) — the phase plan and locked decisions
- [`project/implementation-status.md`](project/implementation-status.md) — exactly where development stands today
- [`2026-11-11-phase1-technical-audit.md`](2026-11-11-phase1-technical-audit.md) — the full security/quality audit this work is based on
- [`project/dependency-review.md`](project/dependency-review.md) · [`project/changelog.md`](project/changelog.md) — supply-chain posture and change history
