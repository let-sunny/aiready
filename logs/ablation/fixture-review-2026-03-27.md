# Design Tree Review Report

> 24 fixtures analyzed | Simple Design System (Figma Community)
> Date: 2026-03-27

## What works well

### 1. Layout information is comprehensive
Every auto-layout frame has complete CSS-ready properties: `display: flex`, `flex-direction`, `gap`, `padding`, `justify-content`, `align-items`. This is the strongest part of the design-tree — AI can directly copy these values.

### 2. Text content is inline
Text nodes include the actual text: `text: "Products"`. No need to cross-reference a separate content file.

### 3. Component annotations provide context
`[component: State=Active]`, `[component: Platform=Desktop]` — AI knows what variant it's looking at.

### 4. Hierarchy is clear
Indentation perfectly represents parent-child relationships. No ambiguity about nesting.

### 5. Colors are CSS-ready
`color: #1E1E1E`, `background: #F5F5F5` — direct hex values, no conversion needed.

## What's missing or could be better

### 1. No shadow information (0 across all 24 fixtures)
Not a single `box-shadow` in any design tree. Figma's `effects` (drop shadows, inner shadows) are not being converted. This means AI will never add shadows even when the design has them.

**Impact**: Cards, buttons, and elevated elements will look flat.

### 2. No opacity information (0 across all fixtures)
`opacity` is never output. Semi-transparent overlays, disabled states, hover effects — all invisible to AI.

### 3. No overflow/truncation info (0 across all fixtures)
`overflow`, `text-overflow`, `ellipsis` — never output. Even when Figma has `clipsContent: true` or `textAutoResize` settings, these don't appear in the design tree.

**Impact**: Long text will overflow instead of truncating. Scrollable areas won't clip.

### 4. No min/max constraints (0 across all fixtures)
`min-width`, `max-width`, `min-height`, `max-height` — never output despite being available in Figma data (`minWidth`, `maxWidth` properties).

**Impact**: Responsive behavior is lost. Elements can't adapt to different viewports properly.

### 5. ~50-60% of SVG vectors fail to download
Across all fixtures, roughly half of VECTOR nodes don't have SVG data. Figma API returns null for some vector export URLs (likely complex boolean operations or nested vectors).

| Fixture | Total vectors | SVGs loaded | Missing |
|---|---|---|---|
| desktop-product-detail | 25 | 9 | 16 (64%) |
| desktop-landing-page | 12 | 2 | 10 (83%) |
| desktop-pricing | 11 | 1 | 10 (91%) |
| mobile-product-detail | 26 | 14 | 12 (46%) |

**Impact**: Many icons will be missing. AI has to guess what the icon looks like.

### 6. All SVG names are "icon", "icon-2", "icon-3"...
The human-readable naming improvement works, but Figma's actual VECTOR node names are all "Icon" — so they all become `icon.svg`, `icon-2.svg`, etc. Not very descriptive.

**Wish**: Figma had a way to name vectors descriptively, or we could infer purpose from parent component name (e.g., "chevron-down.svg" from parent "Dropdown" component).

### 7. No hover/transition/animation info
20 `State=` annotations exist (Active, Default, Logged Out, etc.) but no CSS hover/transition. The design tree shows _what_ the active state looks like, but not _how_ to get there.

**Impact**: Buttons won't have hover effects. Tabs won't have active transitions.

### 8. Font is always "Inter" — no design token reference
Every text uses `font-family: "Inter"` as raw value. Even if the Figma file uses text styles, the design tree outputs the resolved font name, not the style reference.

**Impact**: AI can't create `var(--font-body)` variables because it doesn't know which texts share a style.

### 9. Colors are raw hex — no token grouping
8 unique colors across pricing page (`#1E1E1E`, `#2C2C2C`, `#757575`, `#D9D9D9`, `#E3E3E3`, `#F5F5F5`, `#FFFFFF`, `#767676`) but no indication of which colors are the same "role" (e.g., primary text, secondary text, border).

**Impact**: AI uses inline hex everywhere instead of CSS variables. Changes require find-and-replace across the entire file.

## What Figma doesn't provide (can't fix)

### 1. No hover/focus state CSS
Figma components have variants (State=Hover, State=Pressed) but these are separate frames, not CSS transitions. There's no way to know "on hover, change background from #F5F5F5 to #E3E3E3" from the Figma data.

### 2. No responsive breakpoints
Figma doesn't have a concept of CSS media queries. Desktop and mobile are separate components. We save them as separate fixtures, but there's no mapping between "desktop Hero" and "mobile Hero".

### 3. No z-index
Figma uses layer order for stacking, but doesn't expose z-index values. The design tree relies on DOM order.

## Recommendations for design-tree improvements

| Priority | Improvement | Effort | Impact |
|---|---|---|---|
| **High** | Add shadow output (effects → box-shadow) | Low — data exists in Figma JSON | Cards/buttons look flat without |
| **High** | Add overflow/clip output (clipsContent → overflow: hidden) | Low — data exists | Text overflow, scrollable areas |
| **High** | Add min/max width/height | Low — data exists | Responsive behavior |
| **Medium** | Add opacity | Low — data exists | Disabled states, overlays |
| **Medium** | Group repeated colors into CSS variables | Medium — needs heuristic | Better code maintainability |
| **Medium** | Infer SVG names from parent component | Medium | More descriptive file names |
| **Low** | Map text styles to CSS variables | High — needs style reference tracking | Token system in output |
| **Low** | Add transition hints from variant pairs | High — needs cross-variant analysis | Hover/active effects |
