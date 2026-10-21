# Milestone 4 review — contracts and finances

The user authorized the first career-management slice after confirming demo club/player access on their Mac. The authorized work is contracts, renewals, weekly wages and fixed home-fixture income in the isolated generic development demo. It is not a full transfer, AI management or multi-season system.

**The conditional-wage follow-up has passed its recorded cloud checks and is ready for Mac review.** The user reported that the first contracts/finances build worked on their Mac, then identified its blanket wage-reduction refusal as unrealistic. That observation does not establish every financial workflow or a pass for the subsequent negotiation changes. This is not completion of all Milestone 4 systems.

## Review boundary

Every demo club uses original opening cash, wage commitments/budgets and home-fixture income. Those values are not real football finances. The model's transfer planning budget remains informational: offers, listings and valuations are unavailable. Current-squad acquisition remains deferred, and this slice does not open the ordinary real-data season gate.

The pure career core must replay accepted decisions without React, storage or ambient time/randomness. The complete football/financial timeline must restore together. Version-1 demo backups retain their original meaning; enabling finances on a legacy session is explicit and starts at its current date, without retroactive wages or home income. [CAREER_MANAGEMENT.md](CAREER_MANAGEMENT.md) documents the model and archive boundary.

## Mac review steps

1. Export the current demo backup, stop the old server and run `npm run dev:demo` from the updated project. Open the printed URL. Note browser/version when reporting results.
2. Start a new demo season, or restore a version-1 backup and use **Finances → Enable career management**. For legacy activation, confirm the starting date is the saved current date and earlier weeks/fixtures have not created backdated charges or credits.
3. Open **Squad**, select a player and inspect **Contract**. Confirm weekly wage, start, expiry and status are readable. Enter a lower **New weekly wage (£)**, later **New contract expiry** and initially zero **Guaranteed signing bonus (£)**. Read the offer assessment. A stable club with unknown player age should decline an uncompensated reduction, rather than reject all lower wages as a structural rule.
4. Supply at least the displayed compensation bonus, within available cash, and choose **Renew contract**. An accepted offer should update the wage/expiry and debit the bonus once. **Finances** should show the corresponding **Signing bonus**, **Signing bonuses paid** and total spending. A non-extended date, insufficient compensation or unaffordable offer must explain the refusal and preserve the saved figures and form draft.
5. Advance the calendar across a weekly payday and review **Managed club transaction history**. Inspect wage totals, cash change and accrual; opening/refreshing a screen must not pay wages twice.
6. Finish a managed home fixture and commit its complete round. Confirm the fixed home income posts once. Reopening the result or restoring the same checkpoint must not duplicate income.
7. **Export demo backup**, reload and **Import demo backup**. Confirm date, football progress, contract, balance and transaction history reconstruct together, including the signing bonus without a second debit. Export current progress before restoring an earlier checkpoint.
8. Try an invalid/incompatible import without discarding the valid backup. It must preserve the last valid session. Check keyboard focus and readable ledger/profile controls at the intended screen size.

These steps are acceptance work to perform, not a claim that every listed case has already been checked on a Mac. A successful first renewal or match alone does not establish a complete season of financial accounting.

## First-release verification evidence

The following results precede the negotiated-offer follow-up. They remain historical evidence and do not claim that the new policy or bonus accounting has passed the same checks.

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
| Subsequent user observation on the Mac | The user reported that the updated build worked, then encountered the blanket wage-cut refusal; no complete finance checklist was reported |

The career browser cases accepted a £1,200 weekly renewal, rejected a £90,000 offer exceeding the budget and preserved the valid checkpoint. A separate ledger case retained original £1,000 player wages: two £16,000 paydays and one £25,000 home receipt produced **£4,993,000** cash from £5 million opening cash. Reload and two fresh-browser imports reproduced the same archive/ledger without duplicate income. A progressed version-1 backup activated finances at its current date without backdated charges or changing the football state; future versions and forged balances/ledger were rejected.

The final 21 October regression rejects a next-fixture gap exceeding 3,653 days before a new version-2 start or legacy activation is persisted, while retaining legacy football-only advancement behavior. It does not change the accounting rules. The complete twelve-case demo browser result is dated 20 October; it is not presented as a fresh full rerun after that preflight addition. The 21 October production check is the targeted boundary case, not another complete ordinary-game browser run.

The production entry HTML SHA-256 is `05a1866fa382cc613e65bcf2fad2554f04512c7ee1cea75410fda677e7107184`, unchanged from the prior build. These checks establish the tested model and isolation boundaries, not a full season of financial behavior on a Mac, real wages, rights, player facts or verified current squads.

## Conditional-wage follow-up — 21 October 2026

The user's correction permits circumstantial reductions rather than unilateral cuts. New offers use `NEGOTIATE_CONTRACT` with `negotiationVersion: 1`; original `RENEW_CONTRACT` decisions and existing backups keep their earlier replay meaning. [The model document](CAREER_MANAGEMENT.md#contracts-and-renewals) records the exact thresholds, full-term bonus calculation and accounting.

Known age can support an original 10% concession from age 32 or 20% from age 35. Actual cash below thirteen weeks of current payroll can support 10%; the largest eligible concession applies without stacking, and requires at least 365 extra contract days. Unknown demo ages grant no age concession. A guaranteed signing bonus can compensate the remaining shortfall over the whole offered term, provided cash after the actual payment still funds a full proposed week's wages. A retained reference wage prevents successive offers compounding concessions. No manager-selected circumstance, guessed birthday or unimplemented performance bonus can bypass these checks.

| Follow-up check | Recorded result |
| --- | --- |
| TypeScript | 21 October: `npm run check` passed |
| Complete unit/integration suite | 21 October: all 257 tests across 26 files passed in 93.81 seconds |
| Pure negotiation policy and accounting | Nineteen focused career tests passed: ten existing and nine negotiated-offer cases, including known/unknown age, actual financial pressure, club parity, reference-wage anchoring and full-term compensation |
| Legacy replay and atomic bonus/import behavior | All four new negotiation-storage tests passed in 1.24 seconds, alongside the existing fifteen checkpoint/compatibility tests; five money/date helper tests passed |
| Production build and assets | Passed; 170 modules transformed without a chunk-size warning; production HTML SHA-256 and hashed asset references match the first release |
| Production isolation | Negotiation/demo markers absent from built assets; match/season engines, reference data and ordinary data/storage/main entry unchanged |
| Production boundary browser check | One targeted query-parameter/exclusion test passed in 2.8 seconds |
| Complete demo browser suite | All thirteen tests passed in 80.696 seconds: seven season/navigation, five earlier career and one new negotiated-offer workflow |
| Accessibility and layout | Eighteen axe scans found no serious/critical issues or page horizontal overflow at 1280/800 pixels |
| Browser storage/network observations | No uncaught page errors or external HTTP requests; only the demo database opened, including fresh-browser restoration |
| New negotiated-offer workflow on the user's Mac | Not yet reviewed |

The new browser workflow refused £900/week without compensation, then accepted the same lower wage with a funded £20,000 guaranteed signing bonus. From £5 million opening cash it recorded **£4,980,000** cash, **£15,900** weekly commitments and **£20,000** bonus/total spending. Reload and two fresh-browser imports preserved the same contract, archive and single bonus payment. These figures belong to that independent test scenario, not the earlier £4,993,000 payroll example.

A separate read-only audit exercised 200 offer combinations; all checks passed, including cash conservation and next-payday accounting for 116 accepted cases. These are synthetic model checks. Known-age concessions are covered by explicit-context core tests; the demo still has unknown ages and grants no age concession. The new browser result is a fresh complete demo run; the ordinary production result is the targeted boundary case, not another complete production-game browser run.

## Remaining work

Not included: transfer offers/listings/valuations/fees, automated AI-club negotiations or squad decisions, real financial evidence, contract releases that remove first-season players, injuries, development, recruitment, promotion/relegation, repeated new seasons or 2D matches. Database/provider research remains deferred under the user's existing instruction.
