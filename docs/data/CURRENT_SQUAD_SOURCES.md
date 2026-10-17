# Current squad source research

## Required gate and present status

The user's mandatory instruction is **“Require verified current club squads first.”** Milestone 3 must establish actual 2026/27 competition club membership and current player-to-club squad assignments **as of 16 October 2026**. Dated authoritative evidence, source access and applicable rights must be documented before these facts populate the current-season application.

**Status: current squads remain unverified and database reuse permission is unresolved.** Official main-site access has begun working after the initial proxy failures. The 17 October 2026 recheck found a 2026/27 page marker, not a verified twenty-club list or squads. Actual terms require prior written approval for the intended database reuse, and no such approval has been established. Current verified counts remain **zero memberships, zero squad publications and zero player-club assignments**.

The earlier proposal for a custom season with original roster allocations is superseded. Archival CC0 biographies, an opt-in ability baseline and valid JSON do not satisfy this gate. Existing Milestone 2 exhibitions retain their established scope; they are not a current-roster database.

## Evidence rules

- Prefer primary competition/league and official club sources that explicitly cover the 2026/27 season. A club identity being authentic does not establish membership in that season's competition.
- Record the source URL, authority, publication date where supplied, fact's effective date/as-of scope and retrieval timestamp separately. A retrieval date or upstream code commit date is not the effective date of a squad assignment.
- Verify club membership, club squad membership and competition registration/eligibility as distinct claims. Record whether a list covers senior registrations, under-age players, loans or another stated category. Do not infer eligibility, medical availability or squad completeness from a name appearing on a page.
- Use dated publication, an explicit official effective date or authoritative archived as-of evidence to support the required cutoff. An undated current page alone cannot silently prove a historical or future effective assignment.
- Preserve stable player/club IDs and source identifiers. Resolve duplicate names, loans, departures and conflicting sources explicitly. Do not guess an identity or choose the most convenient assignment to fill a squad.
- Document licence, terms and permitted use separately from access success. Public visibility, robots access or a successful API call does not establish permission to bundle or redistribute an entire dataset. Do not bypass authentication, paywalls or access restrictions.
- Mark missing evidence, incomplete coverage and unresolved rights/access as blockers. Do not mark a record verified because its imported schema passes.
- Preserve reviewed source snapshots and audit records. Corrections need a new version with an explicit audit trail; no original, synthetic or archival substitutes may populate the current-season application.

## Source register

The following exact sources were attempted on 16 October 2026 UTC. Every request returned curl exit 56, `CONNECT tunnel failed, response 403`, before origin access. No page content was obtained. A domain's expected purpose is recorded below; it is not proof that the page supplies a suitable 2026/27 dataset.

| Candidate source and intended purpose | Exact attempted URL | Access result | Effective-date evidence | Rights/coverage result |
| --- | --- | --- | --- | --- |
| Premier League club membership | https://www.premierleague.com/en/clubs | Proxy CONNECT blocked | Not obtained | Unverified |
| Premier League dated announcements | https://www.premierleague.com/en/news | Proxy CONNECT blocked | Not obtained | Unverified |
| Premier League terms | https://www.premierleague.com/en/legal/terms-and-conditions | Proxy CONNECT blocked | Not obtained | Terms not reviewed |
| Premier League alternate terms path | https://www.premierleague.com/en/terms-and-conditions | Proxy CONNECT blocked | Not obtained | Terms not reviewed |
| Arsenal official player listing | https://www.arsenal.com/men/players | Proxy CONNECT blocked | Not obtained | Unverified; no current league membership inferred |
| Liverpool official player listing | https://www.liverpoolfc.com/team/mens | Proxy CONNECT blocked | Not obtained | Unverified; no current league membership inferred |
| Sportmonks provider documentation | https://docs.sportmonks.com/football | Proxy CONNECT blocked | Not obtained | Provider access, coverage and terms unverified |

Required coverage remains pending: the actual competition club list, dated current squad assignments and any separately claimed competition registration/eligibility. These access observations establish an environment networking blocker, not the factual content or permitted use of the unavailable sources. Recheck after a meaningful access change or evaluate separately supplied authoritative data and its rights; do not replace missing evidence with archival allocations.

An additive network-settings draft was saved for `premierleague.com`, `www.premierleague.com`, `arsenal.com`, `www.arsenal.com`, `liverpoolfc.com` and `www.liverpoolfc.com`. The later successful Premier League request supersedes the access blocker for that tested endpoint. Other destinations and actual source content require their own checks; source facts and rights remain unverified until reviewed. The Sportmonks documentation domain was not included in the six-domain draft. The table above preserves the initial failed attempts rather than claiming those failures remain universal.

## Recheck findings — 17 October 2026

Recorded at 04:15:06 UTC:

| Exact source | Observed result | What remains unresolved |
| --- | --- | --- |
| https://www.premierleague.com/en/clubs | HTTP 200; official HTML has `ACTIVE_PL_SEASON_ID=2026` and navigation paths for 2026-27; club list is a client-rendered placeholder | No twenty-club membership list, publication/effective date or roster assignments verified from this response |
| https://www.premierleague.com/en/terms-and-conditions | HTTP 200; actual intellectual-property clause reviewed | No prior written approval covering the intended database uses is established; page publication/update date is unknown |
| https://api.premierleague.com/content/premierleague/text/EN/?page=0&pageSize=5&search=2026%2F27%20squad | Bounded search for a dated squad publication failed at proxy CONNECT with 403 before origin | No publication or API content retrieved |
| https://docs.sportmonks.com/football | Proxy CONNECT 403 before origin | Provider access, coverage and contractual permissions unreviewed |

The terms permit reasonable private/personal downloading and printing. Their other-use restriction expressly includes “creating a database (electronic or otherwise) that includes material downloaded or otherwise obtained from the Website or App” without prior written approval. The research allowance is not treated as permission to build, bundle or export the Touchline squad database. The retrieved terms HTML has SHA-256 `22c6f3e83decb316d2c3015afcce644083d8f81b85429de73270f21eb3a043fa`.

Mass roster collection has not proceeded under these terms. The remaining source path is documented written permission covering the intended uses, or an appropriately licensed current feed, followed by actual date/coverage/identity review. No source database, current assignments or review manifest was created from this research. A provider has not yet been selected, and no provider credential is assumed necessary before its rights/access requirements are known.

An expanded network draft preserves those six official domains and adds `api.premierleague.com`, `docs.football-data.org`, `football-data.org`, `www.football-data.org`, `api.football-data.org`, `docs.sportmonks.com` and `www.sportmonks.com` for bounded source/provider research. The draft save was confirmed with `requires_publish: true`. These additions have not been verified at runtime; review/save and publication remain user actions. No provider has been selected, no account or subscription created, and no credential value requested in chat.

The project is private. A candidate feed must permit the actual local storage, display and private backup/export workflow. Public redistribution rights are assessed separately if data is later published or bundled; they are not an extra prerequisite for a private import. This scope does not remove the Premier League site's explicit database-use restriction.

## Per-club coverage record

Create a record only after the competition club identity and membership have evidence. Do not prefill a twenty-club list from a different season.

For each club record:

- Stable club ID/name and competition membership source.
- Exact squad source, its stated season and covered player categories.
- Effective/publication dates, retrieval timestamp and retained source evidence or permitted audit reference.
- Stable IDs and evidence for each included player assignment; documented handling of loans, departures and conflicting names.
- Coverage/completeness assessment and any unresolved assignment or eligibility question.
- Source licence/terms, usage restrictions, attribution and whether bundling/redistribution is established.
- Result: verified for the stated scope, needs review, or blocked, with the reason and date reviewed.

## Gate checklist

The gate is met only when required competition membership and squad coverage are supported, identities/cross-references validate, conflicts are resolved or explicitly excluded within a documented scope, rights/access support the intended use, and the resulting versioned data passes import validation. A partial verified subset must remain labelled partial; it cannot stand in for a complete twenty-club season.

Pure engine and persistence development may proceed with clearly identified automated test fixtures independently. Milestone 3 and its current-season application must not be described as complete until this data gate is satisfied and the actual integrated checks pass.
