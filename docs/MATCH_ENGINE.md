# Match engine version 1

Milestone 2 is a standalone exhibition foundation: attribute-driven football actions emit one authoritative event stream and pause for management decisions. It does not advance a competition or career. The constants below are original game-design choices, not real-player ability assessments or empirical league calibration.

## Boundaries and API

The pure TypeScript core is `src/simulation/match/`. It uses domain types and the seeded generator, with no React, browser APIs, persistence, wall-clock time or ambient randomness.

- `parseMatchConfig` / `validateMatchConfig` check runtime data and football relationships.
- `createMatch(config)` creates state and a seeded kickoff event.
- `applyMatchCommand(state, command)` returns next state or an explicit failure preserving input state.
- `replayMatch(config, commands)` reconstructs a match; invalid commands fail replay.
- `getMatchSummary` and `commentaryForEvent` derive score, statistics and text from events.

`MatchConfig` contains engine version, match ID, unsigned 32-bit seed, assessment mode, Home/Away teams and explicit home advantage. Each team supplies its players, XI, bench, formation and all five instructions. Players carry all 45 attributes, known positions or an empty array, and starting condition/morale from 0 to 100. Every attribute must be an integer 1–20; the engine never imputes null values.

Before kickoff each side needs 11 unique starters, exactly one nominated goalkeeper and formation-compatible positions/roles. Teams have at most nine substitutes and 11–20 total players. The XI and bench must exactly match the supplied player list; IDs are unique across both teams. Starters need positive condition. Invalid fields, IDs, relationships, roles, versions or incomplete ratings fail before simulation.

Assessment mode is `recorded-attributes` or `uniform-missing-10`. It describes input preparation and does not alter physics. Comparison mode requires explicit acceptance, fills only missing attributes with 10, preserves known ratings and never changes source records or careers. It does not create verified positional familiarity.

## Time, randomness and commands

A match lasts 90 model minutes. `ADVANCE` runs to the next 15-minute checkpoint; six advances reach full time unless abandoned. Each minute contains eight action phases followed by condition loss: 720 phases in a full match. This is an event model, not continuous spatial ball simulation. There is no added time or extra time.

The persisted xorshift32 state changes only through explicit draws. Zero seeds map deterministically to a nonzero state. Kickoff, participant selection and outcomes consume draws in engine order. Reproduction requires the same initial configuration, engine version, seed and accepted commands. Tactical changes can change later draw paths as well as probabilities; a paired seed does not guarantee identical match situations.

Commands are `ADVANCE`, `SUBSTITUTE` and `CHANGE_TACTICS`. Changes are accepted at checkpoints, including minute 0; ended matches reject commands. Tactical commands preserve active player IDs and valid positions/roles. After a dismissal, the chosen formation can have gaps; changing tactics still requires one nominated goalkeeper.

Each side can make five substitutions in three in-play windows. Multiple changes at the same checkpoint share a window; minutes 0 and 45 are free windows but still count toward five players. Incoming players must be unused eligible substitutes with positive condition. Dismissed players cannot be replaced; players who leave cannot return. Fewer than seven active players abandons the match without inventing a forfeit score. The current UI supplies three bench players per side even though the engine supports nine.

## Effective action skill

For an action, calculate its weighted attribute mean. Compress the normalised scale with an explicit competence floor, then apply the other factors:

```text
actionCompetence = 0.25 + 0.75 × actionWeightedMean / 20
roleFit     = 0.85 + 0.15 × roleWeightedMean / 20
condition   = 0.45 + 0.55 × currentCondition / 100
morale      = 0.85 + 0.30 × currentMorale / 100
home        = 1 + configuredHomeAdvantage for Home; 1 for Away
effectiveSkill = actionCompetence × roleFit × condition × morale × home × familiarity
```

The same 0.25 competence floor applies to both sides before condition and other factors. This original modelling choice limits the compounding of extreme talent differences across possession, creation, shooting and saving contests; it is not an imputed source attribute. Home advantage is explicit, bounded 0–0.20, and affects efficiency rather than awarding goals. Morale remains at its starting value; score changes do not secretly manipulate it.

| Action | Attribute weights |
| --- | --- |
| Passing | Passing 5; First Touch 2; Decisions 3; Teamwork 2; Technique 1 |
| Creation | Vision 4; Dribbling 3; Passing 3; Crossing 2; Off the Ball 3; Technique 2; Flair 1 |
| Shooting | Finishing 5; Composure 4; Technique 2; Anticipation 2; Heading 1; Balance 1 |
| Defending | Tackling 5; Marking 3; Positioning 4; Anticipation 3; Concentration 2; Strength 2; Pace 1 |
| Goalkeeping | Reflexes 5; Handling 3; One-on-Ones 3; Aerial Reach 2; Command of Area 2; Positioning 2; Agility 2 |

Role weights are `ROLE_DEFINITIONS`, documented in [ARCHITECTURE.md](../ARCHITECTURE.md). The engine uses the raw weighted mean, not the rounded 1–100 profile score.

Matching known positions have familiarity 1. Unknown positions use 0.85, an explicit uncertainty assumption. Adjacent families receive 0.90: RB/LB, CB/DM, DM/CM/AM, RM/LM/RW/LW and AM/ST. Other outfield mismatches receive 0.72. Known goalkeeper/outfield cross-assignments receive 0.45. A lineup choice is not a newly verified position.

Outfield team passing, creation and defense metrics are position-weighted means. Creation weights are ST 6, RW/LW/AM 4, RM/LM/CM 1.4, DM 0.6 and other outfield positions 0.3. Defense weights are CB/DM 4, RB/LB/CM 3 and other outfield positions 1. Passing/control weights DM/CM/AM twice other outfield players. Creation/control also multiply by `activePlayers / 11`; defense multiplies by its square root. These manpower factors include the goalkeeper in the active-player count.

## Tactics and formations

Attack, control and defense start at 1; relevant deltas add to those metrics. Passing, pressing and space-behind deltas enter probabilities. Fatigue and foul factors multiply rates. No setting guarantees an improved result.

| Instruction | Setting | Defined effects |
| --- | --- | --- |
| Mentality | Defensive / balanced / attacking | Attack −0.16 / 0 / +0.16; control −0.02 / 0 / +0.02; defense +0.13 / 0 / −0.13 |
| Tempo | Slow / standard / fast | Passing +0.045 / 0 / −0.045; attack −0.08 / 0 / +0.10; fatigue ×0.88 / ×1 / ×1.18 |
| Width | Narrow / standard / wide | Passing +0.025 / 0 / −0.025; attack −0.025 / 0 / +0.055; defense +0.025 / 0 / −0.045 |
| Pressing | Low / standard / high | Press −0.07 / 0 / +0.08; control −0.045 / 0 / +0.045; fatigue ×0.80 / ×1 / ×1.30; fouls ×0.76 / ×1 / ×1.40 |
| Defensive line | Deep / standard / high | Defense +0.045 / 0 / −0.025; control −0.045 / 0 / +0.06; attack −0.025 / 0 / +0.025; space behind −0.06 / 0 / +0.10 |

| Formation | Attack | Control | Defense | Width emphasis |
| --- | --- | --- | --- | --- |
| 4-4-2 | +0.02 | −0.04 | +0.02 | 0 |
| 4-3-3 | +0.08 | −0.02 | −0.06 | +0.08 |
| 4-2-3-1 | +0.02 | +0.04 | −0.06 | +0.03 |
| 4-1-4-1 | −0.10 | +0.04 | +0.06 | +0.02 |
| 3-5-2 | +0.02 | +0.08 | −0.10 | −0.08 |

Formation width difference produces `1 + max(0, attackingWidth − defendingWidth)` as a chance-creation factor. Personnel, roles and familiarity matter when changing shape.

## Action resolution

`clamp(x, a, b)` bounds x. All draws below are seeded. Let `A` be attacking team creation and `D` defending team defense; individual skills use the previous formulas.

1. An 11% midfield-contest opportunity chooses possession in proportion to team passing/control metrics. Emit `POSSESSION`. Select participants using position weights: attackers more often from attacking positions, defenders from defensive positions, central players more often for passes.
2. Before passing, foul probability is `0.028 × pressingFoulFactor × (0.80 + aggression/40) × (1.1 − decisions/100) × caution`. For a booked player, `caution = 0.72 + 0.20×(1−decisions/20)`; otherwise it is 1. A foul emits discipline events. An 11% follow-up opportunity produces a simplified set-piece chance, without a detailed restart model.
3. Pass completion: `clamp(0.78 + 0.20×(passSkill−0.45) − 0.10×(defendSkill−0.45) + passingDelta − opposingPress×0.4, 0.36, 0.94)`. A failed pass changes possession; no tackle is invented.
4. After a completed pass, a separate 12% tackle opportunity uses win probability `clamp(0.26 + 0.42×(defendSkill−recipientCreationSkill) + opposingPress − (booked ? 0.025 : 0), 0.08, 0.65)`. A win changes possession. Booked-player caution therefore trades fewer fouls for a small challenge cost, rather than making bookings beneficial without cost.
5. Chance creation: `clamp(0.034 × (0.60 + 0.60×A/(D+0.15)) × widthMismatchFactor, 0.008, 0.105)`.

For a generated shot:

```text
Q = clamp(0.10 + U×0.18 + 0.20×(creatorCreationSkill−D)
          + opposingSpaceBehind×shooterPace/20
          + (attackFactor−1)×0.035
          − (simplifiedSetPiece ? 0.025 : 0), 0.035, 0.55)
onTargetP = clamp(0.35 + 0.24×(shootingSkill−0.45) + Q×0.30, 0.16, 0.76)
goalGivenTargetP = clamp(0.205 + Q×0.55
                        + 0.30×(shootingSkill−keeperSkill)
                        + 0.04×(A−D), 0.06, 0.78)
modelExpectedGoals = onTargetP × goalGivenTargetP
```

`U` is a uniform draw. An on-target shot scores or produces a save from the same probability; every shot ends possession. Without a current goalkeeper slot, the first active player is an emergency keeper with another 0.45 factor until a coach nominates a goalkeeper at a checkpoint.

## Discipline and condition

After a foul, straight-red probability is `0.002 + aggression/20 × 0.002`. Otherwise a separate draw tests yellow probability `0.075 + aggression/20 × 0.075 + (1−decisions/20) × 0.015`. A second yellow dismisses the player. Dismissals immediately reduce manpower; there is no difficulty-dependent outcome adjustment.

Each active player's minute condition loss is:

```text
(0.105 + 0.13×(1−stamina/20) + 0.015×workRate/20 − 0.015×naturalFitness/20)
× tempoFatigue × pressingFatigue × (goalkeeper ? 0.4 : 1)
```

Condition floors at zero. Bench players retain configured condition until entering. There is no recovery, injury, interval morale update or persistent effect on career fitness.

## Events, projections and archives

Events include kickoff, possession, passes, tackles, chances, shots, saves, goals, fouls, cards, fatigue, substitutions, tactics changes, checkpoints, full time and abandonment. IDs follow append order. Score counts goals; statistics count the same events; commentary translates events with contextual names. No independent score, commentary or visual outcome is generated.

Possession counts phases, not clock time. Expected goals sums pre-outcome model shot probabilities, not externally calibrated xG. Yellow totals include second-yellow events; red totals include straight and second-yellow dismissals. Abandoned matches retain only events actually produced.

The separate `touchline-match` version-1 archive stores engine version, ID, update timestamp, initial config and accepted commands. It omits derived events, score, statistics and random state: import validates and replays before storage. Dexie database `touchline-match-sessions` is separate from the unchanged version-1 career database. Career exports exclude exhibitions. Export a match explicitly to back it up. Unsupported schema/engine versions fail without silent migration. Limits are 16 MiB and 1,000 commands.

## Batch design targets

`npm run calibrate -- --output calibration-report.json` runs deterministic synthetic fixtures from `src/simulation/__tests__/`; these are not imported by application UI. There are 16 scenarios and 14 acceptance outcomes. The default is 480 matches per scenario, 7,680 total. Options are `--matches 400..1000`, `--seed-start UINT32` and `--output path`. Without `--output`, JSON is printed. A missed target returns exit code 1; invalid invocation returns 2.

`--seed-start` is the first source index, default 1729. Seeds are spread by the bijection `Math.imul(seedStart + index, 0x9e3779b1) >>> 0`; they are not consecutive raw RNG seeds. Odd multiplication permutes unsigned 32-bit values and avoids adjacent source indices remaining adjacent RNG states. Every scenario reuses the same explicit seed vector, stored in the report with the algorithm and source-index range. The permitted source-index range cannot overflow uint32.

Scenarios cover equal teams, neutral venue, skill 15 versus 9 and moderate skill 13 versus 11 in both orientations, reduced condition, low/high stamina, low/high pressing, all five formations and fresh minute-60 substitutes. Fixtures use original action ratings 12, aggression 10, stamina/natural fitness 12, initial morale 70 and condition 100 unless explicitly varied. Fixture outfield players know all outfield positions, isolating formation effects from familiarity. These synthetic inputs are distinct from the real-identity workspace's unknowns.

Reports include goal histograms, outcomes, shots, model expected goals, possession, discipline, condition and paired differences. Mean intervals use a normal approximation; per-scenario outcome rates use Wilson estimates. Strength comparisons average Home/Away orientations within each seed block before calculating uncertainty, rather than treating the two correlated matches as independent. Other comparisons use per-seed paired differences. Intervals describe the synthetic model batches, not prediction intervals for actual football.

Design targets include mean goals 2–4.5 with at least 85% of games at 0–6 goals; both sides able to win and draws 10–40%; bounded discipline; measurable configured home effect; strong and moderate synthetic ability advantages; stamina/condition affecting performance; pressing trading control for fouls/condition; and fresh substitutes improving late condition and expected-goal margin. Formation targets require both a predeclared benefit and cost, with paired lower 95% bounds above zero:

| Shape compared with 4-4-2 | Benefit | Cost |
| --- | --- | --- |
| 4-3-3 | More own expected goals | More opponent expected goals |
| 4-2-3-1 | More possession | More opponent expected goals |
| 4-1-4-1 | Fewer opponent expected goals | Fewer own expected goals |
| 3-5-2 | More possession | More opponent expected goals |

Formation targets also require a meaningful own/opponent/total action or possession change and nontrivial win/loss rates. Exact thresholds and observed estimates are exported in every report. The committed [version-1 report](calibration/milestone-2-engine-v1.json) records the 480-per-scenario run; [MILESTONE_2_REVIEW.md](MILESTONE_2_REVIEW.md) summarises observed results and their limits.

## Deliberate limits

Not implemented: verified current squads or calibrated player ability, continuous spatial play, detailed set pieces, offsides, penalties, injuries, added time, extra time, shootouts, season fixtures, career progression, transfer AI or 2D animation. Several attributes are reserved for later action models; validating the full vocabulary does not mean every attribute already has a distinct mechanism. Constants need further review before treating the model as mature football simulation. Preserve engine-version compatibility when changing behavior so archives cannot silently replay under different rules.
