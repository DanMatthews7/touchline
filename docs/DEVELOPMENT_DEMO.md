# Database-free development season

On 17 October 2026 the user deferred database research until next week and asked to continue. This entry lets them review the working season systems without claiming that the missing real squads have been supplied.

## Start on the Mac

Download the `milestone-3-season-loop` branch and unzip it. In Terminal, type `cd `, drag the project folder into the window, and press Return. Run:

```sh
npm ci
npm run dev:demo
```

Open the URL printed by Vite. This command selects the explicit `season-demo` development mode on port 5174. Keep Terminal running; Control-C stops it. The usual `npm run dev` command opens the ordinary game on its usual port.

Choose a demo club, inspect the seed and dates, and select **Start demo season**. Use **Fixtures**, **League table** and **Matchday**. Calendar advance stops at a scheduled match; managed play pauses at fifteen-minute checkpoints for tactics and substitutions. At full time, commit the whole round to enter its ten results into the table. All outcomes come from the existing match engine. Thirty-eight rounds complete the demo season.

There are twenty generic demo clubs with generic player labels. Every ability attribute is the same original 10/20 comparison input. These are neither real player records nor assessments, official fixtures, current registrations or an empirical model of a real league. Condition, morale, formations and the optional home effect are scenario settings.

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

Match completion to 90 minutes, a demo substitution, round commitment/table updates and demo backup/reload/import have not yet been reported on the Mac. Next review: finish the match, choose **Complete round & advance league**, inspect **League table**, then export a demo backup and verify reload/import restores the same progress. These pending checks are distinct from the earlier successful Mac exhibition review and automated Linux results.
