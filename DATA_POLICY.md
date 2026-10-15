# Data policy

Touchline uses authentic identities only where source access and usage terms permit. Its season target is 2026/27; that target is not a claim that the initial reference snapshot contains verified 2026/27 squads.

## Permitted sources and scope

The initial reference dataset contains 12 real footballer identities from [Openfootball players](https://github.com/openfootball/players), whose repository publishes its data under CC0. The reviewed source revision is `125d20f7cc06cac7e758b40df535a7695632680a`. Four club identities come from [Openfootball clubs](https://github.com/openfootball/clubs), revision `ae3800227c449447b3a337fc0aac79a8f02f4c8b`, also CC0. Source URLs, external identifiers and retrieval dates travel with the records. CC0 does not grant rights to team crests, photographs, third-party text or trademarks, and none are bundled merely because a source refers to them.

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

The reference dataset must not silently generate ratings from a player's fame, date of birth or an arbitrary random seed. Synthetic complete players are permitted only in clearly identified automated test fixtures. The ordinary UI must communicate unavailable ratings without displaying a fabricated role score.

The local profile editor lets the user supply original 1–20 assessments, confidence and a rationale without changing biographical facts. Every save creates a new immutable database revision, retaining the original reference. The separate `touchline-local-editorial` provenance record describes user-authored game estimates and requires review before redistribution. Hidden potential, personality and development values are not editable through this screen.

The implemented calibration utility accepts explicitly versioned rules with matching metric/units, minimum samples and ordered interpolation anchors. It returns unknown for missing, unattributed, low-confidence, incompatible or insufficiently sampled evidence. There are no default evidence-to-ability mappings and no bundled generated player ratings. Preserve manual override provenance and document uncertainty. No scoring formula may be described as validated merely because it is deterministic.

## Import safety and responsibilities

Imports are provider-independent JSON validated at the boundary. Reject invalid ranges, duplicate IDs, dangling club assignments, inconsistent rosters, malformed provenance and unsupported versions before writing any data. A file's assertion that it is CC0 is metadata, not proof that its provider owns the rights: the user must verify the source and licence before import or redistribution.

The import contract is `DatabaseSnapshot` in `src/domain/models.ts`, enforced by `parseSnapshot` in `src/data/schema.ts`. The complete object has `schemaVersion`, `id`, `name`, `season`, `createdAt`, `sources`, `players`, `clubs`, `competitions` and `validation`. Each player includes the full attribute vocabulary, with `null` for unassessed values. This importer accepts a complete snapshot, not arbitrary CSV rows or a provider's raw API response. An adapter must map and validate such input first.

Any known rating also needs an `attributeAssessments` entry keyed by its attribute path, for example `technical.passing`. The entry states `original-estimate` or `editorial-override`, confidence, method, registered evidence source IDs and assessment time. This structure records how the rating was made; it does not certify that the method is accurate.

External credentials belong in secure developer or server-side tooling, never in Vite client variables or committed files. Gameplay must not require an external data API. Preserve source links for audit without fetching them automatically during play.

## Versioning and backup

Version starting snapshots separately from career saves. The initial supported format is version 1. Unknown versions fail with a useful error; do not silently reinterpret them. Before adding a future migration, define and test the old and new shapes, retain the original backup and validate the transformed result.

Save exports contain career data and its source snapshot. Treat these as local user files: they can contain names, original assessments and management history. Export before clearing browser storage or moving to a different browser origin. The application does not send them to a backend.

The save envelope has `format: "touchline-save"`, `schemaVersion: 1`, `exportedAt`, `snapshot` and `career`. Save import and export enforce a 16 MiB limit. Restoring validates the embedded snapshot and career relationship before an atomic database transaction. Reusing a snapshot ID with different contents is rejected; revised starting data needs a new ID. Restoring an existing career ID replaces that career with the imported backup, so export its current state first if it must be retained.

## Current limitations

- A complete, licensed and verified 2026/27 English player database is not supplied by the specification and remains future data work.
- Biographical references alone do not establish modern club rosters, positions, wages or football ability.
- Broad database coverage, automatic provider refresh and calibrated match-ready player assessments require separate review.
