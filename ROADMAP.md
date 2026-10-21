# Roadmap

The user reviewed the foundation and exhibition workflows on their Mac, then authorized Milestone 3 and required verified current squads. On 17 October they deferred database research until next week and asked to proceed without it. Continue the season systems through an explicit development-only demo; keep the real-data integration pending. Real-season creation still requires verified 2026/27 competition membership and current squad assignments as of 16 October 2026, with dated authoritative evidence and documented licence/access. The full game specification remains the destination, not a claim that every listed system is implemented.

## Milestone 1 — Application foundation

Deliver a running React/TypeScript/Vite application, an original compact management shell, club selection, sortable squads, reusable player profiles and complete attribute components. Include a clearly labelled local original-assessment editor and configurable calibration utility without fabricating ratings. Establish typed domain models, explicit deterministic command interfaces, sourced real-identity reference data, a provider-independent validated importer, Dexie persistence and portable versioned saves. Create foundational tests and developer documentation.

The foundation and subsequent skin/font changes passed the recorded cloud checks. The user reviewed the interface on their Mac and confirmed the local Humanist face and charcoal/navy/silver skin. This is separate from full browser compatibility testing; retain the exact evidence and limits in [the Milestone 1 review](docs/MILESTONE_1_REVIEW.md).

Milestone 1 did not include a match engine, transfer AI or 2D presentation. Its original review remains historical documentation. A sourced reference snapshot is not a verified current squad database.

## Milestone 2 — Attribute-driven match foundation

Authorized on 16 October 2026 after the foundation review. Build the first pure TypeScript event-driven exhibition match model: a 90-minute match in 15-minute decision segments, with attribute-driven actions, explicit tactics, condition, morale, home effects, discipline, substitutions and seeded randomness. Derive score, commentary and statistics from the same events.

Use an audited real-identity exhibition pool without guessing current club rosters or ability. Any uniform 10/20 baseline is explicitly accepted temporary comparison input for missing attributes, preserving known assessments and source records. Keep the Matchday workspace and its replay-validated archives separate from career saves.

Acceptance includes reproducibility from initial configuration, seed, engine version and commands; stronger synthetic teams gaining a measurable advantage; documented scoring and discipline design targets; and tested home effects, fatigue, substitutions and tactical trade-offs. A synthetic batch report is not empirical calibration to a real league. Keep presentation to decisions, an event log and basic statistics. Record actual checks and remaining limitations in [the Milestone 2 review](docs/MILESTONE_2_REVIEW.md) before calling the milestone complete.

The user reported successful Mac workflow checks on 16 October 2026, confirming match progression, tactical changes, substitutions, match archive import and completion to 90 minutes. The browser was unspecified; broader platform checks remain distinct from these observations. See the review for exact evidence and limits.

Milestone 2 itself did not include competition progression or season play. The user's subsequent request authorizes those systems in Milestone 3. Transfer AI, injuries and 2D animation remain outside the current scope.

## Milestone 3 — Competition and season loop

Authorized by the user's request to start the milestone. Database acquisition is now deferred at the user's request; it is not a prerequisite to further independent development. Before real-data season integration, establish the actual 2026/27 competition club list and player-to-club assignments effective as of 16 October 2026 from dated authoritative sources. Record source URLs, effective/publication and retrieval dates, applicable rights, access status, coverage and unresolved conflicts in [CURRENT_SQUAD_SOURCES.md](docs/data/CURRENT_SQUAD_SOURCES.md). Structural schema validation alone does not verify facts or establish redistribution rights.

The earlier custom comparison-season proposal is superseded. Do not substitute temporary original rosters, old source memberships, guessed transfers or synthetic players in the current-season application. The existing Milestone 2 exhibition remains available under its established labels and does not satisfy the current-squad gate. Original game assessments remain separate from biographical and assignment facts; a numerical baseline cannot establish roster membership.

Pure scheduling, results, table, calendar and persistence work may continue independently of source research. A separate `npm run dev:demo` development entry uses clearly labelled generic demo clubs/players to exercise the same engine and presentation. It has its own checkpoint store and replay-backup format, creates no roster review manifest, and never opens or modifies ordinary career/exhibition storage. Demo code is excluded from ordinary production builds. This is a development rehearsal, not the previously rejected original allocation of real players to current clubs.

Integrate the real-data workflow only with evidence that meets the gate. The overall real-data milestone is not complete while required membership or squads remain unverified; the user can now review generic season behavior without waiting for source acquisition.

On 20 October 2026 the user confirmed the core database-free demo loop on their Mac: season creation, tactical changes, match completion, table updates and backup export/import. This is a review checkpoint for the generic season workflow; it does not verify real squads or constitute a full-season Mac run. Detailed evidence and remaining limits are in [the development demo review](docs/DEVELOPMENT_DEMO.md).

Generate and test a 20-team double round-robin schedule with 380 fixtures and 38 appearances per club, including 19 home and 19 away. Document points, tie-breaks, round dates and conflict rules. Results must come from the existing deterministic match engine; table and calendar transitions must follow accepted results, not separately fabricated scores. Keep managed match decisions and other scheduled results reproducible from the initial configuration, seed, engine versions and commands.

Preserve original source snapshots, existing career exports and exhibition archives. Add a career-bound season archive and validated atomic career/calendar updates without silently changing old save meanings. Verify restore/replay, invalid-import preservation, scheduling/table invariants and the complete first-season workflow before claiming completion. Detailed API and format documentation will follow the stable implementation; no Milestone 3 data verification, test or platform pass is claimed yet.

This milestone does not add transfers, AI squad management, injuries, player development, promotion/relegation, repeated new seasons or 2D animation. Those systems require later implementation scope.

## Milestone 4 — Sustainable careers

The user authorized the first career-management slice on 20 October 2026 after confirming demo squad/player access. Implement contracts, weekly wage commitments, club balance/transfer planning budget/wage budget, calendar-driven payments, a financial ledger and transparent contract renewals. Use labelled generic demo figures while real database research is deferred; no real wages, valuations or club finances are inferred.

This slice uses an independent pure finance/contract engine alongside the unchanged season engine. All clubs obey the same wage, income and affordability rules. Fixed original home-fixture income is credited only when a round's full-time results commit. Wage accrual, paydays and renewal timing must replay without duplicate charges or floating-point accounting errors.

Existing demo version-1 backups remain readable and unchanged until explicit career activation. New career-enabled demos use version 2 with a finance-engine version and recorded activation command boundary; old football progress is preserved and financial history starts at its current date. Calendar/financial decisions save atomically and portable restoration reconstructs both histories. Review contracts, an affordable/refused renewal, a calendar payday, ledger and full backup restoration before calling this first slice ready.

Transfers, offers, valuations, fees, AI contract negotiations, scouting, injuries, suspensions, player development, promotion/relegation and repeated new seasons are not added by this slice. Player profiles should make transfer availability clear. These remaining systems need later implementation and acceptance checks; the first slice does not complete all of Milestone 4.

Incrementally add contracts, finances, transfers, scouting, injuries, suspensions, development and AI management under the same rules as the human manager. Add promotions, relegations and season histories. Use long-run invariants to verify at least ten seasons without inconsistent money, rosters or competitions.

## Later extensions

Expand appropriately licensed player coverage, improve calibration and data refresh tools, consider static hosting or desktop packaging, and only then add a 2D presentation driven by authoritative match events. Each extension needs its own reviewable implementation and acceptance criteria.
