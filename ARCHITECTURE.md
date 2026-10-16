# Architecture

Touchline is a local-first, single-player browser application targeting modern macOS on Apple Silicon. Milestone 1 established typed data, an inspectable management interface and reliable saves. Following the user's foundation review, Milestone 2 adds a standalone attribute-driven exhibition match model. The full product requirements remain in [GAME_SPEC.md](GAME_SPEC.md).

## Current implementation plan

1. Preserve the reviewed React/TypeScript/Vite shell, source data, profile assessments and version-1 career saves.
2. Build a pure TypeScript event-driven match with explicit lineup and tactics validation, seeded randomness, fatigue, discipline and decision checkpoints.
3. Add a Matchday workspace using real sourced identities in temporary coach selections, with a clearly labelled opt-in comparison baseline where ratings are unknown.
4. Persist exhibition configuration and commands in a separate replay-validated match archive without advancing or modifying a career.
5. Test action and tactical sensitivity, stronger-team advantage, home effects, substitutions, discipline and batch distributions against documented design targets.
6. Review the first match foundation before adding competition and season play. Transfer AI and 2D presentation remain outside scope.

## Boundaries

| Layer | Responsibility | Must not depend on |
| --- | --- | --- |
| Presentation | Navigation, accessible controls, sortable tables, player profiles, data completeness and user feedback | Football calculations embedded in components |
| Domain | Typed players, clubs, competitions, tactics, finances and career state; attribute and role rules | React, IndexedDB, browser globals |
| Simulation | Seeded randomness, explicit commands, attribute-driven match events and reproducible state transitions | React, persistence, wall-clock time, implicit randomness |
| Data boundary | Untrusted JSON validation, provenance, reference snapshots and format compatibility | Unvalidated assertions about source rights or real player ability |
| Persistence | IndexedDB stores, atomic save operations, portable export and import | Hidden state changes in the simulation |

Presentation consumes validated domain objects. Data adapters and storage sit outside the deterministic core. The match engine returns authoritative events and state changes; UI code derives scores, commentary and statistics from those events rather than generating independent football outcomes. [MATCH_ENGINE.md](docs/MATCH_ENGINE.md) documents the versioned model and its limits.

## Domain decisions

- Stable string IDs join entities. Imported external identifiers and their sources remain attached to the relevant records.
- Dates and snapshot identity are explicit. A reference snapshot is a versioned starting database; each career references its own starting snapshot.
- Currency uses integer minor units. Unknown financial values must not be presented as verified balances or wages.
- Attributes retain the specification's technical, mental, physical and goalkeeping vocabulary. A known rating is an integer from 1 to 20; missing evidence is represented explicitly, not filled with an average value.
- Verified biographical facts and original game assessments are different records. Assessment provenance and uncertainty remain visible to tooling; an attribute score is never presented as an objective biographical fact.
- Potential, development and personality models can exist without being exposed on player screens. Local save files are user-owned data, not a security boundary against their owner.
- Role suitability version 1 summarises attributes using position-specific weights, provided the player has a compatible known position. It is unavailable where required evidence is missing. The profile summary does not include match condition or tactics; the separate match engine applies its own action-level effects. Neither replaces individual attributes.

### Role score version 1

For a compatible position with all required ratings known, `weightedMean = sum(attribute × weight) / sum(weights)`. Convert it with `round(1 + 99 × (weightedMean − 1) / 19)`, so an all-1 set produces 1 and an all-20 set produces 100. Missing required values, invalid values or an unfamiliar position produce an unassessed result, never an imputed average. These are transparent original design choices, not calibrated match predictions or proprietary ratings.

The source of truth is `src/domain/ratings.ts`, exported as `ROLE_DEFINITIONS`:

| Role | Compatible positions | Attribute weights |
| --- | --- | --- |
| Goalkeeper | GK | Reflexes 5; Handling 4; One-on-Ones 3; Command of Area 2; Aerial Reach 2; Positioning 3; Concentration 2; Agility 2 |
| Centre back | CB | Marking 4; Tackling 4; Heading 3; Positioning 4; Anticipation 3; Concentration 2; Strength 3; Jumping Reach 2 |
| Full back | RB, LB | Tackling 3; Marking 2; Crossing 3; Positioning 3; Work Rate 3; Pace 3; Stamina 3; Teamwork 2 |
| Defensive midfielder | DM | Tackling 4; Passing 3; Positioning 4; Anticipation 3; Decisions 3; Teamwork 2; Stamina 2; Strength 2 |
| Central midfielder | CM | Passing 4; First Touch 3; Technique 2; Decisions 3; Vision 3; Teamwork 2; Work Rate 2; Stamina 3 |
| Wide midfielder | RM, LM | Crossing 4; Dribbling 3; Passing 2; Work Rate 3; Off the Ball 2; Teamwork 2; Pace 3; Stamina 3 |
| Attacking midfielder | AM | Passing 4; First Touch 3; Technique 3; Dribbling 2; Vision 4; Decisions 3; Off the Ball 2; Flair 2 |
| Winger | RW, LW | Dribbling 4; Crossing 4; First Touch 2; Off the Ball 3; Flair 2; Acceleration 4; Pace 4; Agility 2 |
| Striker | ST | Finishing 5; First Touch 3; Heading 2; Composure 4; Off the Ball 4; Anticipation 3; Acceleration 2; Strength 2 |

The career command surface selects a managed club and advances the date. Command counts and seeded random state are explicit. Career date progression does not automatically produce fixtures, match results, development or financial transactions. Milestone 2 exhibition commands belong to a separate match state and cannot advance the career calendar.

The generator is xorshift32 with explicit persisted state; a zero seed maps deterministically to a nonzero state. Career commands do not consume random numbers; match advancement does. Initial IDs, wall-clock creation times and entropy enter through runtime adapters, not deterministic transitions.

### Original assessments and calibration

The profile editor accepts whole 1–20 ratings or unknown values, a written rationale and confidence. It edits visible game attributes only. Saving validates a new snapshot revision with a fresh ID, retains the original reference and updates the career's snapshot link atomically. Biographical fields, detailed position familiarity and hidden attributes are outside the editor. A `touchline-local-editorial` source identifies locally authored assessments and records that redistribution requires review.

`src/data/calibration.ts` supplies a separate configurable evidence-to-rating utility. A versioned rule names its target attribute, metric, units, minimum sample and ordered evidence/rating anchors. Matching, sufficiently sampled evidence with adequate confidence is linearly interpolated between anchors, clamped at endpoints and rounded to an integer. Missing, unattributed, low-confidence or incompatible evidence stays unassessed. No default statistical mapping or player ratings are bundled; a rule remains an original modelling choice, not proof of ability. Manual overrides retain their own provenance. The utility has no automatic provider fetch or calibration UI in Milestone 1.

## Import and save boundaries

Database snapshots and save envelopes begin at schema version 1. Imports must validate versions, values, unique identifiers and cross-references before modifying storage. Unsupported versions fail explicitly; there is no older-format migration to claim for this first format. Future versions must add and test explicit transformations and retain a backup of the input.

Dexie holds source snapshots and career records in separate stores. A portable save contains its source snapshot as well as the career state, so restoration does not silently depend on a different starting database. A successful JSON parse is insufficient: the complete object and its relationships must pass validation.

The bundled reference at `src/reference/snapshot.json` is parsed through the same boundary as user imports. Its 12 archival player identities have no club assignments or ratings. Four club identities support selection without claiming real squad membership. Unknown citizenship and outfield position familiarity are intentional gaps; the underlying source's country headings and broad D/M/F codes do not resolve them. `docs/data/source-extract.json` and adjacent CC0 licence copies preserve the audit trail.

## Exhibition workspace and persistence

`src/reference/exhibition-snapshot.json` adds a separate audited pool of 32 real archival identities, including five directly sourced goalkeepers. It has no clubs or current player assignments and does not overwrite the original 12-player snapshot. Its source extraction is retained in `docs/data/exhibition-source-extract.json`. Known user assessments can be reused by stable player ID without inventing missing factual detail.

Home and Away selections are temporary match inputs. Assigning a formation slot is a coaching choice, not new evidence of a player's real position; unknown or unfamiliar positions remain modelled uncertainty. Starting condition and morale are scenario values, not verified real-world fitness. An explicit comparison option may fill only missing ratings with a uniform 10/20; known assessments remain unchanged. The selected assessment mode travels with match configuration and exports. Source snapshots, sourced facts and careers are not modified by these temporary inputs.

Match archives use `format: "touchline-match"`, schema version 1 and engine version 1. They contain the initial configuration and accepted command log, not stored scores or independently trusted events. Import validates shape, versions and football relationships, then replays every command through the engine before writing. The same initial configuration, seed, command sequence and engine version reconstruct the same event stream and state.

Dexie database `touchline-match-sessions` version 1 has a `sessions` store indexed by ID and update time. This is separate from the existing career database and does not upgrade its schema. A stored session ID cannot silently acquire a different initial configuration. Restoring a valid backup with the same ID and configuration can replace that session's progress. Archives are limited to 16 MiB and 1,000 commands; unsupported versions fail explicitly without an invented migration.

Career export remains `touchline-save` version 1 and excludes exhibition sessions. The user must export a match separately to back it up. Local browser storage and exports belong to the user; neither is a tamper-proof record or a cloud backup service.

## Local runtime and deployment

The current presentation direction, requested on 16 October 2026, is a subtly textured matte charcoal canvas with navy gradient navigation and panel bars, plus silver text, borders and selection accents. It supersedes the green palette described in the preserved v0.3 master specification. Shared semantic tokens in `src/ui/tokens.css` control the skin, including dark native controls and keyboard focus. Fine CSS gradients supply the texture without image files or remote requests. Humanist 777 Black BT remains the shared locally resolved font; a system fallback supports machines without that face.

Vite serves development; the production build consists of static local assets. IndexedDB belongs to a browser origin, so changing the port, host or browser creates a separate storage context. Export saves before moving between origins or clearing browser storage.

No application backend, account, external gameplay API or client secret is required. Installing dependencies needs package-registry access; loading a source reference link is an explicit browser action. Offline reload or installable PWA behavior must only be claimed after a service worker and its update behavior have been implemented and verified.

Future static hosting and desktop packaging can reuse the domain core. Backend adapters may be introduced later without moving football rules into React.

## Review findings and constraints

| Risk or tension | Resolution in this milestone |
| --- | --- |
| A 2026/27 target does not establish verified current squads | Ship clearly labelled biographical reference data; require sourced roster data for current assignments |
| Comprehensive attributes cannot be inferred reliably from public biography | Retain unknown ratings; accept separately labelled editorial or calibrated assessments with evidence |
| Authentic squads and immediate simulated play compete with limited data rights | Keep current rosters unknown; use explicit temporary exhibition selections and opt-in model inputs |
| A deterministic engine can be undermined by UI randomness or timestamps | Commands supply inputs explicitly; keep runtime services outside transitions |
| Local browser storage can be cleared or isolated by origin | Provide portable save export and restore; document browser storage limits |
| A passing synthetic batch can be mistaken for real football calibration | Document design targets and sensitivity checks separately from empirical validation |
| Browser runtime compatibility is broader than a Linux build check | Preserve the user's Milestone 1 skin/font review; keep Milestone 2 macOS acceptance separate until tested |

## Validation boundaries

Foundational checks cover data integrity, IDs and assignments, attribute ranges and role calculations, deterministic interfaces, version errors, financial and squad constraints, and career save/import round trips. Milestone 2 adds match replay, event consistency, valid lineups, tactical and attribute sensitivity, substitutions, discipline, fatigue, match archives and synthetic batch design targets. League table calculation and 380-match scheduling checks belong to the season milestone. Do not substitute placeholder tests for absent gameplay.
