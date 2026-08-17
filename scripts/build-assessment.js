#!/usr/bin/env node
// Builds site/assessment.html and site/assessment/<band>.html from
// content/assessment.v1.json. The JSON is generated from Rootbook's
// src/assessment.js (the authority on scoring), so wording and scoring can
// never drift:
//   node -e "const A=require('../rootbook/src/assessment.js');const v=A.CURRENT_VERSION,s=A.SETS[v];
//     require('fs').writeFileSync('content/assessment.'+v+'.json',JSON.stringify({version:v,title:s.title,context:s.context||[],
//     questions:s.questions,bands:s.bands.map(b=>({...b,slug:b.key.replace(/_/g,'-')}))},null,2)+'\n')"
//   node scripts/build-assessment.js            (reads content/assessment.<CURRENT>.json — see VERSION below)
// No build step on Netlify — run this and commit the outputs.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VERSION = process.env.ASSESSMENT_VERSION || 'v3';
const set = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', `assessment.${VERSION}.json`), 'utf8'));
set.context = set.context || [];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const HEAD = (title, extraCss = '') => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Bluestem Advisory</title>
<meta name="robots" content="noindex">
<meta name="description" content="A three-minute read on your organization's strategic plan — or on where you'd start if you don't have one: ten questions, a straight answer, and the written version by email.">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400..600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=Karla:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{--loam:#0F1310;--loam-2:#161B14;--light:#EDEAD9;--straw:#CDBE93;--copper:#A14E24;--copper-bright:#B85D2E;--ink:#232A20;--rule:rgba(205,190,147,.22)}
  *{box-sizing:border-box}
  html,body{margin:0;background:var(--loam-2);color:var(--light);font-family:'Literata',Georgia,serif}
  a{color:var(--straw);text-decoration:none;border-bottom:2px solid rgba(205,190,147,.35);padding-bottom:2px}
  a:hover{color:var(--copper-bright);border-color:var(--copper-bright)}
  .top{display:flex;justify-content:space-between;align-items:baseline;max-width:720px;margin:0 auto;padding:22px 24px 0}
  .brand{font-family:'Newsreader',serif;font-size:18px;letter-spacing:.01em;color:var(--light);border:0}
  .mono{font-family:'Karla',ui-monospace,monospace;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:rgba(237,234,217,.45)}
  main{max-width:720px;margin:0 auto;padding:8vh 24px 16vh}
  h1{font-family:'Newsreader',serif;font-weight:500;font-size:clamp(32px,5vw,48px);line-height:1.08;margin:0 0 18px;text-wrap:balance}
  .lede{font-size:19px;line-height:1.55;color:rgba(237,234,217,.8);margin:0 0 12px;max-width:34em}
  .fine{font-size:14px;line-height:1.5;color:rgba(237,234,217,.5);margin:0 0 40px;max-width:36em}
  ${extraCss}
</style>
</head>
<body>
<div class="top"><a class="brand" href="/">Bluestem Advisory</a><span class="mono">Based in Illinois</span></div>
`;
const FOOT = `</body>
</html>
`;

// ------------------------------------------------------------ the assessment
const QUIZ_CSS = `
  .q{border-top:1px solid var(--rule);padding:30px 0 26px}
  .q:first-of-type{border-top:0;padding-top:0}
  .q .n{font-family:'Karla',sans-serif;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--straw);margin:0 0 10px}
  .q h2{font-family:'Newsreader',serif;font-weight:500;font-size:clamp(21px,2.6vw,26px);line-height:1.3;margin:0 0 18px;text-wrap:balance}
  .opts{display:grid;gap:10px;margin:0;padding:0;list-style:none}
  .opts label{display:flex;gap:14px;align-items:flex-start;padding:13px 16px;border:1px solid var(--rule);border-radius:10px;background:rgba(237,234,217,.04);cursor:pointer;font-size:16.5px;line-height:1.45;transition:border-color .2s,background .2s}
  .opts label:hover{border-color:var(--straw);background:rgba(237,234,217,.07)}
  .opts input{margin:5px 0 0;flex:none;accent-color:var(--copper-bright)}
  .opts label:has(input:checked){border-color:var(--straw);background:rgba(205,190,147,.12)}
  .who{border-top:1px solid var(--rule);padding:30px 0 0}
  .who h2{font-family:'Newsreader',serif;font-weight:500;font-size:clamp(21px,2.6vw,26px);margin:0 0 6px}
  .who p{color:rgba(237,234,217,.7);font-size:16px;line-height:1.5;margin:0 0 20px;max-width:34em}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 18px;max-width:640px}
  .grid .full{grid-column:1/-1}
  .grid label{display:block;font-family:'Karla',sans-serif;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:rgba(237,234,217,.55);margin-bottom:6px}
  .grid input,.grid select{width:100%;font:inherit;font-size:16px;color:var(--light);background:rgba(237,234,217,.06);border:1px solid rgba(205,190,147,.28);border-radius:8px;padding:11px 12px}
  .grid input:focus,.grid select:focus{outline:none;border-color:var(--straw);background:rgba(237,234,217,.09)}
  .grid select{appearance:none} .grid select option{color:var(--ink)}
  .check{display:flex;gap:10px;align-items:flex-start;font-size:16px;line-height:1.45;color:rgba(237,234,217,.85)}
  .check input{margin:5px 0 0;accent-color:var(--copper-bright)}
  .hp{position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden}
  .send{font-family:'Karla',sans-serif;font-size:14px;font-weight:700;letter-spacing:.04em;color:var(--loam);background:var(--straw);border:1px solid var(--straw);border-radius:999px;padding:13px 26px;cursor:pointer;transition:background .25s,border-color .25s,color .25s}
  .send:hover{background:var(--copper-bright);border-color:var(--copper-bright);color:var(--light)}
  .send[disabled]{opacity:.5;cursor:default}
  .err{color:var(--copper-bright);font-size:15px;margin:0 0 18px}
  .nav{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:22px}
  .ghost{font-family:'Karla',sans-serif;font-size:14px;font-weight:600;color:var(--straw);background:none;border:1px solid var(--rule);border-radius:999px;padding:11px 20px;cursor:pointer}
  .ghost:hover{border-color:var(--straw)}
  .bar{height:2px;background:var(--rule);border-radius:2px;margin:0 0 34px;overflow:hidden}
  .bar i{display:block;height:100%;width:0;background:var(--straw);transition:width .35s}
  /* JavaScript on: one step at a time. Off: everything stacked, still a form. */
  html.js .step{display:none} html.js .step.on{display:block}
  html.js .q{border-top:0;padding-top:0}
  html.js .bar{display:block} .bar{display:none}
  html.js .nav{display:flex} .nav{display:none}
  html.js .nojs-send{display:none}
  @media (max-width:640px){.grid{grid-template-columns:1fr}}
`;

function quizPage() {
  const ctx = set.context.map((q, i) => `
    <section class="q step" data-step="${i}">
      <p class="n">To start</p>
      <h2>${esc(q.text)}</h2>
      <ul class="opts">
        ${q.answers.map((a, j) => `<li><label><input type="radio" name="q_${q.key}" value="${j}" required> <span>${esc(a)}</span></label></li>`).join('\n        ')}
      </ul>
    </section>`).join('\n');
  const qs = set.questions.map((q, i) => `
    <section class="q step" data-step="${set.context.length + i}">
      <p class="n">Question ${i + 1} of ${set.questions.length}</p>
      <h2>${esc(q.text)}</h2>
      <ul class="opts">
        ${q.answers.map((a, j) => `<li><label><input type="radio" name="q_${q.key}" value="${j}" required> <span>${esc(a)}</span></label></li>`).join('\n        ')}
      </ul>
    </section>`).join('\n');
  return HEAD(set.title, QUIZ_CSS) + `<main>
  <h1>${esc(set.title)}</h1>
  <p class="lede">Ten questions about where your organization is heading — whether that lives in a strategic plan the board approved, a page of goals, or in conversations nobody has written down yet. Three minutes, honest answers. You'll get a straight, kind read on screen, and the written version by email. And if you don't have a strategic plan at all, say so — there's a path for that too.</p>
  <p class="fine">Nothing you enter goes anywhere but to the two of us. No account, no list, no follow-up you didn't ask for.</p>
  <p class="err" id="err" hidden>That didn't go through. Please try again, or <a href="/#contact">write to us instead</a>.</p>
  <form method="post" action="/.netlify/functions/assessment" id="assess" novalidate>
    <input type="hidden" name="version" value="${esc(set.version)}">
    <div class="bar" aria-hidden="true"><i id="bar"></i></div>
${ctx}
${qs}
    <section class="who step" data-step="${set.context.length + set.questions.length}">
      <h2>Where should the written version go?</h2>
      <p>You'll see your result on the next page. Leave an email and the written version — a line on where your plan lives, your band, and the three answers that pulled the score down — arrives from the two of us within a minute.</p>
      <div class="grid">
        <div><label for="a-name">Your name</label><input id="a-name" name="name" type="text" autocomplete="name" maxlength="120"></div>
        <div><label for="a-email">Email</label><input id="a-email" name="email" type="email" required autocomplete="email" maxlength="200"></div>
        <div><label for="a-org">Organization</label><input id="a-org" name="organization" type="text" autocomplete="organization" maxlength="200"></div>
        <div><label for="a-type">It's a…</label>
          <select id="a-type" name="org_type">
            <option value="">— choose —</option>
            <option value="cooperative">Cooperative</option>
            <option value="nonprofit">Nonprofit</option>
            <option value="association">Association</option>
            <option value="membership">Membership organization</option>
            <option value="agency">Agency</option>
            <option value="other">Something else</option>
          </select></div>
        <div class="full"><label class="check"><input type="checkbox" name="wants_talk" value="1"> <span>I'd like to talk this through — please get in touch.</span></label></div>
        <div class="hp" aria-hidden="true"><label for="a-web">Website</label><input id="a-web" name="website" type="text" tabindex="-1" autocomplete="off"></div>
        <input type="hidden" name="page" value="/assessment"><input type="hidden" name="referrer" value=""><input type="hidden" name="utm_source" value=""><input type="hidden" name="utm_medium" value=""><input type="hidden" name="utm_campaign" value=""><input type="hidden" name="utm_content" value="">
        <div class="full nojs-send"><button class="send" type="submit">See my result</button></div>
      </div>
    </section>
    <div class="nav">
      <button class="ghost" type="button" id="back" hidden>← Back</button>
      <button class="send" type="button" id="next">Next →</button>
    </div>
  </form>
  <p class="fine" style="margin-top:44px">A note on the score: it asks whether your direction is <em>alive</em> — owned, dated, measured, looked at, and understood by more than the people who set it — not whether it's clever, and not whether it's written down. Ten questions can't see your organization; they can only ask what you'd say out loud.</p>
</main>
<script>
(function () {
  document.documentElement.classList.add('js');
  var form = document.getElementById('assess');
  var steps = Array.prototype.slice.call(form.querySelectorAll('.step'));
  var back = document.getElementById('back'), next = document.getElementById('next'), bar = document.getElementById('bar');
  var err = document.getElementById('err');
  var i = 0, last = steps.length - 1;
  // Hidden context fields, same as the inquiry form.
  try {
    var qs = new URLSearchParams(location.search);
    form.referrer.value = (document.referrer || '').slice(0, 300);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (k) { if (qs.get(k)) form[k].value = qs.get(k).slice(0, 120); });
    if (qs.get('sent') === '0') err.hidden = false;
  } catch (e) {}
  function show(n) {
    i = n;
    steps.forEach(function (s, k) { s.classList.toggle('on', k === i); });
    back.hidden = i === 0;
    next.textContent = i === last ? 'See my result' : 'Next →';
    bar.style.width = Math.round((i / last) * 100) + '%';
    var focus = steps[i].querySelector('input:not([type=hidden]), select');
    if (i === 0 && focus) { /* don't steal focus on load */ } else if (focus) focus.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function answered(s) {
    var radios = s.querySelectorAll('input[type=radio]');
    if (!radios.length) return true;
    return Array.prototype.some.call(radios, function (r) { return r.checked; });
  }
  next.addEventListener('click', function () {
    if (i < last) {
      if (!answered(steps[i])) { steps[i].querySelector('.opts').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 240 }); return; }
      show(i + 1);
    } else {
      var email = form.email;
      if (!email.value || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email.value)) { email.focus(); email.style.borderColor = 'var(--copper-bright)'; return; }
      next.disabled = true; next.textContent = 'Scoring…';
      form.submit();
    }
  });
  back.addEventListener('click', function () { if (i > 0) show(i - 1); });
  // Picking an answer advances after a beat — one hand, one thumb.
  form.addEventListener('change', function (e) {
    if (e.target.type === 'radio' && i < last - 1) setTimeout(function () { if (answered(steps[i])) show(i + 1); }, 260);
    else if (e.target.type === 'radio' && i === last - 1) setTimeout(function () { show(last); }, 260);
  });
  form.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); next.click(); } });
  show(0);
})();
</script>
` + FOOT;
}

// ------------------------------------------------------------ result pages
const RESULT_CSS = `
  .band{font-family:'Karla',sans-serif;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--straw);margin:0 0 14px}
  .score{font-family:'Newsreader',serif;font-size:18px;color:rgba(237,234,217,.6);margin:0 0 26px}
  .verdict{font-size:19px;line-height:1.6;color:rgba(237,234,217,.88);margin:0 0 28px;max-width:34em}
  .next{border-top:1px solid var(--rule);padding-top:26px;margin-top:10px}
  .next p{font-size:16.5px;line-height:1.55;color:rgba(237,234,217,.72);max-width:34em;margin:0 0 14px}
  .others{margin-top:44px}
  .others summary{cursor:pointer;color:var(--straw);font-family:'Karla',sans-serif;font-size:13px;letter-spacing:.04em}
  .others .o{margin-top:18px} .others .o b{font-family:'Newsreader',serif;font-weight:500;font-size:18px;display:block;margin-bottom:6px}
  .others .o p{font-size:15px;line-height:1.55;color:rgba(237,234,217,.6);margin:0;max-width:34em}
`;
function resultPage(band) {
  const others = set.bands.filter((b) => b.key !== band.key);
  return HEAD(`${band.label} — ${set.title}`, RESULT_CSS) + `<main>
  <p class="band">Your result</p>
  <h1>${esc(band.label)}</h1>
  <p class="score" id="score" hidden>You scored <b id="s"></b> of <span id="m"></span>.</p>
  <p class="verdict">${esc(band.text)}</p>
  <div class="next">
    <p id="mailed">The written version is on its way to your inbox — your band and the three answers that pulled the score down. It comes from the two of us, and replying to it reaches us directly.</p>
    <p>${band.atRisk
      ? 'If you\'d rather just talk, <a href="/#contact">say so here</a> — a paragraph is plenty, and we\'ll be honest about whether we\'re the right fit.'
      : 'If any of this is worth a conversation, <a href="/#contact">write to us</a> — a paragraph is plenty.'}</p>
    <p><a href="/">Back to the site</a> · <a href="/assessment">Take it again</a></p>
  </div>
  <details class="others">
    <summary>The other two bands, for context</summary>
    ${others.map((o) => `<div class="o"><b>${esc(o.label)}</b><p>${esc(o.text)}</p></div>`).join('\n    ')}
  </details>
</main>
<script>
(function () {
  try {
    var q = new URLSearchParams(location.search), s = q.get('s'), m = q.get('m');
    if (s && m && /^\\d+$/.test(s) && /^\\d+$/.test(m)) { document.getElementById('s').textContent = s; document.getElementById('m').textContent = m; document.getElementById('score').hidden = false; }
    if (q.get('e') === '0') document.getElementById('mailed').hidden = true;
  } catch (e) {}
})();
</script>
` + FOOT;
}

// The "no strategic plan yet" path: its own page, leading with its own paragraph;
// the band the answers earned is shown underneath from ?b=<slug>.
function freshPage() {
  const f = set.starting_fresh;
  return HEAD(`${f.label} — ${set.title}`, RESULT_CSS) + `<main>
  <p class="band">Your result</p>
  <h1>${esc(f.label)}</h1>
  <p class="verdict">${esc(f.text)}</p>
  <div class="next">
    <p class="score" id="score" hidden>On the ten questions you scored <b id="s"></b> of <span id="m"></span> — <b id="bl"></b>.</p>
    <p id="mailed">The written version is on its way to your inbox — this note, your answers, and the three places we'd start. It comes from the two of us, and replying to it reaches us directly.</p>
    <p>If you'd like to talk it through, <a href="/#contact">say so here</a> — a paragraph is plenty, and we'll be honest about whether we're the right fit.</p>
    <p><a href="/">Back to the site</a> · <a href="/assessment">Take it again</a></p>
  </div>
  <details class="others">
    <summary>How the ten questions are read</summary>
    ${set.bands.map((o) => `<div class="o"><b>${esc(o.label)}</b><p>${esc(o.text)}</p></div>`).join('\n    ')}
  </details>
</main>
<script>
(function () {
  try {
    var q = new URLSearchParams(location.search), s = q.get('s'), m = q.get('m'), b = q.get('b');
    var labels = ${JSON.stringify(Object.fromEntries(set.bands.map((x) => [x.slug, x.label])))};
    if (s && m && /^\\d+$/.test(s) && /^\\d+$/.test(m)) { document.getElementById('s').textContent = s; document.getElementById('m').textContent = m; document.getElementById('bl').textContent = labels[b] || ''; document.getElementById('score').hidden = false; }
  } catch (e) {}
})();
</script>
` + FOOT;
}

fs.writeFileSync(path.join(ROOT, 'site', 'assessment.html'), quizPage());
fs.mkdirSync(path.join(ROOT, 'site', 'assessment'), { recursive: true });
for (const b of set.bands) fs.writeFileSync(path.join(ROOT, 'site', 'assessment', `${b.slug}.html`), resultPage(b));
if (set.starting_fresh) fs.writeFileSync(path.join(ROOT, 'site', 'assessment', 'starting-fresh.html'), freshPage());
console.log(`built site/assessment.html + ${set.bands.length} result pages from ${set.version}`);
