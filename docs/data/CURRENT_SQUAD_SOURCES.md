# Current squad source research

## Required gate and present status

**Research paused at the user's request on 17 October 2026.** The user will research a downloadable database next week and has authorized continued development without it. Do not require a provider subscription or further source research to review the separate development-only season demo. The evidence/rights requirements below remain prerequisites for later real-data integration; no current squads have been verified by this deferral.

The user's mandatory instruction is **“Require verified current club squads first.”** Milestone 3 must establish actual 2026/27 competition club membership and current player-to-club squad assignments **as of 16 October 2026**. Dated authoritative evidence, source access and applicable rights must be documented before these facts populate the current-season application.

**Status: current squads remain unverified; Sportmonks is a documented candidate for permitted API-data use.** Provider documentation became accessible in the later 17 October 2026 review below. Its game-use/storage terms and Premier League coverage support considering a paid feed, but no account entitlement or actual current roster payload has been verified. The Premier League website remains a separate source: its page marker does not establish twenty-club membership or squads, and its database-reuse clause requires approval that has not been obtained. Current verified counts remain **zero memberships, zero squad publications and zero player-club assignments**.

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

## Alternative provider review — 17 October 2026

The following public provider pages now respond with HTTP 200. The earlier network failures are historical observations, not a continuing prerequisite to this documentation review. Environment publication is not required merely to read these now-accessible pages. No account, subscription or trial was created, no payment was made, and no API credential or authenticated roster response was obtained.

### Sportmonks: recommended candidate, actual squads pending

- [Terms of service](https://www.sportmonks.com/terms-of-service/), retrieved at 05:03:18 UTC, state: “We provide data for you to build apps, websites, games, and so on.” They also state: “However, distribution, transfer, and storage of data provided by our services is allowed, but reselling the product is forbidden without our consent.” These API-data permissions support game display, stored source snapshots and private transfer/backup. They do not grant separate rights to team logos or player photos, which remain excluded. Terms HTML SHA-256: `248878f43b54173cffb5f497f6716baafc0c291a692d41b8d83523430d2bd089`.
- The reviewed terms do not explicitly establish perpetual post-cancellation use. Do not promise that a trial or one-month subscription grants a permanent offline dataset; clarify ongoing retention/display after cancellation before relying on that workflow.
- [Coverage](https://www.sportmonks.com/football-api/coverage/) lists Premier League (league ID 8), with a table last-update marker of 12 October 2026. This verifies advertised coverage, not any individual current squad or dated player assignment.
- [Current team squad documentation](https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints/team-squads/get-team-squad-by-team-id.md) describes `/v3/football/squads/teams/{ID}` as returning the current domestic squad. [Teams by season documentation](https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints/teams/get-teams-by-season-id.md) provides a route for competition-season membership. Both require provider access for real data; documentation examples are not 2026/27 evidence. Contract dates alone are not registration dates. No guaranteed arbitrary as-of-day roster endpoint was established, and historical squad coverage is documented as incomplete.
- [Published Starter pricing](https://www.sportmonks.com/football-api/plans-pricing/) is EUR 29 per month when paid monthly, or EUR 24 per month when billed yearly, excluding applicable VAT; it advertises any five covered leagues and squad data. Actual account entitlement remains unverified. The free tier advertises Danish Superliga and Scottish Premiership, not Premier League. The paid-plan 14-day trial requires a card and automatically bills unless cancelled; no trial or payment has been authorized.

Before importing, verify the actual twenty 2026/27 clubs, dated current player assignments, identities, goalkeepers, completeness, loans and any claimed registration/U21 scope. Confirm the source can support the required 16 October cutoff rather than treating retrieval time as historical proof. Provider legitimacy does not itself satisfy these factual checks.

### Other alternatives checked

- [Football-data.org coverage](https://www.football-data.org/coverage) lists Premier League, and its [team resource documentation](https://docs.football-data.org/general/v4/team.html) includes squads. The [pricing page](https://www.football-data.org/pricing) advertises squads in the EUR 29/month “Free + Deep Data” tier, with applicable VAT; its free plan lists basic fixtures, results and tables. Do not assume free Premier League coverage includes squad access. [API policies](https://docs.football-data.org/general/v4/policies.html) describe squad entries as players who appeared in a team's roster, which is not by itself a complete current registration list.
- Football-data.org's actual terms are embedded in its [registration page](https://www.football-data.org/client/register), not the guessed `/terms` path (404). They require visible attribution, protect credentials, and clause 9.1 prohibits referencing obtained football data on the customer's site/service after subscription cancellation. This is a material limitation for a lasting offline snapshot; no account or squad payload was obtained.
- [OpenFootball](https://github.com/openfootball/football.json) has a verified CC0 licence and an accessible 2026/27 Premier League fixtures/results file. That file supplies no players or squad assignments and cannot meet this gate. A new bounded Wikidata check remained proxy-blocked; existing archival biographies are still insufficient for current complete squads.

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
