// Shared utility functions used by both web app and Figma plugin UIs

function escapeHtml(text) {
  var el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}

function gaugeColor(pct) {
  if (pct >= 75) return '#22c55e';
  if (pct >= 50) return '#f59e0b';
  return '#ef4444';
}

function scoreClass(pct) {
  if (pct >= 75) return 'green';
  if (pct >= 50) return 'amber';
  return 'red';
}

function severityDotClass(sev) {
  var map = {
    blocking: 'dot-blocking',
    risk: 'dot-risk',
    'missing-info': 'dot-missing',
    suggestion: 'dot-suggestion',
  };
  return map[sev] || 'dot-missing';
}

function severityScoreClass(sev) {
  var map = {
    blocking: 'score-blocking',
    risk: 'score-risk',
    'missing-info': 'score-missing',
    suggestion: 'score-suggestion',
  };
  return map[sev] || 'score-missing';
}

function toggleSection(el) {
  el.parentElement.classList.toggle('collapsed');
}

function toggleIssue(el) {
  el.parentElement.classList.toggle('open');
}
