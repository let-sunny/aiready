# Design Readiness Checker

A CLI tool that analyzes Figma design structures to provide development-friendliness and AI-friendliness scores and reports.

## Tech Stack

- **Runtime**: Node.js (>=18)
- **Language**: TypeScript (strict mode)
- **Package Manager**: pnpm
- **Validation**: zod
- **Testing**: vitest
- **CLI**: cac
- **Build**: tsup

## Project Structure

```
src/
├── core/           # Analysis engine and core logic
├── rules/          # Analysis rule definitions
├── contracts/      # Type definitions and Zod schemas
├── cli/            # CLI entry point
├── report-html/    # HTML report generation
├── adapters/       # External service integrations (Figma API, etc.)
└── agents/         # Calibration pipeline (analysis, conversion, evaluation, tuning)
```

## Architecture

### Commands

**`drc analyze`**
- Role: Analyze Figma file structure + generate report (user-facing)
- Input: Figma URL or JSON fixture
- Output: HTML report in `reports/`
- No code generation — pure structural analysis only
- Each issue includes a Figma deep link (click → navigate to node in Figma)

**`drc calibrate-run`**
- Role: Automated rule score improvement (internal dev tool, not user-facing)
- Input: Figma URL
- Pipeline:
  1. Analysis Agent: collect issues and scores
  2. Conversion Agent: generate code for nodes via Claude API
  3. Evaluation Agent: compare conversion difficulty vs rule scores
  4. Tuning Agent: propose score adjustments
- Output: analysis results in `logs/calibration/`

**`drc calibrate-run --export-report`** (planned, not yet implemented)
- Role: Export calibration results as a user-facing HTML report
- Output: HTML report in `reports/`
- Content: Figma original screenshot + Claude implementation screenshot side by side

**`/calibrate-loop` (Claude Code command)**
- Role: Autonomous rule-config.ts improvement via 3-agent debate
- Flow: Runner → Critic → Arbitrator
- Auto-commits agreed score changes
- Full debate transcript logged to `logs/activity/`

### File Output Structure

```
reports/            # HTML reports (analyze + calibrate export)
logs/calibration/   # Calibration analysis results
logs/activity/      # Agent activity logs
```

## Dev Commands

```bash
pnpm build          # Production build
pnpm dev            # Development mode (watch)
pnpm test           # Run tests (watch)
pnpm test:run       # Run tests (single run)
pnpm lint           # Type check
```

## Conventions

### Language

- All code, comments, and documentation must be written in English
- This is a global project targeting international users

### Code Style

- Use ESM modules (`import`/`export`)
- Use `.js` extension for relative imports
- Use `@/*` path alias to reference `src/`

### TypeScript

- strict mode enabled
- `noUncheckedIndexedAccess` enabled - must check for undefined when accessing arrays/objects
- `exactOptionalPropertyTypes` enabled - no explicit undefined assignment to optional properties

### Zod

- Validate all external inputs with Zod schemas
- Schema definitions go in `contracts/` directory
- Infer TypeScript types from schemas: `z.infer<typeof Schema>`

### Testing

- Test files are co-located with source files as `*.test.ts`
- describe/it/expect are globally available (vitest globals)

### Naming

- Files: kebab-case (`my-component.ts`)
- Types/Interfaces: PascalCase (`MyInterface`)
- Functions/Variables: camelCase (`myFunction`)
- Constants: SCREAMING_SNAKE_CASE (`MY_CONSTANT`)

### Git

- Commit messages: conventional commits (feat, fix, docs, refactor, test, chore)

## Severity Levels

Rules are classified into 4 severity levels:

- **blocking**: Cannot implement correctly without fixing. Direct impact on screen reproduction.
- **risk**: Implementable now but will break or increase cost later.
- **missing-info**: Information is absent, forcing developers to guess.
- **suggestion**: Not immediately problematic, but improves systemization.

## Score Calibration

Rule scores started as intuition-based estimates. The calibration pipeline validates them against actual code conversion difficulty.

Process:
1. Run analysis on real Figma files (`drc calibrate-analyze`)
2. Convert flagged nodes to code via Claude API (Conversion Agent)
3. Compare conversion difficulty vs rule scores (Evaluation Agent)
4. Propose adjustments: overscored rules get reduced, underscored rules get increased (Tuning Agent)
5. 3-agent debate loop (`/calibrate-loop`) applies conservative changes automatically

Final score adjustments in `rule-config.ts` are always reviewed by the developer via `CALIBRATION_REPORT.md` or the calibrate-loop's Arbitrator decisions.

## Adjustable Rule Config

All rule scores, severity, and thresholds are managed in `rules/rule-config.ts`.
Rule logic and score config are intentionally separated so scores can be tuned without touching rule logic.

Configurable thresholds:
- `gridBase` (default: 8) — spacing grid unit for inconsistent-spacing and magic-number-spacing
- `tolerance` (default: 10) — color difference tolerance for multiple-fill-colors
- `no-dev-status` — disabled by default