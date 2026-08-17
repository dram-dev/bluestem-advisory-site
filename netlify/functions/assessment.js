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
const KNOWN = new Set(['rooted', 'taking-hold', 'still-underground', 'on-the-shelf']);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!relay.SECRET || !relay.INQUIRY_URL) {
    console.error('assessment relay: SITE_INQUIRY_SECRET / ROOTBOOK_INQUIRY_URL not set');
    return relay.redirect(`${relay.SITE}/assessment?sent=0`);
  }
  const { get } = relay.readBody(event);
  if (String(get('website') || '').trim()) return relay.redirect(`${relay.SITE}/assessment/taking-hold`); // honeypot

  // Every q_<key> field is an answer index; Rootbook validates the set against
  // the version, so this stays version-agnostic.
  const answers = {};
  const keys = typeof get.keys === 'function' ? get.keys() : null;
  for (const k of (keys || [])) {
    if (!k.startsWith('q_')) continue;
    const v = String(get(k) ?? '').trim();
    if (!/^[0-9]$/.test(v)) return relay.redirect(`${relay.SITE}/assessment?sent=0`);
    answers[k.slice(2)] = Number(v);
  }
  if (!Object.keys(answers).length) return relay.redirect(`${relay.SITE}/assessment?sent=0`);
  const ipHash = relay.ipHashOf(event);
  const payload = {
    version: relay.field(get, 'version', 10) || 'v1',
    answers,
    name: relay.field(get, 'name', 120), email: relay.field(get, 'email', 200), organization: relay.field(get, 'organization', 200),
    org_type: relay.field(get, 'org_type', 40),
    wants_talk: !!String(get('wants_talk') || '').trim(),
    ...relay.context(get, event, '/assessment'),
    ip_hash: ipHash,
  };
  if (!payload.email) return relay.redirect(`${relay.SITE}/assessment?sent=0`);

  const r = await relay.forward(relay.ASSESSMENT_URL, payload, ipHash);
  const slug = r.ok && r.body ? slugOf(r.body.band) : '';
  if (!slug || !KNOWN.has(slug)) {
    console.error(`assessment relay: ${r.error || `rootbook answered ${r.status}`}${slug ? ` (band ${slug})` : ''}`);
    return relay.redirect(`${relay.SITE}/assessment?sent=0`);
  }
  return relay.redirect(`${relay.SITE}/assessment/${slug}?s=${Number(r.body.score)}&m=${Number(r.body.max)}`);
};
