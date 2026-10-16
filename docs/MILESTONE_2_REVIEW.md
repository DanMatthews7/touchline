# Milestone 2 review

The user authorized the attribute-driven match foundation on 16 October 2026 after reviewing the earlier interface, font and skin. This milestone covers standalone exhibition matches only. The original [Milestone 1 review](MILESTONE_1_REVIEW.md) remains a historical record; it is not evidence for the new engine.

## Reviewable behavior

The Matchday workspace assembles Home and Away coach selections from sourced real names. The separate 32-player archival identity pool includes five goalkeepers and retains exact-source provenance. It does not supply current club rosters, citizenship, detailed outfield familiarity or player ability. Selecting a club for the shell does not assign its real-world squad to an exhibition side. Default selections have 14 players per team: an XI and three substitutes, including a reserve goalkeeper.

Every match requires complete numerical game attributes. Unknown ratings stay unknown unless the user explicitly accepts **Use uniform 10/20 exhibition estimates** for missing values. Known editorial ratings are preserved, and the assessment mode remains in configuration and exports. This is a temporary original scenario, not factual player ability. Source snapshots and the career are unchanged. Initial condition and morale are scenario inputs.

A seeded pure TypeScript model advances a 90-minute match through 15-minute decision checkpoints. Passes, tackles, chances, shots, saves, fouls, cards and condition loss respond to attributes, roles, familiarity, tactics and explicit home effects. Coaches can change formation/instructions and make eligible substitutions at checkpoints. One authoritative stream supplies score, statistics and commentary. [MATCH_ENGINE.md](MATCH_ENGINE.md) documents formulas and simplifications.

The engine permits five substitutions in three in-play windows; this UI supplies three substitutes, so only those three can enter. Multiple changes at the same checkpoint share a window. Minute 0 and half-time are free windows, but players still count toward the limit. Dismissed players cannot be replaced. When a side is reduced, formation switching is disabled in the current controls while instructions and individual slot assignments remain available, including an emergency goalkeeper.

Match sessions are stored separately from careers. Portable match files contain initial configuration and accepted decisions; import replays through engine version 1 and validates before writing. Reload and restore must reproduce the event stream and assessment label. Existing career saves keep their version-1 format and exclude exhibition sessions, so use **Export match** for an exhibition backup.

## Manual review on the Mac

1. Run the new branch using the README's ZIP/Terminal instructions. Confirm the approved font/skin and that existing careers remain usable at the same browser origin.
2. Open Matchday and inspect the distinction between temporary selections and verified rosters. Without complete ratings or accepted baseline, confirm the interface explains the prerequisite.
3. Accept the labelled comparison model or supply complete assessments. Choose formations/instructions and **Prepare exhibition match**, then advance to a checkpoint. Compare score/statistics with events and inspect condition/discipline.
4. Open Home or Away touchline controls, change tactics and make a substitution. Continue to full time; a dismissed player must remain off. Review trade-offs rather than expecting one instruction to guarantee wins.
5. Export the match, reload and restore it. Confirm the same checkpoint, score, events, decisions and assessment mode. Export current progress before restoring an older file with the same ID.
6. Export and restore a career separately. Invalid match imports must show an error without changing career data or the last valid match. Check keyboard focus, dense tables and controls in the intended Mac browser.

The earlier font/skin review does not establish that this workflow has run on macOS, Safari or Apple Silicon. Record the actual browser and observations when that review happens.

## Verification evidence

Verified on 16 October 2026 in the Linux cloud environment:

| Check | Recorded result |
| --- | --- |
| `npm run check` | Passed |
| `npm run build` | Passed; 152 modules transformed |
| Production browser workflows | All 9 tests passed in 37.2 seconds against static preview on port 4173 |
| Served production assets | The served JavaScript bundle matched the built `dist` asset by hash |
| Accessibility scans | 15 axe scans: 9 foundation and 6 match surfaces; no serious or critical findings |
| Tested layouts | 1280 × 800 and 800 × 800; no page horizontal overflow |
| Keyboard workflows | Baseline opt-in and existing navigation/dialog checks passed |
| Runtime and network observations | No uncaught browser errors or external HTTP requests in the tested workflows |
| `npm test` | 131 tests across 14 files passed in 79.40 seconds |
| Batch coverage inside the test run | 6,400 matches: 400 in each of 16 scenarios; all 14 design targets passed |
| Standalone synthetic batch report | 7,680 matches: 480 in each of 16 scenarios; all 14 design targets passed |
| New Matchday workflow on macOS/M2 | Not yet reviewed |

The browser checks use the final production build, not a development-only implementation. They cover the existing foundation alongside match decisions, displayed events/statistics, reload and portable archives. These observations establish only the tested surfaces and workflows; they do not establish universal accessibility or Mac compatibility.

The committed [engine-version-1 batch report](calibration/milestone-2-engine-v1.json) retains all 480 explicit spread seeds, source indices 1729–2208, scenario inputs, sample sizes, design targets, observed estimates and uncertainty. Selected results from that report:

| Synthetic scenario | Observed result |
| --- | --- |
| Equal baseline sides with home advantage 0.04 | 3.21 total goals per match; mean 95% interval 3.05–3.37; 95.42% of matches had 0–6 goals |
| Moderate skill 13 versus 11, balanced orientations at neutral venues | Stronger side won 58.54%; seed-block 95% interval 55.88–61.21% |
| Skill 15 versus 9, balanced orientations at neutral venues | Stronger side won 88.65%; seed-block 95% interval 86.66–90.63% |
| Home advantage 0.04 compared with the neutral scenario | Home model expected-goal margin increased by 0.297; paired 95% interval 0.269–0.326 |
| Three fresh minute-60 substitutes versus the condition-55 scenario | Final active outfield condition increased 16.53 points; late model expected-goal margin increased 0.162, paired 95% interval 0.140–0.185 |

All four formation scenarios passed their predeclared benefit and cost targets. Baseline draws were 21.67%, mean fouls 20.39, yellow cards 2.35 and red dismissals 0.248; no baseline matches were abandoned in this 480-match sample. These are observations of the configured model, not claims that those rates match a real competition.

Synthetic scenarios assess internal behavior, not empirical football calibration. Their intervals quantify these model batches and comparisons, not predictive accuracy for real matches. A passing report does not validate real-player ratings. The moderate and large skill-gap results, tactical constants and discipline rates remain design choices for review before broader gameplay.

## CI portability follow-up — 16 October 2026

The reported GitHub Actions run passed all 131 unit tests but failed a later step. Review found a browser-test defect: creating `/workspace/artifacts` assumes this cloud environment's filesystem and can fail with `EACCES` on a hosted runner. An unprivileged protected-parent check reproduced that permission failure. The original private run log was unavailable here, so its exact failure remains unconfirmed.

Both review screenshots now use Playwright's per-test output paths. Browser checks start the production preview, retain failure traces and generate an HTML report. The workflow uploads reports and test output, uses Node 24-compatible actions and selects Ubuntu 24.04 explicitly.

The repair passed TypeScript checking, all 131 tests across 14 files (82.13 seconds), the production build and all nine browser tests (41.8 seconds). The browser run used `CI=true`, a fresh preview server and the available Chromium 154; both screenshots appeared under `test-results/` and the HTML report was generated. This environment could not download Playwright's pinned Chromium 156 or read the private Actions log, so the hosted rerun still needs confirmation. Application and simulation behavior are unchanged.

## Boundary after review

Not included: current-season roster completion, empirically calibrated ability, competition/season play, career progression, transfers/AI management, injuries, detailed set pieces, offsides, penalties, added time, extra time, shootouts or 2D matches. The next proposed milestone is scheduling, league tables and calendar integration after this foundation is reviewed and specifically authorized.
