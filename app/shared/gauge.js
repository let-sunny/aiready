// Shared gauge SVG rendering used by both web app and Figma plugin UIs
// Depends on: constants.js (GAUGE_R, GAUGE_C), utils.js (gaugeColor, escapeHtml)

function renderGaugeSvg(pct, size, strokeW, grade) {
  var offset = GAUGE_C * (1 - pct / 100);
  var color = gaugeColor(pct);
  var fontSize = grade ? 48 : 28;
  var label = grade || pct;
  var labelY = grade ? 60 : 62;
  return (
    '<svg width="' + size + '" height="' + size +
    '" viewBox="0 0 120 120" class="gauge-svg">' +
    '<circle cx="60" cy="60" r="' + GAUGE_R +
    '" fill="none" stroke-width="' + strokeW + '" stroke="#e4e4e7"/>' +
    '<circle cx="60" cy="60" r="' + GAUGE_R +
    '" fill="none" stroke="' + color +
    '" stroke-width="' + strokeW +
    '" stroke-linecap="round" stroke-dasharray="' + GAUGE_C +
    '" stroke-dashoffset="' + offset +
    '" transform="rotate(-90 60 60)" class="gauge-fill"/>' +
    '<text x="60" y="' + labelY +
    '" text-anchor="middle" dominant-baseline="central"' +
    ' fill="currentColor" font-size="' + fontSize +
    '" font-weight="700"' +
    ' font-family="Inter,-apple-system,sans-serif">' +
    (grade ? escapeHtml(grade) : pct) +
    '</text></svg>'
  );
}
