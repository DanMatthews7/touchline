# Milestone 4 review — contracts and finances

The user authorized the first career-management slice after confirming demo club/player access on their Mac. The authorized work is contracts, renewals, weekly wages and fixed home-fixture income in the isolated generic development demo. It is not a full transfer, AI management or multi-season system.

**The first contracts/finances slice has passed the recorded cloud checks and is ready for Mac review.** Earlier Mac checks cover the demo season loop and club/player navigation; they do not establish this new financial workflow. This is not completion of all Milestone 4 systems.

## Review boundary

Every demo club uses original opening cash, wage commitments/budgets and home-fixture income. Those values are not real football finances. The model's transfer planning budget remains informational: offers, listings and valuations are unavailable. Current-squad acquisition remains deferred, and this slice does not open the ordinary real-data season gate.

The pure career core must replay accepted decisions without React, storage or ambient time/randomness. The complete football/financial timeline must restore together. Version-1 demo backups retain their original meaning; enabling finances on a legacy session is explicit and starts at its current date, without retroactive wages or home income. [CAREER_MANAGEMENT.md](CAREER_MANAGEMENT.md) documents the model and archive boundary.

## Mac review steps

1. Export the current demo backup, stop the old server and run `npm run dev:demo` from the updated project. Open the printed URL. Note browser/version when reporting results.
2. Start a new demo season, or restore a version-1 backup and use **Finances → Enable career management**. For legacy activation, confirm the starting date is the saved current date and earlier weeks/fixtures have not created backdated charges or credits.
3. Open **Squad**, select a player and inspect **Contract**. Confirm weekly wage, start, expiry and status are readable. Under **New weekly wage (£)** and **New contract expiry**, enter a permitted higher wage and later expiry, then choose **Renew contract**.
4. Open **Finances**. Confirm weekly commitment reflects the accepted contract and the transfer section clearly describes planned functionality. A lower wage, non-extended date or unaffordable renewal should show a useful error and preserve the current figures.
5. Advance the calendar across a weekly payday and review **Managed club transaction history**. Inspect wage totals, cash change and accrual; opening/refreshing a screen must not pay wages twice.
6. Finish a managed home fixture and commit its complete round. Confirm the fixed home income posts once. Reopening the result or restoring the same checkpoint must not duplicate income.
7. **Export demo backup**, reload and **Import demo backup**. Confirm date, football progress, contract, balance and transaction history reconstruct together. Export current progress before restoring an earlier checkpoint.
8. Try an invalid/incompatible import without discarding the valid backup. It must preserve the last valid session. Check keyboard focus and readable ledger/profile controls at the intended screen size.

These steps are acceptance work to perform, not a claim that every listed case has already been checked on a Mac. A successful first renewal or match alone does not establish a complete season of financial accounting.

## Verification evidence

| Check | Recorded result |
| --- | --- |
| TypeScript | 21 October: `npm run check` passed |
| Complete unit/integration suite | 21 October: all 243 tests across 24 files passed in 80.51 seconds, including the final date-preflight regression |
| Demo checkpoint/compatibility coverage | The final suite includes seven career-storage and eight legacy demo-storage tests: fifteen in total |
| Production build | 21 October: passed; 170 modules transformed, no chunk-size warning |
| Production boundary browser check | 21 October: one targeted query-parameter/exclusion test passed in 3.7 seconds |
| Production assets and source boundaries | 21 October: production HTML and hashed asset references match the prior Milestone 3 build; demo/finance markers are absent; match/season engines, reference data and normal data/storage/main entry have no changes |
| Dedicated demo browser suite | 20 October: all twelve tests passed in 86.45 seconds, comprising five career cases and seven earlier season/navigation cases |
| Accessibility and layout | 20 October: eighteen axe scans, no serious/critical findings or page horizontal overflow at 1280/800 pixels |
| Storage/network observations | 20 October: only the demo database opened; no uncaught page errors or external HTTP requests in the tested workflows |
| New career-management workflow on the user's Mac | Not yet reviewed |

The career browser cases accepted a £1,200 weekly renewal, rejected a £90,000 offer exceeding the budget and preserved the valid checkpoint. A separate ledger case retained original £1,000 player wages: two £16,000 paydays and one £25,000 home receipt produced **£4,993,000** cash from £5 million opening cash. Reload and two fresh-browser imports reproduced the same archive/ledger without duplicate income. A progressed version-1 backup activated finances at its current date without backdated charges or changing the football state; future versions and forged balances/ledger were rejected.

The final 21 October regression rejects a next-fixture gap exceeding 3,653 days before a new version-2 start or legacy activation is persisted, while retaining legacy football-only advancement behavior. It does not change the accounting rules. The complete twelve-case demo browser result is dated 20 October; it is not presented as a fresh full rerun after that preflight addition. The 21 October production check is the targeted boundary case, not another complete ordinary-game browser run.

The production entry HTML SHA-256 is `05a1866fa382cc613e65bcf2fad2554f04512c7ee1cea75410fda677e7107184`, unchanged from the prior build. These checks establish the tested model and isolation boundaries, not a full season of financial behavior on a Mac, real wages, rights, player facts or verified current squads.

## Remaining work

Not included: transfer offers/listings/valuations/fees, AI negotiation or squad decisions, real financial evidence, contract releases that remove first-season players, injuries, development, recruitment, promotion/relegation, repeated new seasons or 2D matches. Database/provider research remains deferred under the user's existing instruction.
