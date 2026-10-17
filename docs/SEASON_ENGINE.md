# Season foundation version 1

Milestone 3 is work in progress. Its pure season core and persistence boundaries are implemented, but the user's mandatory verified-current-squad gate has not been satisfied. **This is not a ready 2026/27 season database or a completed milestone.** Original roster allocations and archival identities cannot populate the current-season application.

## Source gate and preparation

`src/season/dataset.ts` accepts a JSON envelope with `format: "touchline-squad-dataset"`, `schemaVersion: 1`, `snapshot` and `manifest`, limited to 16 MiB. The snapshot follows the existing database schema. The manifest follows `touchline-current-squads` version 1 in `src/season/rosters.ts`.

The supplied review must cover the English Premier League, season 2026/27, twenty clubs and cutoff **2026-10-16**. Evidence records official league/club or licensed-provider authority, publication/effective/capture dates, claim scopes, player/club IDs, captured-content hash/locator/excerpt, reviewer attestations and reuse rights. Club reviews must cover complete squads, under-21 handling, loan/registration exclusions, exact player identity/assignment matches and supported goalkeeper positions. Minimum match coverage is eleven players, ten outfield plus a goalkeeper; this does not replace complete-squad review.

Readiness checks validate the supplied contract and references. They do not fetch source pages, authenticate reviewer identities, prove a hash matches an authentic publication or grant usage rights. Private imports require reviewed permission for local storage, in-app display and the owner's private backup/export. Redistribution is optional manifest information; readiness does not authorize publishing or bundling a dataset, which needs a separate rights review. An actual external evidence/rights review is necessary. No qualifying current dataset has been established; [CURRENT_SQUAD_SOURCES.md](data/CURRENT_SQUAD_SOURCES.md) records research findings and blockers.

`prepareSeason` refuses an unready manifest. Once ready, it selects participants only from each verified `clubId` affiliation, preserves sourced identity/positions and carries prior documented game assessments by stable ID into a new immutable snapshot. It does not allocate unrelated players to clubs. Default coaching selection is 4-3-3, chosen in stable ID order with a sourced goalkeeper, ten outfield starters and available substitutes up to the match engine's twenty-player limit. This is an initial coach selection, not quality-based AI or new positional evidence.

All 45 match attributes must be complete. A separate explicit option fills only missing ratings with 10/20; known recorded assessments remain. The mode is retained as `recorded-attributes` or `uniform-missing-10`. It cannot establish club membership or clear the source gate. Initial condition, morale and optional 4% home action advantage are original scenario inputs.

## Pure API and state

`src/simulation/season/` imports the existing match engine, domain rules and deterministic utilities without React, browser APIs, storage, wall-clock time or ambient randomness.

- `parseSeasonConfig` and `parseSeasonCommand` validate pure inputs.
- `generateSeasonFixtures`, `getRoundFixtures` and `addSeasonDays` build and inspect the calendar.
- `createSeason`, `applySeasonCommand` and `replaySeason` create, transition and reconstruct state.
- `getManagedSeasonFixture`, `getCurrentSeasonFixtures` and `getFixtureMatchConfig` expose scheduled match inputs.
- `getSeasonTable` derives standings from committed full-time results.

`SeasonConfig` includes season and match engine versions, season/career IDs, name, start/first-match dates, seed, managed club ID, twenty match-ready teams, assessment mode and home advantage. Players are unique across the competition. First match date cannot precede start date. Date arithmetic uses UTC `YYYY-MM-DD` with impossible/overflowing dates rejected.

State records current date, completed-round count, generated fixtures, committed and staged summaries, active/last managed matches, current selections, accepted commands, abandonment attempts and audit history. Status is `between-rounds`, `matchday`, `playing`, `round-ready`, `blocked` or `finished`. Command failures preserve the previous state.

## Fixtures, seeds and table rules

The circle scheduler sorts twenty stable club IDs and generates nineteen first-leg rounds, then reverses venues for nineteen return rounds. Each round has ten fixtures and each club appears once. Total: **380 fixtures; 38 per club, 19 home and 19 away**. Round dates are `firstMatchDate + 7 × (round−1)` days. Venue orientation is deterministic.

This is an original generated game calendar, not the official Premier League fixture list. It has no postponements, broadcast slots, winter breaks, cup conflicts or official season-end constraint; a start after the October cutoff can run into July. Verified roster evidence does not make these fixture dates official.

For zero-based fixture ordinal `i` and abandonment attempt `a`:

```text
fixtureSeed = (seasonSeed + Math.imul(i + 1 + 380 × a, 0x9e3779b1)) >>> 0
```

Attempt 0 is the original match; attempts 1–3 are explicit abandonment retries. Odd multiplication gives distinct numeric seeds for fixture/attempt pairs within this season. Match engine version 1 supplies all football outcomes using its existing seeded action model. See [MATCH_ENGINE.md](MATCH_ENGINE.md).

Standings award three points for a win, one for a draw, zero for a loss. Sort by points, goal difference and goals for descending, then stable club ID ascending for an exact tie. The final ID tie-break is an original deterministic rule, not a claim to implement official Premier League regulations. Played/won/drawn/lost/goals/points derive only from committed full-time results. Duplicate results, unknown fixtures/clubs, wrong rounds and invalid scores are rejected; pending/abandoned fixtures do not enter the table.

## Command workflow

| Command | Valid transition and effect |
| --- | --- |
| `ADVANCE_CALENDAR` | Between rounds with no unresolved match: jump to the next generated fixture date and enter `matchday` |
| `START_MATCH` | On the scheduled date: create the managed fixture and enter `playing` |
| `MATCH_COMMAND` | Apply an existing match advance/tactics/substitution command; only the managed side can receive personnel/tactics changes |
| `COMPLETE_ROUND` | After managed full time: simulate remaining fixtures, then commit all ten full-time summaries and advance the completed-round count |
| `REPLAY_ABANDONED` | Explicitly retry only a blocked abandoned fixture, within its three-retry limit |

Managed play retains fifteen-minute checkpoints, formation/instruction changes and substitution rules. Full time enters `round-ready`; it does not immediately update standings. `COMPLETE_ROUND` uses the same engine to advance the other nine matches to full time. It does not draw independent fabricated scores.

All ten results are staged before entering the table together. If any fixture is abandoned, status becomes `blocked`; staged results remain outside standings and the calendar cannot skip the unresolved round. An explicit retry records a new deterministic attempt, preserving the abandonment audit. A completed win/loss cannot be rerolled. After three exhausted retries, the season stays blocked for review; no forfeit score is awarded.

After a successful round, the next calendar jump is a separate command. The managed team's final formation, instructions and surviving selections carry forward; substitutes can remain starters and outgoing players return to the bench. Missing slots after dismissals are restored from eligible squad players by positional familiarity, prior starter and stable ID. This repairs a legal XI without ability-based squad AI. There are no cross-match suspensions.

Each fixture starts with configured condition and morale. Fatigue/cards affect its own match, not persistent injuries, recovery or fitness across the season. Opposition sides use configured selections/instructions without tactical or transfer AI. At round 38, status is `finished`; a new season, promotion/relegation and further career systems are outside this milestone.

## Archives, compatibility and atomic writes

`touchline-season` schema version 1 has these fields:

```text
format, schemaVersion, engineVersion, matchEngineVersion,
id, careerId, updatedAt, snapshot, career, initialConfig,
commands, rosterManifest
```

Both engine versions are currently 1. The required manifest travels with the exact source snapshot. File limits are **16 MiB and 5,000 commands**. The parser also bounds nested data complexity and rejects unsupported versions, extra derived-result fields, getters, custom prototypes, broken relationships and inconsistent source/career/date bindings. Saved scores or calendar state cannot replace replay.

Cold loads/imports replay the entire command log and validate the supplied roster contract. They reconstruct results/calendar rather than trusting serialized derived state. This is deterministic validation of the supplied evidence record, not independent source authentication. More completed fixtures require more replay work.

Dexie database `touchline-local` upgrades additively from schema 1 to **schema 2**, adding `seasons: id,careerId,updatedAt`. Existing snapshot/career stores and rows are preserved; old JSON formats do not change. The separate `touchline-match-sessions` database remains untouched.

Untrusted initial/bulk season saves fully replay. Normal command commits use a private verified-state cache, require the UI's exact expected command prefix and recheck the stored archive inside the transaction. Career date and season progress are written together; stale/concurrent updates or invalid operations fail without partially advancing the career. Cached references are not shared with callers.

One season is bound to a career. A stored season cannot acquire a different career, source snapshot, manifest or initial configuration. Ordinary progress is append-only; explicit valid season import may restore earlier matching progress. Generic career saves cannot independently change a bound date, source snapshot or managed club. Unrelated metadata can remain editable within those guards; the profile editor is disabled for a bound season.

`touchline-save` version 1 remains a career-only export, excluding season progress. `touchline-match` version 1 remains an independent exhibition archive. Use **Export season backup** for the complete league/career record and retain current progress before restoring an older file. Browser-origin storage remains local and can be cleared.

## Review boundary

Source research and full integrated verification remain separate gates. Automated synthetic fixtures may exercise the core, scheduling, evidence contract and persistence without shipping invented current rosters. No ready current-season app, completed Milestone 3 or successful Mac season workflow is implied by those tests. [MILESTONE_3_REVIEW.md](MILESTONE_3_REVIEW.md) records actual evidence and outstanding requirements.
