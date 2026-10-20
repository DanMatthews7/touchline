# Database-free development season

On 17 October 2026 the user deferred database research until next week and asked to continue. This entry lets them review the working season systems without claiming that the missing real squads have been supplied.

## Start on the Mac

Download the `milestone-3-season-loop` branch and unzip it. In Terminal, type `cd `, drag the project folder into the window, and press Return. Run:

```sh
npm ci
npm run dev:demo
```

Open the URL printed by Vite. This command selects the explicit `season-demo` development mode on port 5174. Keep Terminal running; Control-C stops it. The usual `npm run dev` command opens the ordinary game on its usual port.

Choose a demo club, inspect the seed and dates, and select **Start demo season**. **Club** shows your managed club and next fixture. **Squad** opens its sixteen players; select any name to inspect its profile and all 45 attributes, then use **Back to squad**. **Fixtures**, **League table** and **Matchday** remain available. Calendar advance stops at a scheduled match; managed play pauses at fifteen-minute checkpoints for tactics and substitutions. At full time, commit the whole round to enter its ten results into the table. All outcomes come from the existing match engine. Thirty-eight rounds complete the demo season.

There are twenty generic demo clubs with generic player labels. Every ability attribute is the same original 10/20 comparison input. These are neither real player records nor assessments, official fixtures, current registrations or an empirical model of a real league. Condition, morale, formations and the optional home effect are scenario settings.

## Club and player access

The initial demo exposed only fixtures, standings and matchday. The 20 October follow-up adds **Club** and **Squad** navigation and clickable player profiles. The club overview shows the managed demo club, standings and next fixture; squad/profile screens show the actual demo players and the shared attribute panels. No biographical/provenance records or real-world club finances are invented to supply these views.

During your active match, condition, morale, formation and selection come from its current checkpoint. Between rounds, the views describe the configured next-match inputs and carried coaching selection; the match model resets condition/morale for each fixture. Labels distinguish these states. Opening a profile, filtering the squad or changing views does not add commands or write a save.

This change leaves scenario version 1, demo backup version 1, the generic player generator and both simulation engines unchanged. Existing saved seasons and version-1 backups remain usable. Export a backup before updating the downloaded code, stop the old development server, and restart `npm run dev:demo` from the new project folder. At the same browser URL local progress resumes; the backup can also restore it explicitly.

## Save boundary

Demo progress saves on this device after accepted decisions and resumes at the same browser URL. Use **Export demo backup** before clearing browser storage, changing origins, starting a new demo or importing an earlier checkpoint. **Import demo backup** accepts the distinct `touchline-season-demo` version-1 format, not a career, real season, roster dataset or exhibition archive.

The demo store is the separate IndexedDB database `touchline-season-demo`. Its archive retains the scenario, engine versions and accepted commands. The generated generic teams are reconstructed from the versioned scenario; results and tables are rebuilt through deterministic replay. Imported scores or claimed source evidence are not trusted. Invalid imports and failed writes must preserve the last valid checkpoint. Ordinary incremental decisions check the previously stored command log to reject stale writes from another tab.

No `DatabaseSnapshot`, current-squad manifest, reviewer attestation or licensed-provider claim is created. Ordinary career/exhibition databases are not opened by this entry. Their formats and records remain unchanged. A later real database starts a separate real-data career; demo results do not turn into real fixtures or carry into it.

## Build boundary

`src/main.tsx` loads the demo only when `import.meta.env.DEV` is true and `import.meta.env.MODE` is `season-demo`. The ordinary production build removes this import branch and excludes the demo application and generated records. A query parameter cannot enable it in that build.

The demo presentation reuses `SeasonFixtures`, `SeasonStandings` and `SeasonMatchday`; the pure season/match engines are unchanged. It does not reuse `SeasonWorkspace`'s verified-roster setup or the real-data season archive. The charcoal/navy/silver skin and locally resolved Humanist font remain shared.

## Verification

The following checks passed on 19 October 2026 in Linux, Node 24.19.0 and system Chromium 154:

| Check | Actual result |
| --- | --- |
| TypeScript | `npm run check` passed |
| Complete unit/integration suite | 219 tests across 20 files passed in 101.96 seconds |
| Dedicated demo persistence tests | Eight tests passed, including cold replay, invalid-import preservation, concurrent-tab conflicts and stale export after another tab starts a demo |
| Ordinary production build | Passed; generated 170 modules without a chunk-size warning |
| Demo production exclusion | Built JavaScript/CSS contain no demo application, database-name, scenario, club-ID or start-button markers |
| Demo browser suite | All five tests passed in 44.3 seconds |
| Ordinary production browser suite | All fifteen tests passed in 3.8 minutes, including the full 38-round/380-result workflow and rejection of query-parameter attempts to enable the demo |
| Managed play and results | Tactics/substitution at 15 minutes; two complete rounds and twenty results committed by the same match engine |
| Reload and portable restore | Paused event report and complete backup reproduce exactly after reload; fresh-browser import reproduces table and archive |
| Replacement and invalid imports | Same-day defaults work; replacement requires explicit confirmation, cancellation preserves progress; invalid JSON/version/normal-season/manifest files preserve the checkpoint |
| Storage and networking | Browser audit observed only `touchline-season-demo`; no ordinary career/exhibition database opens, external HTTP requests or uncaught errors |
| Accessibility and layout | Eight axe scans across setup/fixtures/table/live match at 1280/800 pixels: no serious/critical violations or page horizontal overflow |
| Saved launch command | `npm run dev:demo` started on its documented port; a fresh browser created a Demo Club 07 season, displayed all twenty standings rows and opened only the demo database |

`npm run test:demo` uses a dedicated Playwright configuration and development server. Its reports are `playwright-report-demo/` and `test-results-demo/`, separate from ordinary production reports. The CI workflow runs both suites and retains both sets of diagnostics.

The pure match and season engine files, original source snapshots and normal save formats are unchanged. The full 38-round core/source-gated workflow is covered by the existing season checks; the new browser demo checks cover two rounds rather than claiming a separate 38-round demo browser run. These automated checks do not establish Mac compatibility, current-data verification, provider entitlement or a completed real-data milestone. The user's separate Mac observations are recorded below.

Scenario version 1 fixes the generator's generic identities, attributes and initial coaching selections for replay. A future generator change needs explicit version compatibility rather than silently reinterpreting existing demo backups. Browser storage remains local to the origin; no cloud backup or service-worker offline behavior is claimed.

## Initial Mac review — 20 October 2026

After the local Terminal setup, the user reported successfully starting a demo season, changing tactics and starting to play a match, with no issues showing so far. This is an initial user-reported Mac workflow check; the browser/version and exact match minute were not specified.

The user subsequently confirmed match completion, results recorded in the table, and successful demo backup export/import. Together with the earlier season start and tactical changes, this reviews the first core demo season workflow on their Mac.

A substitution in this demo, refresh-only restoration, browser/version and a multi-round or full-season Mac run were not explicitly confirmed. The earlier successful Mac exhibition review and automated Linux checks remain separate evidence; this report does not establish verified current squads or broad macOS browser compatibility.

## Club/player navigation follow-up — 20 October 2026

The user reported that only Fixtures, League table and Matchday were accessible. The update adds Club and Squad, a managed club overview, sixteen clickable player records, public attribute/role panels and checkpoint-specific player status. Profiles return to Squad, with keyboard focus transferred to the destination heading. The navigation keeps Squad selected while a profile is open. Contracts, finances, new coaching commands and source data are not added by this presentation change.

All seven demo browser tests passed in 50.1 seconds. They verify keyboard navigation, all sixteen squad rows and 45 uniform attributes, live condition/morale agreement with Matchday, unchanged archives during browsing, existing version-1 backup import and reload, plus the existing season-management checks. Fourteen accessibility scans covering setup, Club, Squad, Fixtures, table, profile and live match at 1280/800 pixels found no serious/critical issues or page overflow. No external HTTP requests or uncaught errors occurred, and only the demo database opened.

TypeScript, all 222 unit/integration tests across 21 files (88.95 seconds), and the ordinary production build passed. The production entry HTML and hashed asset references match the prior build, and compiled assets contain no demo application, player-profile, squad or scenario markers. A targeted production browser check passed in 2.9 seconds, confirming that query parameters do not enable the demo in the real-data application. The 19 October full production/browser results above remain historical evidence; this follow-up does not claim another full 38-round browser run.

Three focused read-only projection tests passed, including live fatigue/substitution values and full-time-to-round-commit selection carry with next-fixture condition/morale reset. The generic scenario generator, both engines, demo repository/archive and ordinary save formats are unchanged. Mac review of these new navigation screens remains pending.
