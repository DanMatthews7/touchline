# Milestone 1 review

The application foundation is implemented and verified in the cloud. Review it before starting an attribute-driven match engine. The master requirements are preserved in `GAME_SPEC.md`; architecture choices and risks are in `ARCHITECTURE.md`.

## What can be reviewed

Choose one of four sourced English club identities and open the dashboard, inbox, reference directory and player profiles. Sort and filter the directory, review all 45 attributes and inspect the provenance attached to each player. Navigation destinations for later systems explain their planned scope without generating fixtures, results, transfers or fictional budgets.

The source database contains 12 authentic player identities from pinned CC0 Openfootball records. Current club assignments, citizenship and detailed outfield positions have not been inferred. Empty managed squads and unknown attributes are intentional data limitations. A provider-independent JSON importer accepts complete validated version-1 snapshots with appropriately sourced details.

The profile editor records user-authored original game assessments, with confidence and a rationale, independently of biography. Assessment notes remain inspectable. A new immutable database revision preserves the original reference. Hidden personality and potential never appear as editable or visible player ratings. Position-specific role weights and the 1–100 formula are documented; missing inputs keep the score unavailable.

Dexie stores immutable starting snapshots separately from career state. Exported saves contain both, retain the seed and validate before atomic restoration. Old or future formats without a supported migration fail explicitly. Restoring a matching career ID replaces that local career, so export a backup before restoring an earlier state. There is no automatic career-backup history in version 1.

## Evidence

Validated on 15 October 2026 with Node 24.19.0 and Chromium 154 on Linux:

| Check | Result |
| --- | --- |
| `npm ci` using the committed lockfile | Passed |
| `npm run check` | Passed |
| `npm test` | 57 tests passed across 8 files |
| `npm run build` | Passed |
| Playwright on development server | 4 tests passed |
| Playwright on production preview | 4 tests passed |
| Manual GK test calculation | Expected role score 74; persisted and restored exactly |
| Invalid JSON/version/reference imports | Rejected; original career preserved |
| Keyboard and modal focus | Passed |
| Tested layouts | 1280 × 800 and 800-pixel width; no page overflow |
| Accessibility | 9 axe scans; no serious/critical violations on tested surfaces |
| Runtime and network observations | No uncaught errors or external gameplay requests in browser tests |
| Dependency audit | No known vulnerabilities reported at check time |

The automated goalkeeper estimates are explicitly test inputs, not claims about the real player's ability. No synthetic players or arbitrary ratings ship in the reference database.

## Mac acceptance and next step

This cloud machine cannot run the user's Mac or establish Safari/M2 compatibility. On the Mac, use the Node version in `.nvmrc`, then run `npm ci`, `npm run check`, `npm test`, `npm run build` and `npm run preview` from the checkout. Open the printed local address and follow the README review walkthrough. Confirm text density, keyboard behavior, downloads, IndexedDB reload and restore in the intended browser.

Review the interface, import/source policy, domain model and attribute methodology first. The next coding milestone is the pure event-driven match foundation with authoritative events and a batch calibration harness; roster coverage and assessment evidence remain separate data work. No advanced simulation, transfer AI or 2D match animation has been started.
