# Touchline coding rules

- Read `GAME_SPEC.md`, `ARCHITECTURE.md`, `DATA_POLICY.md` and `ROADMAP.md` before changing behavior. Implement only the requested milestone. Milestone 2 is authorized: build the exhibition match foundation; season play, transfer AI and 2D animation remain outside scope.
- Keep simulation and domain code pure TypeScript, independent of React, browser APIs and persistence. Use explicit commands, deterministic state transitions and seeded randomness.
- Use strict types, validated boundaries and integer minor currency units. Never use `Math.random()` or wall-clock time inside deterministic transitions.
- Keep source database snapshots separate from career saves. Version imports and saves; validate before writing, preserve backups and reject unsupported versions safely.
- Use only appropriately sourced real identities in shipped data. Never guess current squads, invent player facts or import proprietary game ratings. Keep original game assessments separate from verified facts; unknown data stays unknown. Synthetic records belong only in clearly labelled tests.
- Exhibition teams are temporary coach selections, not verified club rosters. Any uniform comparison baseline requires explicit opt-in, fills only missing ratings, preserves known editorial values and its assessment mode, and never changes source snapshots or career saves. Initial condition and morale are scenario inputs, not medical facts.
- Derive match score, statistics and commentary from one authoritative event stream. Keep the initial config, accepted commands, seed and engine version replayable. Store exhibition sessions separately from careers; export each backup format explicitly.
- Keep hidden personality, development and potential data out of ordinary player-facing UI. Role scores must use documented weights and must not replace individual attributes.
- Keep gameplay local and credentials out of the client. Use semantic controls, visible keyboard focus, CSS Modules and shared design tokens.
- Preserve the current matte charcoal, navy gradient and silver skin, with Humanist 777 Black BT resolved locally. This newer presentation direction supersedes the original specification's green palette.
- Run `npm run check`, `npm test` and `npm run build` before calling a milestone complete. Match-engine changes also require the batch design-target report and browser match workflows. Add focused tests for domain or import behavior; report unverified platform claims honestly. Synthetic batch results are not empirical football calibration.
- Preserve existing user changes. Each cloud task already has an isolated checkout: use it and do not create a worktree unless the user explicitly requests one.
