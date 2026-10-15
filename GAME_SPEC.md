# TOUCHLINE — Master Development Specification v0.3

## Project objective

Build **Touchline**, an original single-player football management game inspired by the depth, pace and usability of early-2000s Championship Manager and Football Manager.

The game must combine authentic modern footballers and clubs, comprehensive player attributes, tactical management, transfers, scouting and career progression.

It should feel nostalgic but not outdated.

The objective is a genuinely playable, expandable football management game, not simply an attractive interface prototype.

## 1. Platform and technology

Target platform: Apple Silicon MacBook Pro M2, running modern macOS through a web browser.

Use:

- React and TypeScript
- Vite
- CSS Modules with centralised design tokens
- Pure TypeScript football simulation engine
- IndexedDB and Dexie for local persistence
- Vitest for automated testing
- Git for source control

Initially develop as a local-first, single-player application.

No backend, user accounts, AI API calls during gameplay, subscriptions or online dependency should be required to play an installed local build.

Ensure the architecture permits future hosting, additional databases and possible desktop packaging.

## 2. Fundamental architectural requirements

Separate the application into:

**Presentation:** navigation, tables, player screens, tactics, fixtures, matchday and other UI components.

**Simulation:** match calculations, player development, fatigue, tactical effects, transfers, AI decisions and calendar progression.

**Domain and persistence:** clubs, players, competitions, finances, career state and saved games.

The simulation engine must not depend on React or browser-specific APIs.

Use typed domain models, explicit commands and state transitions, with a reproducible seeded random-number generator.

Simulation results must be reproducible from the same initial state, seed and commands.

Keep the starting database separate from career saves.

Version all database snapshots and save formats. Support safe migrations, backup exports and validation on import.

Store currency values in integer minor units to avoid floating-point accounting errors.

## 3. Real-world player database

Target the 2026/27 season, initially concentrating on English football.

The game must support genuine player names, club identities, positions, ages, nationalities and available career information.

Do not create fictional players to fill gaps in the playable real-world database.

Do not invent current squad assignments or portray guessed facts as verified.

Create a provider-independent data import and validation pipeline.

Store:

- Stable internal identifiers
- External source identifiers
- Source URLs and attribution
- Source and snapshot dates
- Applicable data licences and usage restrictions
- Validation and completeness status

Separate verified biographical and statistical information from original game-generated attributes.

Keep external API credentials out of client-side code.

Do not copy Football Manager databases, proprietary player ratings, artwork, trademarks or protected interface elements.

For the first development milestone, a small, appropriately sourced real-player dataset is acceptable. A complete Premier League database is a later milestone.

If suitable data rights or source access cannot be established, document the blocker and implement the importer without silently substituting invented players. Synthetic records are acceptable only inside clearly identified automated tests.

## 4. Player attributes

Use comprehensive individual player attributes rated from 1–20.

### Technical
Corners, Crossing, Dribbling, Finishing, First Touch, Free Kicks, Heading, Long Shots, Long Throws, Marking, Passing, Penalties, Tackling, Technique.

### Mental
Aggression, Anticipation, Bravery, Composure, Concentration, Decisions, Determination, Flair, Leadership, Off the Ball, Positioning, Teamwork, Vision, Work Rate.

### Physical
Acceleration, Agility, Balance, Jumping Reach, Natural Fitness, Pace, Stamina, Strength.

### Goalkeeping
Aerial Reach, Command of Area, Communication, Handling, Kicking, One-on-Ones, Reflexes, Rushing Out, Throwing.

Use this as the initial attribute vocabulary, subject to removing redundancies where justified.

Players must also support preferred positions, preferred foot, personality-related hidden attributes, current development level and potential.

A player's individual attributes must directly influence relevant football actions.

Provide an optional derived positional or role suitability rating on a 1–100 scale.

Derived ratings must be calculated using documented, position-specific weighting rules. They must never replace the individual attributes as the foundation of the simulation.

Do not automatically expose hidden potential or every hidden attribute to the player.

Build a transparent, configurable calibration system for translating suitable real-world evidence into game attributes.

Where the evidence is weak, document uncertainty and support manual editorial overrides. Do not assume that statistical performance uniquely determines mental ability, technique or future potential.

## 5. Tactics

Support classic formations including:

- 4-4-2
- 4-3-3
- 4-2-3-1
- 4-1-4-1
- 3-5-2

Provide starting XI, substitutes, positional assignments and appropriate player roles.

Initial team instructions should include mentality, tempo, width, pressing intensity and defensive line.

Each tactical setting must have defined simulation consequences.

Player suitability must depend on individual attributes, role requirements, positional familiarity and physical condition.

Formation changes should produce measurable advantages and trade-offs rather than guaranteed improvements.

The tactical system must be expandable without requiring a rewrite of the match engine.

## 6. Match simulation

Use an event-driven football simulation.

Simulate meaningful phases including possession, chance creation, passing, tackling, shooting, saves, fouls and fatigue.

Results should depend on player attributes, team tactics, fitness, morale, opposition strength, home advantage and controlled randomness.

Generate match events and statistics from a single authoritative simulation.

Do not separately fabricate scores, commentary and visual match events.

The engine must support substitutions and tactical changes at suitable checkpoints.

Start with a match event log, basic statistics and text commentary.

Build a visual 2D match presentation only after the underlying engine has been tested and calibrated.

Create automated batch simulations to assess goal distributions, home advantage, relative team strength, discipline, substitutions and tactical sensitivity.

## 7. Management and career systems

Design domain models capable of supporting:

- Transfers and offers
- Contracts and wages
- Club finances
- Scouting
- Fitness and injuries
- Suspensions
- Player development and decline
- Youth recruitment
- AI club squad management
- Promotions, relegations and new seasons
- Long-term career histories

Implement these incrementally.

AI clubs must obey the same financial, contractual and squad rules as the human-managed club.

Do not use undocumented bonuses or secretly manipulate match outcomes to increase difficulty.

Aim for a game world capable of remaining logically consistent over at least ten simulated seasons.

## 8. Interface and experience

Create an original retro-modern football management aesthetic inspired by early-2000s desktop software.

Use deep greens, muted accents, compact sortable data tables, restrained visual decoration and highly readable typography.

Player attributes and management information should be visually prominent.

Avoid oversized cards, excessive whitespace, unnecessary animations and generic mobile-app styling.

Primary navigation should make it easy to move between:

Dashboard, Inbox, Squad, Player Profiles, Tactics, Fixtures, Competitions, Transfers and Finances.

Design desktop-first for a MacBook Pro, including practical use at approximately 1280 × 800 resolution.

Support accessible contrast, visible keyboard focus, semantic controls and predictable navigation.

Do not recreate copyrighted game screens or assets pixel-for-pixel.

## 9. Quality, performance and security

Use strict TypeScript typing and modular, testable code.

Write tests for:

- Player and club data integrity
- Unique identifiers and club assignments
- Attribute range validation
- Positional rating calculations
- Fixture scheduling
- Deterministic match simulations
- League table calculations
- Save/export/import round-trips
- Version compatibility and migration errors
- Financial and squad invariants

A 20-team double round-robin competition must generate 380 matches, with each club playing 38 fixtures: 19 home and 19 away.

Run type checks, automated tests and production builds before marking a milestone complete.

No unvalidated external imports, exposed API keys or hidden external network dependencies.

Preserve existing working functionality when implementing new features.

## 10. Development process

Create and maintain these project documents:

- GAME_SPEC.md
- ARCHITECTURE.md
- DATA_POLICY.md
- ROADMAP.md
- AGENTS.md
- README.md

Use AGENTS.md for short permanent coding rules. Keep detailed game requirements in the other documents.

Break development into small, independently testable milestones.

Do not implement an entire football management game in a single unreviewed coding task.

Maintain a working local build and version-control checkpoints.

Document major architectural decisions, incomplete features and known limitations.

## 11. Initial development milestone

The first objective is a working application foundation, not the finished game.

Deliver:

1. Running React/TypeScript application.
2. Original retro-modern application shell.
3. Club-selection interface.
4. Reusable player profile and attribute components.
5. Sortable squad management interface.
6. Typed player, club, tactics, competition and game-state models.
7. Data-import schema, validation and provenance records.
8. Versioned persistence and save/export infrastructure.
9. Deterministic simulation interfaces, without an advanced match engine.
10. Automated foundational tests and developer documentation.

Use appropriately sourced real data where permitted and available. Do not disguise synthetic test data as genuine players.

### Acceptance criteria

- Application runs locally on macOS.
- Core screens navigate correctly.
- Attribute displays and calculated role ratings work.
- Imported player records pass validation.
- No API credentials are exposed.
- Saves can be exported and restored.
- Tests and production build pass.
- The codebase is prepared for an attribute-driven match engine.

## 12. Your immediate assignment

First, review this specification and produce a concise implementation plan.

Identify major dependencies, data licensing blockers, architectural risks and any contradictory requirements.

Create the repository documentation and standing coding instructions.

Then implement only the first development milestone.

Do not proceed into advanced simulation, transfer AI or 2D animation until the foundation has been reviewed.

At completion, explain what works, what remains incomplete, how to run the project locally and which milestone should follow next.

Do not claim that a feature works unless it has been implemented and verified.