# Touchline

A local-first football management game for modern browsers, targeting macOS on Apple Silicon. The reviewed foundation uses a matte charcoal background, navy gradient bars and silver accents. Milestone 2 adds an attribute-driven exhibition Matchday workspace; competition and season play follow a separate review.

## Run locally

On GitHub, choose branch **`milestone-2-match-engine`**, then **Code → Download ZIP**. Unzip it in Finder. This branch contains the match foundation; the Milestone 1 branch remains the earlier review checkpoint.

Use Node.js `24.19.0` as pinned by `.nvmrc` (minimum supported version `22.12.0`). If you use nvm, run `nvm install` followed by `nvm use`. Open Terminal, type `cd ` including the space, drag the unzipped project folder into Terminal, and press Return. Run:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Keep Terminal running while using the app; press Control-C there when finished. No application backend, account, API credential or subscription is required. Installing dependencies needs internet access; gameplay uses local assets.

To check and preview the production build:

```sh
npm run check
npm test
npm run build
npm run preview
```

Browser checks use Playwright against the production build. Install its Chromium browser once with `npx playwright install chromium`, then run `npm run build` followed by `npm run test:browser`. Playwright starts the preview server itself. Linux may also require the browser's documented system dependencies; macOS uses its native Chromium bundle. Reports and per-test screenshots are written inside `playwright-report/` and `test-results/`; failed tests also retain traces. GitHub Actions uploads these directories for diagnosis and uses Ubuntu 24.04 with Node 24-compatible actions.

Use the exact URL printed by each command. Browser storage is scoped to its origin: a development URL and a preview URL can have separate saves. Export before changing origin, browser or profile, or clearing website data.

The deterministic synthetic batch report runs separately:

```sh
npm run calibrate -- --output calibration-report.json
```

This measures original model design targets, not empirical calibration against a real league. [MATCH_ENGINE.md](docs/MATCH_ENGINE.md) explains options and interpretation. No synthetic fixtures enter the application bundle.

## Review Matchday

Open **Matchday** after choosing a reference club. Home and Away are temporary coach selections from sourced real identities, not verified current club squads.

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

Milestone 1 implemented the application shell, club selection, player and squad inspection, typed models, validated data import and versioned career saves. The user reviewed the font and skin on their Mac and authorized the exhibition match foundation on 16 October 2026. Milestone 2 acceptance is separate; actual checks and outstanding Mac review are recorded in [its review](docs/MILESTONE_2_REVIEW.md).

The bundled snapshot contains 12 archival real-player identities and four club identities from pinned CC0 Openfootball sources. It is not a verified 2026/27 roster. No player has a current club assignment, so a newly selected club has an empty squad. The reference directory remains available for inspection. Nationalities are unknown: a source country grouping does not establish citizenship. Only the source's goalkeeper code maps directly to `GK`; broad defender, midfielder and forward codes remain notes rather than guessed detailed positions.

Unknown attributes display as unavailable. You may enter documented original assessments in the profile editor or import an appropriately sourced complete snapshot. Role scores need a compatible known position and every weighted attribute. For example, Jordan Pickford's sourced goalkeeper position permits a goalkeeper score after all eight required attributes have been assessed; entering outfield attributes alone cannot infer a detailed position. Biographies do not establish football ability.

The exhibition engine is documented in [MATCH_ENGINE.md](docs/MATCH_ENGINE.md). Verified current squads, empirically calibrated player ratings, complete competition play, transfer AI and 2D matches remain outside scope. Career exports remain version 1 and exclude exhibition sessions. A service worker and installable PWA are not assumed.

## Review the foundation

1. Choose a reference club, then inspect the dashboard, navigation and empty squad state. Open the reference player directory to sort, filter and inspect the authentic identities.
2. Open a player profile and review the complete 45-attribute vocabulary and source/completeness information. Unknown values must remain visibly unknown.
3. Use the profile's attribute editor to enter your own 1–20 game estimates, confidence, and a rationale describing evidence and uncertainty. Leave unsupported attributes blank. Saving creates a new immutable snapshot revision and preserves the original reference; it does not edit biography or hidden potential.
4. Export a career save, reload the same browser URL, and restore the exported JSON. The backup includes its exact source snapshot and simulation seed. Export your current state first if restoring an older backup with the same career ID.
5. To review roster imports, start from [src/reference/snapshot.json](src/reference/snapshot.json) and the schema in [src/data/schema.ts](src/data/schema.ts). Supply verified assignments, detailed positions and provenance only where your source supports them. Give changed snapshots a new ID. Import a complete version-1 snapshot, choose a club, and inspect the validated squad. Arbitrary CSV and raw provider API responses require an adapter first.

The [source audit](docs/data/source-extract.json) preserves exact extracted source lines, pinned URLs, retrieval dates and source-file checksums. CC0 licence copies are stored beside it in `docs/data/`. Local original assessments use a separate `touchline-local-editorial` provenance record and need rights review before redistribution.

The new [exhibition source audit](docs/data/exhibition-source-extract.json) records the separate 32-player pool. It does not rewrite the original snapshot or establish current club assignments.

## Current verification

On 16 October 2026, cloud type checking, the production build, all 131 tests across 14 files and all nine production browser tests passed. The unit run included 6,400 synthetic matches across 16 scenarios, meeting all 14 internal design targets. A separate [7,680-match report](docs/calibration/milestone-2-engine-v1.json), using 480 spread seeds per scenario, also passed all 14 targets. Fifteen accessibility scans found no serious or critical issues on the tested surfaces; the tested workflows had no uncaught browser errors or external HTTP requests.

These are Linux/browser and synthetic-model checks. The new Matchday workflow still needs review on the user's Mac; its results do not establish empirically calibrated real-player ratings. [The Milestone 2 review](docs/MILESTONE_2_REVIEW.md) retains the detailed evidence and outstanding platform review.

## Earlier verification

On 15 October 2026, Linux x86-64 with Node 24.19.0 and Chromium 154 passed:

- Frozen-lockfile installation with `npm ci`, strict type checking, all 57 foundational tests and the production build.
- All four Playwright tests against both development and production servers: navigation, sorting/filtering, editorial role calculation, reload persistence, exact export/restore and invalid-import preservation.
- Keyboard navigation and modal focus, no horizontal overflow at 1280 and 800 pixels wide, and nine automated accessibility scans with no serious or critical findings on the tested surfaces.
- No uncaught browser errors or external gameplay requests in those workflows; `npm audit` reported no known dependency vulnerabilities at the time of the check.

The 16 October 2026 matte charcoal/navy/silver skin refresh also passed type checking, all 57 foundational tests, the production build and all four browser tests. Fourteen accessibility scans, including assessed attributes, expanded assessment notes, the inbox and error states, reported no serious or critical issues. Cloud visual checks use the fallback font; the installed Humanist face was confirmed loading by the user on their Mac.

See [the original milestone review](docs/MILESTONE_1_REVIEW.md) for the historical review boundary. These cloud results and the user's local font/skin review do not establish full Safari/M2 compatibility or verification of the new match workflow. Milestone 2 completion must be supported by the results in [its review](docs/MILESTONE_2_REVIEW.md).

## Project documents

- [GAME_SPEC.md](GAME_SPEC.md) — the supplied master specification, preserved in full.
- [ARCHITECTURE.md](ARCHITECTURE.md) — implementation plan, layer boundaries, decisions and risks.
- [DATA_POLICY.md](DATA_POLICY.md) — source rights, provenance, unknown data and import rules.
- [MATCH_ENGINE.md](docs/MATCH_ENGINE.md) — version-1 football model, reproducibility and limits.
- [MILESTONE_2_REVIEW.md](docs/MILESTONE_2_REVIEW.md) — review workflow, evidence and acceptance boundary.
- [ROADMAP.md](ROADMAP.md) — milestone boundaries and acceptance criteria.
- [AGENTS.md](AGENTS.md) — short standing coding rules.

For cloud setup, the official [Codex cloud environment documentation](https://developers.openai.com/codex/cloud/environments) explains environment installation and startup configuration. Use the task's existing isolated checkout rather than creating an additional worktree.
