# Architecture

## External (5 User-Facing Channels)

**1. CLI (`canicode analyze`)**
- Data source: Figma REST API (requires FIGMA_TOKEN) or JSON fixture
- Output: HTML report (opens in browser)
- Options: `--preset`, `--token`, `--output`, `--config`
- Also: `canicode save-fixture` to save Figma data as JSON for offline analysis
- Also: `canicode implement` to prepare a design-to-code package (analysis + design tree + assets + prompt)
- Component master resolution: fetches `componentDefinitions` for accurate component analysis
- Annotations: NOT available (REST API annotations field is private beta)

**2. MCP Server (`canicode-mcp`)**
- Install: `claude mcp add canicode -- npx -y -p canicode canicode-mcp`
- Tools: `analyze`, `list-rules`, `visual-compare`, `version`, `docs`
- Data source: Figma REST API via `input` param (Figma URL or fixture path). Requires FIGMA_TOKEN for live URLs.

**3. Claude Code Skill (`/canicode`)**
- Location: `.claude/skills/canicode/SKILL.md` (copy to any project)
- Uses CLI (`canicode analyze`) with FIGMA_TOKEN
- Lightweight alternative to MCP server — no canicode MCP installation needed

**4. Web App (GitHub Pages)**
- Source: `app/web/src/index.html`
- Build: `pnpm build:web` → `app/web/dist/` (deployed via GitHub Pages)
- Shared UI from `app/shared/` inlined at build time

**5. Figma Plugin**
- Source: `app/figma-plugin/src/`
- Build: `pnpm build:plugin` → `app/figma-plugin/dist/` (gitignored)
- Shared UI from `app/shared/` inlined at build time

## Internal (Claude Code Only)

Calibration commands are NOT exposed as CLI commands. They run exclusively inside Claude Code via subagents.

**`/calibrate-loop` (Claude Code command)**
- Role: Autonomous rule-config.ts improvement via fixture-based calibration
- Input: fixture directory path (e.g. `fixtures/material3-kit`)
- Flow: Analysis → Converter (HTML generation) → Measurements (html-postprocess + visual-compare + code-metrics) → Gap Analyzer → Evaluation → Critic → Arbitrator → Prune Evidence
- Converter implements the full scoped design as one HTML page + 6 stripped variants; orchestrator runs all measurements (visual-compare, code-metrics, responsive comparison)
- **Strip ablation**: Orchestrator measures 6 stripped design-trees (`DESIGN_TREE_INFO_TYPES` in `src/core/design-tree/strip.ts`: layout-direction-spacing, size-constraints, component-references, node-names-hierarchy, variable-references, style-references) → similarity delta vs baseline (plus tokens/HTML/CSS/responsive) → objective difficulty per rule category
- Gap Analyzer examines the diff image, categorizes pixel differences, saves to run directory
- Cross-run evidence: Evaluation appends overscored/underscored findings to `data/calibration-evidence.json`
- After Arbitrator applies changes, evidence for applied rules is pruned (`calibrate-prune-evidence`)
- Each run creates a self-contained directory: `logs/calibration/<fixture>--<timestamp>/`
- No API keys needed — works fully offline
- Auto-commits agreed score changes

**`/calibrate-night` (Claude Code command)**
- Role: Run calibration on multiple fixtures sequentially, then generate aggregate report
- Input: fixture directory path (e.g. `fixtures/my-designs`) — auto-discovers active fixtures
- Flow: `fixture-list` → sequential `/calibrate-loop` per fixture → `fixture-done` (converged) → `calibrate-gap-report` → `logs/calibration/REPORT.md`

## File Output Structure

```
data/calibration-evidence.json              # Cross-run calibration evidence (overscored/underscored rules)
reports/                                    # HTML reports (canicode analyze)
logs/calibration/                           # Calibration runs (internal)
logs/calibration/<name>--<timestamp>/       # One calibration run = one folder
  ├── analysis.json                         #   Rule analysis result
  ├── conversion.json                       #   HTML conversion + similarity + stripDeltas
  ├── stripped/                             #   Strip ablation outputs (6 types, see DESIGN_TREE_INFO_TYPES)
  │   ├── <type>.txt                        #   Stripped design-tree
  │   └── <type>.html                       #   HTML from stripped design-tree
  ├── gaps.json                             #   Pixel gap analysis
  ├── debate.json                           #   Critic + Arbitrator decisions
  ├── activity.jsonl                        #   Agent step-by-step timeline
  ├── summary.md                            #   Human-readable summary
  ├── output.html                           #   Generated HTML page
  ├── design-tree.txt                       #   Design tree (structure)
  ├── figma.png                             #   Figma screenshot
  ├── code.png                              #   Code rendering screenshot
  └── diff.png                              #   Pixel diff image
logs/calibration/REPORT.md                  # Cross-run aggregate report
logs/activity/                              # Nightly orchestration logs
```
