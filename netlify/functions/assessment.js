// The self-assessment relay (Rootbook IMPROVEMENTS item 57).
//
// /assessment.html POSTs here — plain HTML form, so it works with JavaScript
// off; the page's script only turns it into one question at a time. Answers
// are q_<key>=<index>. Rootbook scores (it is the authority on the question
// set), records the lead, emails the write-up, and answers {score, max, band};
// we redirect the visitor to /assessment/<band>?s=&m=. Nothing is stored here.
const relay = require('../lib/relay');

const SLUG = { rooted: 'rooted', taking_hold: 'taking-hold', on_the_shelf: 'on-the-shelf' };
const KEYS = ['why', 'owner', 'ninety', 'baseline', 'board', 'facts', 'heard', 'declined', 'members', 'people'];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!relay.SECRET || !relay.INQUIRY_URL) {
    console.error('assessment relay: SITE_INQUIRY_SECRET / ROOTBOOK_INQUIRY_URL not set');
    return relay.redirect(`${relay.SITE}/assessment?sent=0`);
  }
  const { get } = relay.readBody(event);
  if (String(get('website') || '').trim()) return relay.redirect(`${relay.SITE}/assessment/taking-hold`); // honeypot

  const answers = {};
  for (const k of KEYS) {
    const v = String(get(`q_${k}`) ?? '').trim();
    if (!/^[0-3]$/.test(v)) return relay.redirect(`${relay.SITE}/assessment?sent=0`);
    answers[k] = Number(v);
  }
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
  if (!r.ok || !r.body || !SLUG[r.body.band]) {
    console.error(`assessment relay: ${r.error || `rootbook answered ${r.status}`}`);
    return relay.redirect(`${relay.SITE}/assessment?sent=0`);
  }
  return relay.redirect(`${relay.SITE}/assessment/${SLUG[r.body.band]}?s=${Number(r.body.score)}&m=${Number(r.body.max)}`);
};
