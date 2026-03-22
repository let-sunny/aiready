// Shared constants used by both web app and Figma plugin UIs

const GAUGE_R = 54;
const GAUGE_C = Math.round(2 * Math.PI * GAUGE_R);

const CATEGORIES = [
  'layout',
  'token',
  'component',
  'naming',
  'ai-readability',
  'handoff-risk',
];

const CATEGORY_LABELS = {
  layout: 'Layout',
  token: 'Design Token',
  component: 'Component',
  naming: 'Naming',
  'ai-readability': 'AI Readability',
  'handoff-risk': 'Handoff Risk',
};

const CATEGORY_DESCRIPTIONS = {
  layout:
    'Auto Layout, responsive constraints, nesting depth, absolute positioning',
  token: 'Design token binding for colors, fonts, shadows, spacing grid',
  component: 'Component reuse, detached instances, variant coverage',
  naming: 'Semantic layer names, naming conventions, default names',
  'ai-readability':
    'Structure clarity for AI code generation, z-index, empty frames',
  'handoff-risk':
    'Hardcoded values, text truncation, image placeholders, dev status',
};

const SEVERITY_ORDER = ['blocking', 'risk', 'missing-info', 'suggestion'];

const SEVERITY_LABELS = {
  blocking: 'Blocking',
  risk: 'Risk',
  'missing-info': 'Missing Info',
  suggestion: 'Suggestion',
};
