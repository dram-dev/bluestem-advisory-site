/* Item 57 — the assessment score as a root system.
 *
 * One drawing, two homes: the result page on the public site (this file is
 * copied there verbatim by scripts/build-assessment.js and runs in the browser)
 * and the write-up email (Rootbook renders the same SVG to PNG with resvg and
 * attaches it inline). So: no dependencies, no DOM, plain ES5-ish, one function
 * in and one SVG string out. UMD-lite at the bottom.
 *
 * The metaphor is the firm's own: two-thirds of a bluestem plant is underground.
 * The taproot reaches down as far as the score does; ten lateral roots — one per
 * question — reach out as far as that answer earned. Three strata mark the bands.
 *
 * scoreSvg({ score, max, answers, labels, bands, theme, title })
 *   answers  per-question points, in question order (0..3 each); optional
 *   labels   short label per question, same order; optional
 *   bands    [{label, min}] highest first; optional (defaults to the v3 bands)
 *   theme    'dark' (the site) | 'light' (email)
 */
(function (root) {
  'use strict';

  var W = 640, H = 460;
  var SURFACE = 78;          // y of the soil line
  var FLOOR = 412;           // y of the deepest point
  var CX = 300;              // taproot x
  var DEPTH = FLOOR - SURFACE;

  var THEMES = {
    dark:  { bg: 'none', ink: '#EDEAD9', muted: 'rgba(237,234,217,.55)', faint: 'rgba(237,234,217,.18)',
             soil: ['rgba(205,190,147,.05)', 'rgba(205,190,147,.09)', 'rgba(205,190,147,.14)'],
             root: '#CDBE93', tip: '#B85D2E', zero: 'rgba(237,234,217,.35)', font: "Georgia,'Literata',serif", ui: "'Karla',Helvetica,Arial,sans-serif" },
    light: { bg: '#F7F5EE', ink: '#232A20', muted: 'rgba(35,42,32,.6)', faint: 'rgba(35,42,32,.16)',
             soil: ['rgba(33,39,30,.035)', 'rgba(33,39,30,.07)', 'rgba(33,39,30,.11)'],
             root: '#8A7A4A', tip: '#A14E24', zero: 'rgba(35,42,32,.35)', font: "Georgia,serif", ui: "Helvetica,Arial,sans-serif" }
  };
  var DEFAULT_BANDS = [{ label: 'Rooted', min: 23 }, { label: 'Taking hold', min: 13 }, { label: 'Still underground', min: 0 }];
  var DEFAULT_LABELS = ['Why', 'Owner', '90 days', 'Measures', 'Direction', 'Facts', 'Heard', 'Declined', 'Members', 'People'];

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function bandFor(score, bands) { for (var i = 0; i < bands.length; i++) if (score >= bands[i].min) return bands[i]; return bands[bands.length - 1]; }

  function scoreSvg(opts) {
    opts = opts || {};
    var max = Number(opts.max) || 30;
    var score = Math.max(0, Math.min(max, Number(opts.score) || 0));
    var answers = Array.isArray(opts.answers) ? opts.answers.slice(0, 10) : [];
    var labels = Array.isArray(opts.labels) && opts.labels.length ? opts.labels : DEFAULT_LABELS;
    var bands = Array.isArray(opts.bands) && opts.bands.length ? opts.bands : DEFAULT_BANDS;
    var t = THEMES[opts.theme === 'light' ? 'light' : 'dark'];
    var per = answers.length ? Math.max(1, max / answers.length) : 3;   // points per question
    var band = bandFor(score, bands);
    var out = [];
    var animate = !!opts.animate;

    out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc('Score ' + score + ' of ' + max + ' — ' + band.label) + '" font-family="' + esc(t.font) + '">');
    if (t.bg !== 'none') out.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + t.bg + '"/>');

    // Strata: from the surface down, lowest band on top (shallow) to the highest band at depth.
    var ordered = bands.slice().sort(function (a, b) { return a.min - b.min; });   // shallowest first
    for (var i = 0; i < ordered.length; i++) {
      var y0 = SURFACE + DEPTH * (ordered[i].min / max);
      var y1 = i + 1 < ordered.length ? SURFACE + DEPTH * (ordered[i + 1].min / max) : FLOOR + 22;
      out.push('<rect x="0" y="' + r1(y0) + '" width="' + W + '" height="' + r1(y1 - y0) + '" fill="' + t.soil[Math.min(i, 2)] + '"/>');
      if (i > 0) out.push('<line x1="0" y1="' + r1(y0) + '" x2="' + W + '" y2="' + r1(y0) + '" stroke="' + t.faint + '" stroke-width="1" stroke-dasharray="3 5"/>');
      var on = ordered[i].label === band.label;
      out.push('<text x="' + (W - 18) + '" y="' + r1(y0 + 18) + '" text-anchor="end" font-family="' + esc(t.ui) + '" font-size="11" letter-spacing="1.6" fill="' + (on ? t.ink : t.muted) + '" font-weight="' + (on ? '700' : '400') + '">' + esc(ordered[i].label.toUpperCase()) + '</text>');
    }
    // Surface line and its label.
    out.push('<line x1="0" y1="' + SURFACE + '" x2="' + W + '" y2="' + SURFACE + '" stroke="' + t.ink + '" stroke-width="1.2" opacity=".7"/>');
    out.push('<text x="18" y="' + (SURFACE - 12) + '" font-family="' + esc(t.ui) + '" font-size="11" letter-spacing="1.6" fill="' + t.muted + '">SURFACE</text>');

    // The taproot: as deep as the score. Minimum stub so zero still reads as a plant.
    var tapLen = Math.max(18, DEPTH * (score / max));
    var tapEnd = SURFACE + tapLen;
    var tapPath = 'M' + CX + ' ' + SURFACE + ' C ' + (CX + 6) + ' ' + r1(SURFACE + tapLen * 0.35) + ', ' + (CX - 5) + ' ' + r1(SURFACE + tapLen * 0.7) + ', ' + (CX + 2) + ' ' + r1(tapEnd);
    var dash = animate ? ' stroke-dasharray="' + r1(tapLen * 1.15) + '" stroke-dashoffset="' + r1(tapLen * 1.15) + '" class="sv-draw"' : '';
    out.push('<path d="' + tapPath + '" fill="none" stroke="' + t.root + '" stroke-width="3.2" stroke-linecap="round"' + dash + '/>');
    // A heavier crown near the surface, so the root tapers rather than being a wire.
    out.push('<path d="M' + CX + ' ' + SURFACE + ' L ' + r1(CX + 2) + ' ' + r1(SURFACE + tapLen * 0.4) + '" fill="none" stroke="' + t.root + '" stroke-width="5" stroke-linecap="round" opacity=".7"' + (animate ? ' class="sv-fade"' : '') + '/>');
    // A warm tip where the root ends.
    out.push('<circle cx="' + (CX + 2) + '" cy="' + r1(tapEnd) + '" r="4" fill="' + t.tip + '"' + (animate ? ' class="sv-pop"' : '') + '/>');

    // Lateral roots — one per question, five a side. Each reaches OUT as far as
    // its answer earned; its end sits on a fixed rung down the side, so ten labels
    // never collide however short the plant is. The rungs tighten a little for a
    // shallow plant, so a low score still reads as one root ball, not a ladder.
    var n = answers.length;
    var perSide = Math.ceil(n / 2) || 1;
    var step = Math.max(28, Math.min(46, tapLen / 4.2));
    var attachStep = Math.min(step * 0.7, Math.max(6, (tapLen - 14) / Math.max(1, perSide - 1)));
    for (var q = 0; q < n; q++) {
      var pts = Math.max(0, Math.min(per, Number(answers[q]) || 0));
      var dir = q % 2 === 0 ? -1 : 1;
      var k = Math.floor(q / 2);                             // rung 0..4 down the side
      var ya = SURFACE + 10 + k * attachStep;                // where it leaves the taproot
      var ye = SURFACE + 30 + k * step;                      // where it ends (the rung)
      var reach = 40 + 130 * (pts / per);                    // 0 points still gets a nub, so the label has a place
      var ex = CX + dir * reach;
      var d = 'M' + CX + ' ' + r1(ya)
        + ' C ' + r1(CX + dir * reach * 0.38) + ' ' + r1(ya + (ye - ya) * 0.12)
        + ', ' + r1(CX + dir * reach * 0.7) + ' ' + r1(ya + (ye - ya) * 0.72)
        + ', ' + r1(ex) + ' ' + r1(ye);
      var col = pts > 0 ? t.root : t.zero;
      var w = pts > 0 ? 1.4 + 1.0 * (pts / per) : 1;
      var plen = reach * 1.25 + Math.abs(ye - ya);
      var ldash = animate ? ' stroke-dasharray="' + r1(plen) + '" stroke-dashoffset="' + r1(plen) + '" class="sv-draw" style="transition-delay:' + r1(0.35 + q * 0.09) + 's"' : '';
      out.push('<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + r1(w) + '" stroke-linecap="round"' + (pts === 0 ? ' stroke-dasharray="2 4"' : ldash) + '/>');
      var lx = ex + dir * 9, anchor = dir < 0 ? 'end' : 'start';
      out.push('<text x="' + r1(lx) + '" y="' + r1(ye + 4) + '" text-anchor="' + anchor + '" font-family="' + esc(t.ui) + '" font-size="12" fill="' + (pts > 0 ? t.ink : t.muted) + '">' + esc(labels[q] || ('Q' + (q + 1))) + ' <tspan fill="' + t.muted + '" font-size="11">' + pts + '/' + per + '</tspan></text>');
    }

    // The number.
    out.push('<text x="18" y="' + (H - 26) + '" font-size="54" fill="' + t.ink + '" font-weight="500">' + score + '<tspan font-size="20" fill="' + t.muted + '"> / ' + max + '</tspan></text>');
    out.push('<text x="18" y="' + (H - 6) + '" font-family="' + esc(t.ui) + '" font-size="12" letter-spacing="1.6" fill="' + t.muted + '">' + esc(band.label.toUpperCase()) + '</text>');
    if (opts.title) out.push('<text x="' + (W - 18) + '" y="' + (H - 12) + '" text-anchor="end" font-size="13" fill="' + t.muted + '" font-style="italic">' + esc(opts.title) + '</text>');
    out.push('</svg>');
    return out.join('');
  }

  var api = { scoreSvg: scoreSvg, DEFAULT_LABELS: DEFAULT_LABELS, DEFAULT_BANDS: DEFAULT_BANDS, W: W, H: H };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ScoreViz = api;
})(typeof window !== 'undefined' ? window : this);
