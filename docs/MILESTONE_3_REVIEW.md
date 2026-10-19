# Milestone 3 review — work in progress

The user authorized competition/season development, then required verified current squads. On 17 October they asked to proceed without the database and return to source research next week. Independent development now includes an explicit generic season demo, separate from real-data careers. Real-data integration still requires actual 2026/27 Premier League membership and complete squad assignments as of 16 October 2026, supported by dated authoritative evidence and permitted use.

**The real-data milestone is not complete.** No qualifying current dataset has been established. The source-gated foundation exists, with real-data season creation disabled pending review. The database-free development demo uses generic scenario inputs without creating roster evidence or changing ordinary saves. Existing Milestone 2 exhibitions and their reported Mac checks remain separate; no Mac season review has occurred.

## What is implemented

- Pure twenty-club scheduling: 380 fixtures, 38 weekly rounds, 19 home and 19 away appearances per club.
- Managed match checkpoints, tactics and substitutions using the existing match engine, with other fixtures simulated by the same model.
- Complete-round result staging, 3/1/0 league tables and separate calendar progression.
- Explicit bounded abandonment retries, retaining audit history without rerolling completed results.
- Dated squad-evidence contract/import, per-club readiness display and a disabled creation path while data is missing.
- Versioned career-bound season archives, additive Dexie schema-2 storage and transactional career/date guards.

These are implementation boundaries, not a claim that an actual 2026/27 season is playable. The scheduler and final stable-ID table tie-break are original game rules; the official Premier League fixture list and full regulation set are not supplied. [SEASON_ENGINE.md](SEASON_ENGINE.md) documents exact behavior, APIs and limitations.

## Current data gate

[CURRENT_SQUAD_SOURCES.md](data/CURRENT_SQUAD_SOURCES.md) records attempted sources, actual access and rights findings. Official Premier League main-site HTML now responds after the initial proxy failures. Its 2026/27 marker does not establish a twenty-club membership list or squads. Its terms require prior written approval for the intended database reuse; no such approval has been obtained. A later 17 October provider review found accessible Sportmonks terms explicitly permitting game use and API-data storage/transfer, documented Premier League coverage and a paid squad-data plan. Sportmonks is the recommended candidate; no account entitlement, actual roster payload or perpetual post-cancellation use has been verified. Current verified membership, squad-publication and player-assignment counts remain zero. Provider documentation access no longer blocks this review, but actual current-data acquisition and verification remain outstanding.

There is no original roster allocation or archival season pool wired into the current-season application. A uniform 10/20 ability option is separate, explicit and unavailable until the roster gate is met. It fills only missing game assessments and cannot establish membership. No synthetic player records are shipped as current squads.

The `touchline-squad-dataset` version-1 envelope contains the snapshot and required review manifest. The app validates the supplied review attestations, scope, dates, rights metadata and references. It does not independently authenticate source captures or live-check pages. A file claiming review is not evidence that the project has actually performed that review; actual external verification remains mandatory.

## Review available while blocked

Database acquisition is paused at the user's request. For interactive development review, run `npm run dev:demo` and use the separate generic season. [DEVELOPMENT_DEMO.md](DEVELOPMENT_DEMO.md) records its launch steps, isolated storage/backup contract and actual validation. Demo results cannot establish current facts or finish the real-data acceptance checklist below.

Run the `milestone-3-season-loop` branch using the README instructions. Choose a reference club and open Fixtures, Competitions or Matchday → League season. Confirm readiness explains missing current evidence and **Create league season** stays disabled. The existing reference identities must not be portrayed as verified current squads. The independent exhibition remains available under Matchday → Exhibition.

An invalid or incomplete **Import squad dataset** must report its problem without changing the career, source snapshot, existing season or exhibition. A plain database import is insufficient for the required current-squad evidence contract. Accessibility, layout and navigation can be reviewed in this blocked state without claiming that the ready-data workflow has been validated on actual sources.

## Full workflow after the data gate is met

This checklist describes the required future acceptance run; it has not been reported as completed with a verified current dataset:

1. Review the complete twenty-club dataset, its effective cutoff, coverage/exclusions and rights. Import the snapshot/manifest envelope and confirm readiness only after actual source review.
2. Create a season with the managed club, explicit seed, first-match date and condition/morale inputs. If ratings remain missing, separately accept the labelled game-assessment baseline. Retain an initial complete season backup.
3. Inspect generated fixtures and table rules. Advance the calendar, start the managed match, change tactics/substitutions at checkpoints and reach full time.
4. Complete the round; all ten results should enter standings together. Advance to the next weekly matchday separately. Inspect carried managed selections and reset scenario condition/morale.
5. Export/reload/restore a season and verify the same fixture, decisions, result summaries, table and career date. Invalid/conflicting imports must preserve the last valid bound state. Career-only and exhibition backups remain separate formats.
6. Complete the thirty-eight-round loop, checking 380 unique results and 38 appearances per club. Review bounded abandonment behavior without assigning a score or rerolling a completed loss.

Record the actual browser/version and observations for a Mac run. The user's successful exhibition progression, tactics, substitutions and import-to-90 confirmation do not establish this season workflow.

## Verification evidence

The source-gated foundation was checked on 17 October 2026 in Linux with Node 24.19.0 and Chromium 154.0.8037.57:

| Check | Recorded outcome |
| --- | --- |
| TypeScript | `npm run check` passed |
| Unit/integration suite | All 211 tests across 19 files passed in 76.51 seconds |
| Production build | Passed; 170 modules transformed |
| Complete production browser suite | All 14 tests passed in 192.252 seconds before the private-use permission refinement |
| Private-use permission follow-up | All four targeted season browser workflows passed on the final production build in 22.3 seconds, including a private three-permission dataset, portable restore and rejected tampering |
| Full season through visible controls | 38 rounds and 380 results completed in 127.109 seconds; 38 appearances per club, 19 home/19 away, conserved goals and table totals, final date 2027-07-03, finished controls and reload checked |
| Accessibility and layout | 20 axe scans without serious/critical findings; tested 1280/800 pixel layouts without page horizontal overflow |
| Browser observations | No uncaught application errors or external HTTP requests in the complete tested workflows |
| Actual current-roster dataset | None verified or shipped; season creation remains gated |
| Mac Milestone 3 workflow | Not reviewed |

The complete browser suite includes the earlier nine foundation/exhibition cases, blocked roster readiness, invalid backup preservation and synthetic-only season lifecycle tests. The ready-path tests import clearly labelled synthetic fixtures confined to automated tooling. They exercise tactics/substitutions, atomic round commits, paused reload, exact portable restore and rejected result/rights tampering; they do not establish actual player affiliations or usage rights. Test fixture markers were absent from the production application bundles.

After the complete browser run, the private-import permission gate was narrowed to the actual storage, display and private backup uses; public redistribution remains a separate review. A fresh build and all four targeted season browser workflows passed with this change, including a synthetic private-use dataset without public redistribution permission. Match physics and season transitions were unchanged. The build emits a main-bundle size warning (530.26 kB, 156.49 kB gzip); it completed successfully.

No Milestone 3 Mac or verified-current-data pass is claimed. The actual sourced twenty-club acceptance run remains outstanding even though the generic code and test-fixture season workflow pass.

### Development-demo follow-up — 19 October 2026

The user deferred database research and requested continued development. The separate development-only demo now has generic clubs/players, replay-validated automatic checkpoints and portable backups, shared fixtures/table/matchday views and explicit replacement confirmation. It creates no roster evidence or real-player facts and does not open ordinary career/exhibition storage. The standard production build excludes its entry and generated scenario. See [DEVELOPMENT_DEMO.md](DEVELOPMENT_DEMO.md) for the format and precise validation boundary.

On Linux with Node 24.19.0 and Chromium 154, TypeScript, all 219 tests across twenty files and the production build passed. All fifteen production browser tests passed in 3.8 minutes, including the full 38-round/380-result workflow and a new check that query parameters do not enable the development demo. All five dedicated demo browser tests passed in 44.3 seconds, with two committed rounds, exact paused reload/fresh-browser backup restore, invalid-import preservation and confirmation before replacing progress. Eight additional demo accessibility scans at 1280/800 pixels found no serious/critical violations or page horizontal overflow; no external HTTP requests or uncaught errors occurred. Browser auditing confirmed only the dedicated demo database opened.

The tested `npm run dev:demo` command starts the independent development entry. The build now splits the application through its lazy entry, producing no chunk-size warning. A compiled-asset check found no demo entry/database/scenario/club/start-button markers. Match/season engine files, original source snapshots and normal save formats are unchanged. These checks do not verify real squads, complete the real-data milestone or establish a Mac demo pass.

## Remaining scope

The user has deferred a qualifying current squad dataset and rights review; independent development and demo review can continue. Transfers, AI squad management, injuries, recovery/development, suspensions, official schedule import, promotion/relegation, repeated new seasons and 2D animation remain outside this milestone. Real-data integration cannot be marked complete merely because generic simulation, storage and demo checks pass.
