// The self-assessment relay (Rootbook IMPROVEMENTS item 57).
//
// /assessment.html POSTs here — plain HTML form, so it works with JavaScript
// off; the page's script only turns it into one question at a time. Answers
// are q_<key>=<index>. Rootbook scores (it is the authority on the question
// set), records the lead, emails the write-up, and answers {score, max, band};
// we redirect the visitor to /assessment/<band>?s=&m=. Nothing is stored here.
const relay = require('../lib/relay');

// Band key → result page. Rootbook is the authority on which bands exist; a
// band we have no page for falls back to a generic slug derived from the key.
const slugOf = (band) => String(band || '').replace(/[^a-z_]/g, '').replace(/_/g, '-');
// v4 (part one) bands, v4d (part two, "Go deeper") bands, and v1's shelf.
const KNOWN = new Set(['rooted', 'taking-hold', 'still-underground', 'on-the-shelf', 'solid-ground', 'partly-assumed', 'unexamined']);
const FRESH = 'starting-fresh'; // the "no strategic plan yet" path (v3+): its own page, band underneath — or, skipped, no band at all

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!relay.SECRET || !relay.INQUIRY_URL) {
    console.error('assessment relay: SITE_INQUIRY_SECRET / ROOTBOOK_INQUIRY_URL not set');
    return relay.redirect(`${relay.SITE}${backTo}?sent=0`);
  }
  const { get } = relay.readBody(event);
  // A failure returns the visitor to the page they were on — part one or part two.
  const backTo = String(get('page') || '') === '/assessment/deeper' ? '/assessment/deeper' : '/assessment';
  if (String(get('website') || '').trim()) return relay.redirect(`${relay.SITE}/assessment/taking-hold`); // honeypot

  // Every q_<key> field is an answer index; Rootbook validates the set against
  // the version, so this stays version-agnostic.
  const answers = {};
  const keys = typeof get.keys === 'function' ? get.keys() : null;
  for (const k of (keys || [])) {
    if (!k.startsWith('q_')) continue;
    const v = String(get(k) ?? '').trim();
    if (!/^[0-9]$/.test(v)) return relay.redirect(`${relay.SITE}${backTo}?sent=0`);
    answers[k.slice(2)] = Number(v);
  }
  if (!Object.keys(answers).length) return relay.redirect(`${relay.SITE}${backTo}?sent=0`);
  const skipped = !!String(get('skipped') || '').trim();   // starting-fresh only; Rootbook refuses it otherwise
  const ipHash = relay.ipHashOf(event);
  const payload = {
    version: relay.field(get, 'version', 10) || 'v4',
    answers,
    name: relay.field(get, 'name', 120), email: relay.field(get, 'email', 200), organization: relay.field(get, 'organization', 200),
    org_type: relay.field(get, 'org_type', 40),
    wants_talk: !!String(get('wants_talk') || '').trim(),
    skipped,
    ...relay.context(get, event, '/assessment'),
    ip_hash: ipHash,
  };
  if (!payload.email) return relay.redirect(`${relay.SITE}${backTo}?sent=0`);

  const r = await relay.forward(relay.ASSESSMENT_URL, payload, ipHash);
  // `t=1`: they asked to be called, so the result page drops its "write to us" line.
  const talk = r.ok && r.body && r.body.wants_talk ? '&t=1' : '';
  // Skipped the questions on the no-plan path: nothing was scored — the starting-fresh page, no band, no drawing.
  if (r.ok && r.body && r.body.skipped) return relay.redirect(`${relay.SITE}/assessment/${FRESH}?skip=1&t=1`);
  const slug = r.ok && r.body ? slugOf(r.body.band) : '';
  if (!slug || !KNOWN.has(slug)) {
    console.error(`assessment relay: ${r.error || `rootbook answered ${r.status}`}${slug ? ` (band ${slug})` : ''}`);
    // `why` is a bare status code (or 'net'), so a failure can be diagnosed from
    // the visitor's URL without a log in front of you. Nothing about the visitor.
    return relay.redirect(`${relay.SITE}${backTo}?sent=0&why=${r.status || 'net'}`);
  }
  // `a` = per-question points in question order (0–3 each), for the drawing on the
  // result page. Rootbook is the authority on the score; this is the same arithmetic
  // (points = answers − 1 − index) and carries nothing about the person.
  const pts = Array.isArray(r.body.points) ? r.body.points.join('') : '';
  // Part two read with part one (`combined`, when Rootbook found part one for this email):
  // the ten-question score, max, points and band, so the result page draws the fuller picture.
  const c = r.body.combined;
  const cpts = c && Array.isArray(c.points) ? c.points.join('') : '';
  const comb = c ? `&cs=${Number(c.score)}&cm=${Number(c.max)}${cpts ? `&ca=${cpts}` : ''}&cb=${slugOf(c.band)}` : '';
  const tail = `?s=${Number(r.body.score)}&m=${Number(r.body.max)}${pts ? `&a=${pts}` : ''}${talk}${comb}`;
  if (r.body.starting_fresh) return relay.redirect(`${relay.SITE}/assessment/${FRESH}${tail}&b=${slug}`);
  return relay.redirect(`${relay.SITE}/assessment/${slug}${tail}`);
};
