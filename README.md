# Touchline

A local-first football management game for modern browsers, targeting macOS on Apple Silicon. The reviewed foundation uses a matte charcoal background, navy gradient bars and silver accents. The exhibition workflow is implemented and reviewed; Milestone 3 season development is in progress.

## Milestone 3 status

**Database research is deferred at the user's request.** Continue reviewing the season through the separate development demo described below. The foundation implements scheduling, managed matches, results, tables, calendar commands and portable archives. No verified, appropriately licensed 2026/27 twenty-club squad dataset has been established, so real-data season creation remains disabled. Original roster allocations and archival identities cannot substitute for that review; the real-data milestone is not complete.

Open **Fixtures**, **Competitions**, or **Matchday → League season** to inspect roster readiness and **Import squad dataset**. A plain database import does not supply the required dated review manifest. Official main-site access now works, but current squads remain unverified and the reviewed terms require prior written approval for the intended database reuse; none has been established. [CURRENT_SQUAD_SOURCES.md](docs/data/CURRENT_SQUAD_SOURCES.md) records the actual evidence and remaining source/rights requirements.

The generated game calendar has 38 weekly rounds and 380 fixtures. It is not the official Premier League fixture list; its dates and final table tie-break are original game rules. [SEASON_ENGINE.md](docs/SEASON_ENGINE.md) explains the implemented foundation. [The Milestone 3 review](docs/MILESTONE_3_REVIEW.md) distinguishes code checks from the unresolved data gate and unreviewed Mac workflow. Existing exhibitions remain under **Matchday → Exhibition**.

The current build passes TypeScript and all 222 unit/integration tests across 21 files. All seven development-demo browser workflows pass, including club/player navigation, existing backup compatibility, tactics/substitutions, two completed rounds, exact reload/backup restore and invalid-import preservation. Fourteen demo accessibility scans found no serious/critical issues. The last full production browser run passed all fifteen workflows, including the complete 38-round season; this demo-only update produces the same production entry/assets and passes a fresh production-boundary browser check. These checks do not supply or verify real current squads. Detailed evidence is in the development-demo and Milestone 3 reviews.

## Run locally

For the work-in-progress season foundation, choose branch **`milestone-3-season-loop`** on GitHub, then **Code → Download ZIP**. Unzip it in Finder. The verified-roster gate remains in place on this branch. Branch `milestone-2-match-engine` preserves the earlier exhibition review checkpoint.

Use Node.js `24.19.0` as pinned by `.nvmrc` (minimum supported version `22.12.0`). If you use nvm, run `nvm install` followed by `nvm use`. Open Terminal, type `cd ` including the space, drag the unzipped project folder into Terminal, and press Return. Run:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Keep Terminal running while using the app; press Control-C there when finished. No application backend, account, API credential or subscription is required. Installing dependencies needs internet access; gameplay uses local assets.

## Review a season without a database

The user has postponed real database research until next week. To review the season systems now, use the same branch and project folder, then run:

```sh
npm ci
npm run dev:demo
```

Open the URL printed by Terminal (the demo uses port 5174). Choose a demo club and **Start demo season**, or continue the saved demo. **Club** opens your managed club overview; **Squad** lists its sixteen players. Click a player name to open all 45 attributes, position/role information and condition/morale, then choose **Back to squad** to return. These views inspect the current season without changing its saved decisions.

Use **Fixtures**, **League table** and **Matchday** to inspect the 38-round calendar, progress matches, change tactics/substitutions and commit rounds. All twenty clubs and their players have generic demo labels and the same 10/20 comparison attributes. These are development scenarios, not real squads or player ratings.

Demo decisions save locally and resume at the same URL. **Export demo backup** makes a portable replay backup; **Import demo backup** validates and restores one. Export before starting another demo or restoring an older checkpoint. Demo saves stay separate from ordinary careers and exhibitions and are not converted into real-data careers later.

When updating from a downloaded ZIP, export a demo backup first, stop the old server with Control-C, then open Terminal in the newly unzipped project folder and run `npm ci` followed by `npm run dev:demo`. Keep the same browser and local URL to resume local progress, or use **Import demo backup**. Existing version-1 demo backups remain supported; adding club/player views does not reset a season or change the backup format.

The demo runs only through the explicit development command. `npm run dev` and the ordinary production build retain the real-data workflow and its source-review requirement. The production build contains no demo entry or generated demo records. [DEVELOPMENT_DEMO.md](docs/DEVELOPMENT_DEMO.md) describes the boundary and verification.

To check and preview the production build:

```sh
npm run check
npm test
npm run build
npm run preview
```

Browser checks use Playwright against the production build. Install its Chromium browser once with `npx playwright install chromium`, then run `npm run build` followed by `npm run test:browser`. Playwright starts the preview server itself. Linux may also require the browser's documented system dependencies; macOS uses its native Chromium bundle. Reports and per-test screenshots are written inside `playwright-report/` and `test-results/`; failed tests also retain traces. GitHub Actions uploads these directories for diagnosis and uses Ubuntu 24.04 with Node 24-compatible actions.

Run `npm run test:demo` for the separate development-demo browser suite. It starts its own Vite demo server on port 4181 and writes to `playwright-report-demo/` and `test-results-demo/`. The ordinary production suite excludes these development-only tests.

Use the exact URL printed by each command. Browser storage is scoped to its origin: a development URL and a preview URL can have separate saves. Export before changing origin, browser or profile, or clearing website data.

The deterministic synthetic batch report runs separately:

```sh
npm run calibrate -- --output calibration-report.json
```

This measures original model design targets, not empirical calibration against a real league. [MATCH_ENGINE.md](docs/MATCH_ENGINE.md) explains options and interpretation. No synthetic fixtures enter the ordinary production bundle; the explicit development demo is separate.

## Review Matchday

Open **Matchday → Exhibition** after choosing a reference club. Home and Away are temporary coach selections from sourced real identities, not verified current club squads. This exhibition mode does not populate the gated season workspace.

1. Inspect the selected players, seed, condition, morale, formation and five instructions for each side. The separate exhibition pool has 32 authentic archival identities, including five sourced goalkeepers. Detailed outfield familiarity remains unknown. Default selections use 14 players per side: an XI and three substitutes, including a reserve goalkeeper.
2. Supply complete assessments or explicitly accept **Use uniform 10/20 exhibition estimates** for missing values. This is an original comparison scenario, not an assessment of the named athletes. Existing known ratings are preserved; source records and the career are unchanged.
3. Choose **Prepare exhibition match**, then **Kick off · advance to 15′**. Advance through 15-minute decision checkpoints to 90 minutes. Review the score, statistics, condition and events. **Home/Away touchline controls** provide eligible substitutions, formation/lineup decisions and all five instructions.
4. Compare statistics with the event log. Score, statistics and commentary all derive from the same simulated events. The display initially shows key events; the full event option displays the latest 120 entries while the complete stream remains part of deterministic replay. Possession counts phases; expected goals is this model's probability estimate.
5. Use **Export match** for a portable exhibition backup. Reload the same URL, restore the latest session or import the file to reconstruct the same accepted decisions. Export your current checkpoint before restoring an older backup with the same ID. Career exports and match exports are separate files.

The engine allows five substitutions in three in-play windows, with minute 0 and 45 free windows. The current workspace supplies three bench players per team, so only those three can enter. The first model has no injuries, added time, extra time, penalty shootouts, season loop, transfer AI or 2D animation. Starting condition and morale are scenario inputs, not real medical or psychological facts. [The Milestone 2 review](docs/MILESTONE_2_REVIEW.md) records the acceptance boundary and actual evidence.

## Game font

The whole interface uses **Humanist 777 Black BT**, including headings, navigation, tables, attributes and form controls. Install your licensed copy on your Mac with Font Book, then restart the browser so it can discover the font. The application recognises common full and PostScript names for the Black face.

No font binary is bundled or fetched. If the face is unavailable, the interface uses a system sans-serif fallback. The single Black face is used throughout; lighter font cuts are not supplied. Typography is controlled by `--font-game` in [src/ui/tokens.css](src/ui/tokens.css).

The base skin is also defined in that token file. Its matte texture is drawn with subtle CSS gradients and requires no image downloads. Navy gradients distinguish navigation and panel bars; silver text, borders, selection markers and focus rings keep dense tables and attribute screens readable. Dialogs and native form controls follow the same dark palette.

## Scope and honest limitations

Milestone 1 implemented the application shell, club selection, player and squad inspection, typed models, validated data import and versioned career saves. The user reviewed the font and skin on their Mac and authorized the exhibition match foundation on 16 October 2026. The user's subsequent Mac workflow review and automated Milestone 2 checks are recorded in [its review](docs/MILESTONE_2_REVIEW.md).

The bundled snapshot contains 12 archival real-player identities and four club identities from pinned CC0 Openfootball sources. It is not a verified 2026/27 roster. No player has a current club assignment, so a newly selected club has an empty squad. The reference directory remains available for inspection. Nationalities are unknown: a source country grouping does not establish citizenship. Only the source's goalkeeper code maps directly to `GK`; broad defender, midfielder and forward codes remain notes rather than guessed detailed positions.

Unknown attributes display as unavailable. You may enter documented original assessments in the profile editor or import an appropriately sourced complete snapshot. Role scores need a compatible known position and every weighted attribute. For example, Jordan Pickford's sourced goalkeeper position permits a goalkeeper score after all eight required attributes have been assessed; entering outfield attributes alone cannot infer a detailed position. Biographies do not establish football ability.

The exhibition engine is documented in [MATCH_ENGINE.md](docs/MATCH_ENGINE.md). The user has deferred real database acquisition. Verified current squads remain necessary for real-data integration, while the separate development demo permits season review now. Season code is a foundation, not a completed current-season game. Empirically calibrated ratings, transfers, AI squad management, injuries, repeated new seasons and 2D matches remain outside this milestone. A service worker and installable PWA are not assumed.

Career-only exports remain `touchline-save` version 1. They exclude exhibition sessions and league progress. **Export season backup** includes its career, roster snapshot, review manifest and accepted decisions; **Export match** remains the independent exhibition backup. Once bound to a season, career date, managed club and source changes must go through validated season operations. Retain the current complete backup before importing an earlier one.

## Review the foundation

1. Choose a reference club, then inspect the dashboard, navigation and empty squad state. Open the reference player directory to sort, filter and inspect the authentic identities.
2. Open a player profile and review the complete 45-attribute vocabulary and source/completeness information. Unknown values must remain visibly unknown.
3. Use the profile's attribute editor to enter your own 1–20 game estimates, confidence, and a rationale describing evidence and uncertainty. Leave unsupported attributes blank. Saving creates a new immutable snapshot revision and preserves the original reference; it does not edit biography or hidden potential.
4. Export a career save, reload the same browser URL, and restore the exported JSON. The backup includes its exact source snapshot and simulation seed. Export your current state first if restoring an older backup with the same career ID.
5. To review roster imports, start from [src/reference/snapshot.json](src/reference/snapshot.json) and the schema in [src/data/schema.ts](src/data/schema.ts). Supply verified assignments, detailed positions and provenance only where your source supports them. Give changed snapshots a new ID. Import a complete version-1 snapshot, choose a club, and inspect the validated squad. Arbitrary CSV and raw provider API responses require an adapter first.

The [source audit](docs/data/source-extract.json) preserves exact extracted source lines, pinned URLs, retrieval dates and source-file checksums. CC0 licence copies are stored beside it in `docs/data/`. Local original assessments use a separate `touchline-local-editorial` provenance record and need rights review before redistribution.

The new [exhibition source audit](docs/data/exhibition-source-extract.json) records the separate 32-player pool. It does not rewrite the original snapshot or establish current club assignments.

## Milestone 2 verification

On 16 October 2026, cloud type checking, the production build, all 131 tests across 14 files and all nine production browser tests passed. The unit run included 6,400 synthetic matches across 16 scenarios, meeting all 14 internal design targets. A separate [7,680-match report](docs/calibration/milestone-2-engine-v1.json), using 480 spread seeds per scenario, also passed all 14 targets. Fifteen accessibility scans found no serious or critical issues on the tested surfaces; the tested workflows had no uncaught browser errors or external HTTP requests.

These automated results are Linux/browser and synthetic-model checks. The user separately confirmed match progression, tactical changes, substitutions, match archive import and completion to 90 minutes on their Mac on 16 October 2026. The browser was unspecified. [The Milestone 2 review](docs/MILESTONE_2_REVIEW.md) retains the exact evidence and remaining platform limits. These checks do not establish empirically calibrated real-player ratings.

## Earlier verification

On 15 October 2026, Linux x86-64 with Node 24.19.0 and Chromium 154 passed:

- Frozen-lockfile installation with `npm ci`, strict type checking, all 57 foundational tests and the production build.
- All four Playwright tests against both development and production servers: navigation, sorting/filtering, editorial role calculation, reload persistence, exact export/restore and invalid-import preservation.
- Keyboard navigation and modal focus, no horizontal overflow at 1280 and 800 pixels wide, and nine automated accessibility scans with no serious or critical findings on the tested surfaces.
- No uncaught browser errors or external gameplay requests in those workflows; `npm audit` reported no known dependency vulnerabilities at the time of the check.

The 16 October 2026 matte charcoal/navy/silver skin refresh also passed type checking, all 57 foundational tests, the production build and all four browser tests. Fourteen accessibility scans, including assessed attributes, expanded assessment notes, the inbox and error states, reported no serious or critical issues. Cloud visual checks use the fallback font; the installed Humanist face was confirmed loading by the user on their Mac.

See [the original milestone review](docs/MILESTONE_1_REVIEW.md) for the historical review boundary. The cloud results and user reviews do not establish compatibility across all macOS browsers. The user's confirmed Matchday checks and automated Milestone 2 evidence are recorded in [its review](docs/MILESTONE_2_REVIEW.md).

## Project documents

- [GAME_SPEC.md](GAME_SPEC.md) — the supplied master specification, preserved in full.
- [ARCHITECTURE.md](ARCHITECTURE.md) — implementation plan, layer boundaries, decisions and risks.
- [DATA_POLICY.md](DATA_POLICY.md) — source rights, provenance, unknown data and import rules.
- [MATCH_ENGINE.md](docs/MATCH_ENGINE.md) — version-1 football model, reproducibility and limits.
- [MILESTONE_2_REVIEW.md](docs/MILESTONE_2_REVIEW.md) — review workflow, evidence and acceptance boundary.
- [SEASON_ENGINE.md](docs/SEASON_ENGINE.md) — season foundation, source gate, original rules and archives.
- [MILESTONE_3_REVIEW.md](docs/MILESTONE_3_REVIEW.md) — work-in-progress status and verification limits.
- [DEVELOPMENT_DEMO.md](docs/DEVELOPMENT_DEMO.md) — database-free season review and separate saves.
- [ROADMAP.md](ROADMAP.md) — milestone boundaries and acceptance criteria.
- [AGENTS.md](AGENTS.md) — short standing coding rules.

For cloud setup, the official [Codex cloud environment documentation](https://developers.openai.com/codex/cloud/environments) explains environment installation and startup configuration. Use the task's existing isolated checkout rather than creating an additional worktree.
