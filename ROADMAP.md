# Roadmap

Work is limited to Milestone 1 until its implementation and data approach have been reviewed. The full game specification is the destination, not a claim that every listed system is already implemented.

## Milestone 1 — Application foundation

Deliver a running React/TypeScript/Vite application, an original compact management shell, club selection, sortable squads, reusable player profiles and complete attribute components. Include a clearly labelled local original-assessment editor and configurable calibration utility without fabricating ratings. Establish typed domain models, explicit deterministic command interfaces, sourced real-identity reference data, a provider-independent validated importer, Dexie persistence and portable versioned saves. Create foundational tests and developer documentation.

Acceptance requires type checks, meaningful tests and a production build; manual review must cover navigation, unknown data, role calculations, invalid imports and export/restore behavior. Run the local application on macOS to close the platform acceptance criterion. A successful Linux build is useful evidence but does not replace that run.

Current implementation and checks are recorded in [README.md](README.md). No match engine, transfer AI or 2D presentation is part of this milestone. A sourced reference snapshot is not a verified current squad database.

## Milestone 2 — Attribute-driven match foundation

After foundation review, build the first pure TypeScript event-driven match model. Define how attributes, condition, tactics and controlled randomness affect football actions. Derive score, commentary and statistics from the same events. Add lineup validation, substitutions at defined checkpoints and a batch calibration harness.

Acceptance includes reproducibility from initial state, seed and commands; stronger teams gaining a measurable advantage; plausible scoring and discipline distributions; tested home advantage, fatigue and tactical trade-offs. Keep visual presentation to an event log and basic statistics.

## Milestone 3 — Competition and season loop

Implement fixtures, results, league tables and calendar progression, then connect management decisions to matchdays. Test a 20-team double round-robin competition with 380 fixtures and 38 appearances per club, including 19 home and 19 away. Define tie-breaks and competition rules explicitly.

## Milestone 4 — Sustainable careers

Incrementally add contracts, finances, transfers, scouting, injuries, suspensions, development and AI management under the same rules as the human manager. Add promotions, relegations and season histories. Use long-run invariants to verify at least ten seasons without inconsistent money, rosters or competitions.

## Later extensions

Expand appropriately licensed player coverage, improve calibration and data refresh tools, consider static hosting or desktop packaging, and only then add a 2D presentation driven by authoritative match events. Each extension needs its own reviewable implementation and acceptance criteria.
