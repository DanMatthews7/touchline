# Touchline

A local-first football management game foundation for modern browsers, targeting macOS on Apple Silicon. The interface uses an original compact green desktop style. The first milestone prepares real-data imports, player attributes and reliable career saves; the match engine follows after review.

## Run locally

Use Node.js `24.19.0` as pinned by `.nvmrc` (minimum supported version `22.12.0`). If you use nvm, run `nvm install` followed by `nvm use`. Then run these commands from the repository:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. No application backend, account, API credential or subscription is required. Dependencies must be installed before running locally.

To check and preview the production build:

```sh
npm run check
npm test
npm run build
npm run preview
```

Browser checks use Playwright. Install its Chromium browser once with `npx playwright install chromium`, then run `npm run test:browser`. Linux may also require the browser's documented system dependencies; macOS uses its native Chromium bundle.

Use the exact URL printed by each command. Browser storage is scoped to its origin: a development URL and a preview URL can have separate saves. Export before changing origin, browser or profile, or clearing website data.

## Scope and honest limitations

Milestone 1 implements the application shell, club selection, player and squad inspection, typed domain models, explicit simulation interfaces, validated data import, local persistence and portable save infrastructure. A local attribute editor records original game assessments separately from sourced biography. The implementation is ready for foundation review; actual macOS/M2 acceptance remains outstanding.

The bundled snapshot contains 12 archival real-player identities and four club identities from pinned CC0 Openfootball sources. It is not a verified 2026/27 roster. No player has a current club assignment, so a newly selected club has an empty squad. The reference directory remains available for inspection. Nationalities are unknown: a source country grouping does not establish citizenship. Only the source's goalkeeper code maps directly to `GK`; broad defender, midfielder and forward codes remain notes rather than guessed detailed positions.

Unknown attributes display as unavailable. You may enter documented original assessments in the profile editor or import an appropriately sourced complete snapshot. Role scores need a compatible known position and every weighted attribute. For example, Jordan Pickford's sourced goalkeeper position permits a goalkeeper score after all eight required attributes have been assessed; entering outfield attributes alone cannot infer a detailed position. Biographies do not establish football ability.

Match simulation, transfer AI, complete competition play, calibrated player ratings and 2D matches are outside this milestone. The repository must not claim macOS or M2 verification until the application has actually run there. A service worker and installable PWA are not assumed.

## Review the foundation

1. Choose a reference club, then inspect the dashboard, navigation and empty squad state. Open the reference player directory to sort, filter and inspect the authentic identities.
2. Open a player profile and review the complete 45-attribute vocabulary and source/completeness information. Unknown values must remain visibly unknown.
3. Use the profile's attribute editor to enter your own 1–20 game estimates, confidence, and a rationale describing evidence and uncertainty. Leave unsupported attributes blank. Saving creates a new immutable snapshot revision and preserves the original reference; it does not edit biography or hidden potential.
4. Export a career save, reload the same browser URL, and restore the exported JSON. The backup includes its exact source snapshot and simulation seed. Export your current state first if restoring an older backup with the same career ID.
5. To review roster imports, start from [src/reference/snapshot.json](src/reference/snapshot.json) and the schema in [src/data/schema.ts](src/data/schema.ts). Supply verified assignments, detailed positions and provenance only where your source supports them. Give changed snapshots a new ID. Import a complete version-1 snapshot, choose a club, and inspect the validated squad. Arbitrary CSV and raw provider API responses require an adapter first.

The [source audit](docs/data/source-extract.json) preserves exact extracted source lines, pinned URLs, retrieval dates and source-file checksums. CC0 licence copies are stored beside it in `docs/data/`. Local original assessments use a separate `touchline-local-editorial` provenance record and need rights review before redistribution.

## Verified build

On 15 October 2026, Linux x86-64 with Node 24.19.0 and Chromium 154 passed:

- Frozen-lockfile installation with `npm ci`, strict type checking, all 57 foundational tests and the production build.
- All four Playwright tests against both development and production servers: navigation, sorting/filtering, editorial role calculation, reload persistence, exact export/restore and invalid-import preservation.
- Keyboard navigation and modal focus, no horizontal overflow at 1280 and 800 pixels wide, and nine automated accessibility scans with no serious or critical findings on the tested surfaces.
- No uncaught browser errors or external gameplay requests in those workflows; `npm audit` reported no known dependency vulnerabilities at the time of the check.

See [the milestone review](docs/MILESTONE_1_REVIEW.md) for the review boundary and the remaining Mac check. These results do not establish Safari, macOS or Apple Silicon validation.

## Project documents

- [GAME_SPEC.md](GAME_SPEC.md) — the supplied master specification, preserved in full.
- [ARCHITECTURE.md](ARCHITECTURE.md) — implementation plan, layer boundaries, decisions and risks.
- [DATA_POLICY.md](DATA_POLICY.md) — source rights, provenance, unknown data and import rules.
- [ROADMAP.md](ROADMAP.md) — milestone boundaries and acceptance criteria.
- [AGENTS.md](AGENTS.md) — short standing coding rules.

For cloud setup, the official [Codex cloud environment documentation](https://developers.openai.com/codex/cloud/environments) explains environment installation and startup configuration. Use the task's existing isolated checkout rather than creating an additional worktree.
