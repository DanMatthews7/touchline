# Data policy

Touchline uses authentic identities only where source access and usage terms permit. Its season target is 2026/27; that target is not a claim that the initial reference snapshot contains verified 2026/27 squads.

## Permitted sources and scope

The initial reference dataset contains 12 real footballer identities from [Openfootball players](https://github.com/openfootball/players), whose repository publishes its data under CC0. The reviewed source revision is `125d20f7cc06cac7e758b40df535a7695632680a`. Four club identities come from [Openfootball clubs](https://github.com/openfootball/clubs), revision `ae3800227c449447b3a337fc0aac79a8f02f4c8b`, also CC0. Source URLs, external identifiers and retrieval dates travel with the records. CC0 does not grant rights to team crests, photographs, third-party text or trademarks, and none are bundled merely because a source refers to them.

Milestone 2 adds a separate [32-player exhibition identity pool](src/reference/exhibition-snapshot.json), including five goalkeepers, from the same pinned CC0 player source. Its [extraction audit](docs/data/exhibition-source-extract.json) records exact lines, source paths, checksums and retrieval dates. It contains no clubs and no current club assignments. Stable IDs shared with the original pool identify the same person; the new file does not overwrite earlier snapshots or career records.

The bundled [snapshot](src/reference/snapshot.json) contains schema-valid game records. The separate [source extraction audit](docs/data/source-extract.json) preserves exact lines, pinned source links, original broad positions and country headings, retrieval dates, upstream commit timestamps and SHA-256 checksums of the reviewed source files. It is audit material, not a game snapshot import. Local copies of both reviewed CC0 licences are in `docs/data/`.

The reference snapshot is a biographical starting point, not a complete playable Premier League database. It must not imply a current club relationship unless that relationship has an appropriate dated source. Club selection and roster import are separate from evidence that a particular player belongs to that club in 2026/27.

No Football Manager database, proprietary ratings, protected artwork or copied interface assets may be imported or distributed. Club and player names are factual identifiers; the project does not claim endorsement by the people, clubs or other games named.

## Required metadata

Every imported snapshot has a stable identifier, schema version, source snapshot date and descriptive metadata. Player and club records preserve stable internal IDs and provenance, including:

- Source identifier and name, source URL and external source identifier where available.
- Date accessed and the source's own date when known.
- Licence name, licence URL where available and usage restrictions.
- Validation and completeness status.

Dates must describe the evidence actually obtained. A retrieval timestamp is not evidence that all facts in an entity were updated on that day. Entity IDs are stable source references, not permission to infer missing information.

## Facts, unknowns and game assessments

Verified names and any sourced dates, nationalities, positions, career information or roster assignments belong to the factual layer. Missing or disputed facts remain unknown. Never create a fictional player to fill a roster gap or infer a current club from an old career association.

In the initial snapshot, all player `clubId` values are `null` and all nationalities are empty: the source country heading is not verified citizenship. A broad source `G` maps to the game's `GK` position. `D`, `M` and `F` do not establish specific outfield familiarity, so those players retain empty detailed position arrays and their original codes remain in notes. Heights and other unsupported current facts are not inferred. The archival records remain marked partial and needing review; structural validation does not upgrade them to verified 2026/27 facts.

Technical, mental, physical and goalkeeping ratings are game assessments. The 1–20 scale is an original game model, not a source fact. Non-null ratings require explicit assessment provenance, method and uncertainty; editorial overrides must remain identifiable. Public statistics do not uniquely establish mental ability, technique, personality or potential.

The reference dataset must not silently generate ratings from a player's fame, date of birth or an arbitrary random seed. Synthetic complete players belong in clearly identified automated test fixtures, with the explicit development-demo exception below. The ordinary UI must communicate unavailable ratings without displaying a fabricated role score.

The local profile editor lets the user supply original 1–20 assessments, confidence and a rationale without changing biographical facts. Every save creates a new immutable database revision, retaining the original reference. The separate `touchline-local-editorial` provenance record describes user-authored game estimates and requires review before redistribution. Hidden potential, personality and development values are not editable through this screen.

The implemented calibration utility accepts explicitly versioned rules with matching metric/units, minimum samples and ordered interpolation anchors. It returns unknown for missing, unattributed, low-confidence, incompatible or insufficiently sampled evidence. There are no default evidence-to-ability mappings and no bundled generated player ratings. Preserve manual override provenance and document uncertainty. No scoring formula may be described as validated merely because it is deterministic.

## Exhibition comparison inputs

The Matchday workspace can assemble temporary Home and Away coach selections using authentic sourced names. These are exhibition sides, not verified club rosters or claims about 2026/27 squads. Assigning a player to a formation slot is a user decision; it does not upgrade unknown positional familiarity into a verified fact. The engine applies its documented familiarity rule when detailed positions are unknown or incompatible.

Shipped source ratings remain unknown. The user may explicitly opt into a uniform 10/20 comparison baseline for missing ratings so that the model can be inspected before complete assessments are available. This option is an original comparison scenario, not a rating of any athlete's ability. It fills only missing values, preserves known editorial assessments and retains its assessment mode in the match configuration and archive. It never changes the source database, player biography or career state. Without complete values or that explicit option, the simulation must reject incomplete ratings rather than silently generate them.

Starting condition and morale are explicit model inputs. They are not current medical, psychological or training facts about the real people named. Match events and outcomes describe the configured fictional exhibition only. They are not predictions, reports of actual matches or evidence for rewriting source attributes.

Synthetic players and rating differences used by the automated batch harness remain in test tooling. Passing its goal, home-effect, discipline or sensitivity targets establishes only that this version behaves as designed on those scenarios. It does not establish empirical calibration to real leagues or justify assigning those synthetic ratings to real players.

## Import safety and responsibilities

Imports are provider-independent JSON validated at the boundary. Reject invalid ranges, duplicate IDs, dangling club assignments, inconsistent rosters, malformed provenance and unsupported versions before writing any data. A file's assertion that it is CC0 is metadata, not proof that its provider owns the rights: the user must verify the source and licence before import or redistribution.

The import contract is `DatabaseSnapshot` in `src/domain/models.ts`, enforced by `parseSnapshot` in `src/data/schema.ts`. The complete object has `schemaVersion`, `id`, `name`, `season`, `createdAt`, `sources`, `players`, `clubs`, `competitions` and `validation`. Each player includes the full attribute vocabulary, with `null` for unassessed values. This importer accepts a complete snapshot, not arbitrary CSV rows or a provider's raw API response. An adapter must map and validate such input first.

Any known rating also needs an `attributeAssessments` entry keyed by its attribute path, for example `technical.passing`. The entry states `original-estimate` or `editorial-override`, confidence, method, registered evidence source IDs and assessment time. This structure records how the rating was made; it does not certify that the method is accurate.

External credentials belong in secure developer or server-side tooling, never in Vite client variables or committed files. Gameplay must not require an external data API. Preserve source links for audit without fetching them automatically during play.

## Development while database research is deferred

On 17 October 2026 the user asked to proceed without the database and return to it next week. The development-only `season-demo` entry may generate generic “Demo Club” and “Demo Player” labels to review season behavior. All demo attributes use the same original 10/20 comparison inputs; there are no real-player ability claims, fabricated biographies, official registrations or synthetic source-review attestations.

The demo reuses the real season/match engines and controlled UI, but its scenario and accepted decisions live in the separate `touchline-season-demo` store and backup format. It does not import into career/reference snapshots or create a `touchline-current-squads` manifest. Normal career, exhibition and source-reviewed season formats remain unchanged. An ordinary production build excludes the demo entry and generated records. Development use of generic labels must never be described as verified current-season data.

Database acquisition and provider research are paused until the user returns to them; no subscription or credential is necessary to review the development demo. Later database integration still requires appropriate provenance, dates, coverage and usage rights. Arbitrary downloaded game databases or proprietary ratings are not automatically acceptable imports.

## Development career-management figures

The authorized first Milestone 4 slice adds contracts and finances only to the generic development demo. Per-club opening cash of £5 million, a £1 million transfer planning budget, an £80,000 weekly wage budget, initial wages of £1,000 per player per week and £25,000 per committed home fixture are original scenario inputs. They are not sourced real-world wages, contract terms, club accounts, player valuations or transfer funds that can currently be spent. Contract dates, renewals and ledger transactions are generated game records for generic identities.

Conditional wage negotiations and signing bonuses are original simulation rules, not empirical claims about player willingness or real contract packages. The demo has no birth-date evidence and supplies unknown age; it cannot claim an age-based concession. The independent policy may consume a known date in a future reviewed adapter. Financial-pressure eligibility comes from the actual account state, and a guaranteed bonus is a real simulated cash payment rather than a claimed future incentive. Performance-dependent bonuses are not represented.

New career-enabled demo backups use version 2 and replay the accepted football and financial command history. Version-1 demo backups remain football-only unless explicitly activated at their saved current date, without retroactive wage charges or home-fixture credits. Derived balances and ledger are reconstructed rather than accepted as source facts. This extension stays in the separate development entry/store; normal career/exhibition/real-data formats and the current-squad evidence requirement remain unchanged. See [CAREER_MANAGEMENT.md](docs/CAREER_MANAGEMENT.md) for exact model and compatibility rules.

## Current-squad gate for real-data season integration

The user's instruction, **“Require verified current club squads first”**, supersedes original-roster comparison seasons. Current-season creation requires actual 2026/27 Premier League membership and complete current club squad coverage as of 16 October 2026, supported by dated authoritative evidence and permitted use. Original allocations, archival associations, synthetic players, a uniform ability baseline and self-declared verification flags cannot establish these facts. Existing exhibitions retain their separate labels and do not satisfy the gate.

No qualifying current dataset is bundled or established. The exploratory archival season pool was removed from the application checkout; it is not a fallback season source. Current access and source findings are recorded in [CURRENT_SQUAD_SOURCES.md](docs/data/CURRENT_SQUAD_SOURCES.md). Official main-site responses are available, but the reviewed Premier League terms do not supply the required database permission; prior written approval or a suitably licensed alternative remains necessary. Successful HTTP access is not verification of a season, assignment, effective date or licence.

The current importer accepts `touchline-squad-dataset` version 1, with `snapshot` and `manifest`. The manifest uses `touchline-current-squads` version 1 and binds its source snapshot, competition, season and cutoff to dated evidence. Evidence identifies authority (`official-league`, `official-club` or `licensed-provider`), claims, club/player IDs, publication/effective/capture dates and a captured-content hash, locator and excerpt. Reviews record who checked the capture and dates, when, and the scope/limitations.

Each club needs complete roster coverage, explicit under-21 handling, reviewed loan/registration exclusions and an exact match between source assignments and reviewed player records. Player identity, external ID and source provenance must agree; goalkeeper positions need evidence. Current readiness requires twenty clubs and at least eleven supported players per club, including one sourced goalkeeper and ten outfield players. This minimum match size does not replace the separate completeness review.

The private-import rights contract requires reviewed terms/evidence supporting local storage, in-app display and the owner's private backup/export. Public redistribution permission is not required for this private workflow. Publishing or bundling source data needs a separate rights review; a ready import does not authorize that use. A visible page or provider login alone does not meet the contract. Underlying rights evidence, review names and hashes are supplied assertions: the offline app validates consistency and required fields, not authenticity or legal permission independently. Actual source and rights review remains necessary outside the parser. Do not describe an imported attestation as independent web verification.

After the gate is met, match selection is a coaching choice within verified club assignments. Missing ability attributes can use 10/20 only with separate explicit opt-in, preserving known assessments; this option cannot change membership or identity. Condition, morale, generated fixtures, results and table tie-breaks remain game-model inputs/outputs rather than official facts. Source snapshots stay immutable, and the season retains the supplied review manifest for audit.

## Versioning and backup

Version starting snapshots separately from career saves. The initial supported format is version 1. Unknown versions fail with a useful error; do not silently reinterpret them. Before adding a future migration, define and test the old and new shapes, retain the original backup and validate the transformed result.

Save exports contain career data and its source snapshot. Treat these as local user files: they can contain names, original assessments and management history. Export before clearing browser storage or moving to a different browser origin. The application does not send them to a backend.

The save envelope has `format: "touchline-save"`, `schemaVersion: 1`, `exportedAt`, `snapshot` and `career`. Save import and export enforce a 16 MiB limit. Restoring validates the embedded snapshot and career relationship before an atomic database transaction. Reusing a snapshot ID with different contents is rejected; revised starting data needs a new ID. Restoring an existing career ID replaces that career with the imported backup, so export its current state first if it must be retained.

Exhibition sessions have a separate `touchline-match` version-1 archive containing engine version, initial configuration and accepted commands. Import replays the commands and derives events and results instead of trusting imported scores. Match archives have a 16 MiB and 1,000-command limit. They live in the separate `touchline-match-sessions` IndexedDB database; career saves do not include them. Export both formats when both need backup. Restoring the same match ID and initial configuration can replace its local progress, so retain the current export before restoring an older checkpoint.

Season archives use `touchline-season` version 1 and include both engine versions, career, exact source snapshot, current-squad review manifest, initial configuration and accepted commands. They are limited to 16 MiB and 5,000 commands. Import replays results/calendar and validates the source/career/date binding before an atomic write. The additive Dexie version-2 `seasons` store does not transform old career rows or change their version-1 JSON meaning. A career-only export excludes season progress; use **Export season backup** for the full bound record. Normal writes append progress; an explicit valid import can restore older matching progress, so keep the current backup first.

## Current limitations

- A complete, appropriately permitted and verified 2026/27 current squad database has not been established. The user has deferred acquisition; real-data season integration remains pending while development proceeds through the separate demo.
- Biographical references alone do not establish modern club rosters, positions, wages or football ability.
- Broad database coverage, automatic provider refresh and calibrated match-ready player assessments require separate review.
