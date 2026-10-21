# Career management — first slice

The user authorized Milestone 4 contracts and finances after reviewing the generic development demo's club/player access. This first slice extends that **development-only demo**. It does not supply real squads, real wages, real club accounts or a completed long-term career game. After trying the first release on their Mac, the user requested conditional wage reductions instead of its blanket refusal. The negotiated-offer follow-up has passed its recorded cloud checks and is ready for a separate Mac review. [MILESTONE_4_REVIEW.md](MILESTONE_4_REVIEW.md) records exact dates, evidence and limits.

## Scope and model inputs

The first slice covers player contracts, constrained renewals, weekly wage accounting and fixed income from completed home fixtures. The follow-up adds deterministic player responses to wage-reduction offers and funded guaranteed signing bonuses. All twenty clubs use the same rules; there is no automated AI club negotiator or special financial bonus for the human manager. Football remains on the existing match/season engine versions.

The demonstration starts with these original game figures per club:

| Item | Demonstration value |
| --- | --- |
| Opening cash | £5,000,000 |
| Transfer planning budget | £1,000,000 |
| Weekly wage budget | £80,000 |
| Initial weekly wage per player | £1,000 |
| Income per committed home fixture | £25,000 |

These are scenario settings for generic Demo Clubs and Demo Players, not claims about any real club or athlete. The transfer planning budget is informational: offers, listings, valuations, fees and transfers are not implemented. Condition, morale and player ability remain the existing explicit model inputs; a contract renewal does not alter them.

## Contracts and renewals

Contracts belong to the selected club/player and carry start/end dates and weekly wage. Expiry is inclusive: the stated end date remains a contract day. The demo's initial expiry is the later of two calendar years after activation and 365 days after the last scheduled fixture. Leap-day anniversaries clamp to the last valid day. Initial dates therefore cover the first simulated season; this slice does not release players or empty a roster on expiry.

A renewal must preserve the existing identity/club relationship and extend the old expiry to a date after today. It cannot precede the contract start. The new expiry cannot exceed five calendar years after the current financial date, with leap-day clamping. The whole club's proposed active weekly bill must fit its wage budget, and cash after any guaranteed signing bonus must cover that bill once. Renewing an expired contract starts new accrual today without charging the already processed gap. A rejected request preserves the last accepted state, including wages already earned.

The original `RENEW_CONTRACT` command retains its no-wage-reduction rule for replay compatibility. New UI offers use negotiation policy version 1 instead: a lower wage needs the player's modelled agreement, not a manager-selected reason. These are transparent original game rules, not empirical estimates of real players' willingness:

| Circumstance | Maximum uncompensated reduction |
| --- | --- |
| Known age 32–34 | 10% |
| Known age 35 or older | 20% |
| Actual cash below thirteen weeks of the club's current active wage bill | 10% |
| Unknown age and no financial pressure | 0% |

The largest eligible percentage applies; percentages do not stack. An uncompensated concession also requires at least 365 days added to the existing expiry. Financial pressure uses the real pre-offer cash and wage bill, so offering a bonus cannot create its own eligibility. Age comes only from explicit trusted context. The demo has no birth dates and passes `birthDate: null`; it grants no age concession and does not invent a biography.

The reference wage is the current agreed wage or, after an accepted negotiated offer, the retained highest reference wage. Repeated offers cannot compound a ten-percent concession into successive automatic cuts. A later wage increase raises that reference. Derived contract metadata records the reference and accepted-negotiation sequence; initial configuration and backup fields cannot supply them directly.

The weekly floor is `ceil(referenceWeeklyWageMinor × (100 − concessionPercent) / 100)`. For a reduction below that floor, a guaranteed signing bonus must cover the remaining shortfall over the **whole offered term**, including today and the new expiry:

```text
requiredBonusMinor = ceil(max(0, weeklyFloorMinor − offeredWeeklyWageMinor)
                          × inclusiveOfferedContractDays / 7)
```

The calculation uses integer `BigInt` intermediates and rounds up to a penny. Keeping or increasing the current wage needs no compensation bonus. An accepted bonus is paid immediately from club cash and recorded as spending; the club must still retain one full proposed week's wages. A bonus is not an unsupported checkbox or a promise of future performance payments. Performance, appearance and agent fees remain unimplemented. A valid offer receives an explicit acceptance or refusal explanation; malformed inputs fail validation without changing the saved contract.

Only the managed club receives user renewal controls. Other clubs remain subject to the same model invariants; no automated negotiation or squad management is added. Transfers, injuries, player development, suspensions, new-season recruitment and repeated-season progression remain later work.

## Pure API and accounting

`src/simulation/career/index.ts` exports career finance engine version 1 and pure functions without React, persistence, random draws or ambient time:

- `parseCareerFinanceConfig` and `createCareerFinances` validate explicit clubs/contracts and construct ledger state.
- `advanceCareerFinances(state, toDate)` accrues active contracts and posts due wages.
- `renewCareerContract(state, renewal)` retains the original eligible, non-reducing renewal behavior for earlier decisions.
- `assessCareerContractOffer(state, offer, context)` returns a version-1 response, explanation, eligible concession and required guaranteed bonus without writing state.
- `negotiateCareerContract(state, offer, context)` applies an accepted offer and its actual signing-bonus payment together.
- `recordCareerMatchdayIncome(state, receipt)` credits one configured home-fixture receipt.
- `getClubFinancialSummary` derives cash, commitment, budget headroom, accrued wages and income/spending.

Config contains an engine version, financial start date, clubs and contracts. Club/player IDs must be unique, contracts must reference a configured club, opening transfer budget cannot exceed opening cash, and initial active wages must fit the wage budget. Initial contract starts cannot be later than financial activation; expired initial contracts are allowed, but future signings cannot bypass the opening budget check. State uses GBP, start/current/next-pay dates, club accounts, contracts, ledger and processed-fixture IDs. Money is integer minor units: £1 is 100 pence. No floating-point currency totals are accumulated.

For exact daily accrual, each club has `accruedWageNumerator` in **sevenths of a penny**. Each eligible contract day adds its full `weeklyWageMinor` to that numerator. On payday:

```text
paymentMinor = floor(accruedWageNumerator / 7)
accruedWageNumerator = accruedWageNumerator % 7
balanceMinor -= paymentMinor
```

The remainder is carried, preventing fractional-penny loss. Displayed accrued wages use the whole-penny floor; fractional carry survives replay. Seven active days at £1,000/week accrue exactly 100,000 pence. A mid-period renewal retains the old earned numerator and changes only later daily additions.

Paydays are every seven days, anchored to financial activation, with the first at `startDate + 7`. Advance processes **[old date, new date)**: a renewal accepted today applies when that day is subsequently accrued. Contract start/end are inclusive, so the final contract day accrues when advancing beyond it. Repeating the same date adds nothing; backwards movement is rejected. One financial advance is bounded to 3,653 days and safe integer/date ranges are enforced.

Wage and guaranteed signing-bonus entries are debits; home income is a credit. Cash equals opening balance plus recorded income minus wage payments and signing bonuses. `totalSpendingMinor` includes both kinds of debit, while `totalBonusesMinor` reports the bonus portion separately. Paying a bonus does not alter earlier earned wages, rounding carry or the payday schedule. Wages can take cash negative; there is no automatic loan, cash injection, insolvency or rescue mechanism. The one-week cash check applies to accepted offers after the bonus, not a promise that future wages stop before overdrawing cash. Transfer planning budget is not deducted from or reserved against cash.

The demo coordinator first accepts a football/calendar command, then advances finance to its resulting date and credits newly committed home fixtures. Only complete round results trigger receipts: an unfinished/abandoned fixture or uncommitted staged result earns no income. A fixture ID cannot receive duplicate credit; conflicting repeated receipts fail. Every home club receives the configured amount under the same rules. Browsing, replay and reload reconstruct transactions rather than adding new ones.

## UI review

In **Squad**, open a player profile and its **Contract** section. It shows weekly wage, contract start, expiry and status. The form uses **New weekly wage (£)**, **New contract expiry**, **Guaranteed signing bonus (£)** and **Renew contract**. A live assessment explains the player's response, the actual financial-pressure context and the bonus needed for a proposed reduction. It identifies age as unknown in the demo. Unsupported requests must explain the constraint without changing an accepted contract; a failed offer retains its draft.

**Finances** opens **Club finances**, including cash, weekly commitments, the wage budget, transfer-planning status and **Managed club transaction history**. Ledger entries distinguish **Wage payment**, **Home match income** and **Signing bonus**; **Signing bonuses paid** also reports the total. Navigate the calendar to observe wage posting; finish and commit a home fixture to observe its income. An accepted nonzero bonus posts once with its player/negotiation sequence, so same-day offers have unique entries. A zero bonus creates no cash movement. Merely opening a screen must not create transactions.

## Legacy and export boundary

New demo seasons use archive version 2 with career engine version 1. Existing `touchline-season-demo` version-1 backups retain their original football-only interpretation and restore without an automatic upgrade. A legacy session has `finances: null` until the user selects **Enable career management**.

Explicit activation begins at the saved current date and command boundary. It does not charge past wages or credit earlier committed home fixtures. Earlier football commands remain part of the same replayable history; new financial and football decisions follow the recorded activation point. An old backup is not silently reinterpreted under a new money model.

Before a new career-enabled start or explicit legacy activation is persisted, the demo preflights the next scheduled matchday. A gap exceeding **3,653 days** from the current date is rejected, so activation cannot save a timeline whose next calendar jump exceeds the financial advance bound. Legacy football-only advancement retains its existing behavior. Normal weekly fixtures are unaffected.

Version 1 retains its eight original fields and football command interpretation:

```text
format, schemaVersion, engineVersion, matchEngineVersion,
id, updatedAt, scenario, commands
```

Version 2 adds `careerEngineVersion: 1` and `careerStartCommandIndex`. The football scenario remains version 1. `commands` accepts existing season decisions and the original renewal command, plus the explicitly versioned negotiated offer:

```text
{ type: 'RENEW_CONTRACT', playerId, weeklyWageMinor, endDate }
{ type: 'NEGOTIATE_CONTRACT', negotiationVersion: 1, playerId,
  weeklyWageMinor, endDate, signingBonusMinor }
```

The coordinator supplies the managed club; an offer cannot target another club's player. New seasons activate at command index 0. A legacy upgrade preserves earlier football commands and activates after that prefix. Replay reconstructs the prefix without finance, creates the model accounts on that current date, then processes the remaining mixed history. Either contract command before activation is invalid. Same-ID version-2 imports cannot silently move the activation point. Existing accepted renewal commands keep their prior meaning; the new command's policy version prevents a silent reinterpretation. A build without negotiated-offer support cannot read backups containing that command.

Contracts, balances, accrued numerators, receipts and ledger are derived runtime state, not trusted archive fields. Imports replay the versioned factory and commands; future default/accounting changes must preserve explicit career-engine compatibility rather than reinterpret old backups. Limits remain 16 MiB and 5,000 decisions. Extra derived fields, unsupported versions and malformed inputs are rejected.

Use **Export demo backup** before clearing browser data, updating the downloaded code or restoring an earlier checkpoint. **Import demo backup** must reject incompatible, malformed or inconsistent records without changing the last valid session. An explicit valid version-1 import can roll back to an earlier football-only checkpoint with no finances; ordinary loading never makes that change. Stale-tab decisions and failed writes must preserve both timelines together.

The repository retains the separate `touchline-season-demo` database's version-1 checkpoint table; portable archive version 2 needs no table migration. Cold loads/imports fully replay. Normal decisions apply once from a private verified cache, compare the expected command history/full checkpoint and recheck it in a write transaction. Stale exports fail rather than silently refreshing an unchanged UI.

This stays in the development entry launched with `npm run dev:demo`. The normal production entry, real-data source gate, career/season exports and independent exhibition archives are unchanged. Demo transactions never become factual real-world finances or migrate into a later real-data career.
