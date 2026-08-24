// The site's inquiry relay (Rootbook IMPROVEMENTS item 56).
//
// The form on index.html POSTs here (plain HTML — no JavaScript needed). This
// function checks the honeypot, hashes the visitor's IP (never forwards it raw),
// signs the JSON with the shared secret and forwards to Rootbook, which creates
// or attaches a lead. Then it redirects the visitor to /thanks. Shared plumbing
// lives in ../lib/relay.js.
const relay = require('../lib/relay');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!relay.SECRET || !relay.INQUIRY_URL) {
    // Misconfigured — never fail silently for the visitor; the mailto stays on the page.
    console.error('inquiry relay: SITE_INQUIRY_SECRET / ROOTBOOK_INQUIRY_URL not set');
    return relay.redirect(`${relay.SITE}/#contact?sent=0`);
  }
  const { get } = relay.readBody(event);
  // Honeypot: a real person never sees this field. Bots fill it; we say thanks and drop it.
  if (String(get('website') || '').trim()) return relay.redirect(`${relay.SITE}/thanks.html`);
  // Fill-time floor (G-02, 2026-08-24): the page stamps `ft` — milliseconds the
  // form was open, measured on the visitor's clock alone (a duration, so clock
  // skew cannot misfire it). The form only exists after the reveal click, so a
  // real submission always carries it; a bot replaying the endpoint from a
  // cached URL, or auto-submitting a just-fetched page, does not (or is under
  // 3s, faster than a person can type a name, an email and a question). Same
  // exit as the honeypot: say thanks, deliver nothing. Forgeable by a bot that
  // targets us specifically — this floor prices out the commodity tier, and
  // Rootbook's intake cap stands behind it for whatever fakes its way past.
  const ft = Number(get('ft'));
  if (!Number.isFinite(ft) || ft < 3000) return relay.redirect(`${relay.SITE}/thanks.html`);

  const ipHash = relay.ipHashOf(event);
  const payload = {
    name: relay.field(get, 'name', 120), email: relay.field(get, 'email', 200), organization: relay.field(get, 'organization', 200),
    org_type: relay.field(get, 'org_type', 40), question: String(get('question') || '').trim().slice(0, 5000),
    ...relay.context(get, event, '/'),
    ip_hash: ipHash,
  };
  if (!payload.email || !payload.question) return relay.redirect(`${relay.SITE}/#contact?sent=0`);

  const r = await relay.forward(relay.INQUIRY_URL, payload, ipHash);
  if (!r.ok) { console.error(`inquiry relay: ${r.error || `rootbook answered ${r.status}`}`); return relay.redirect(`${relay.SITE}/?sent=0&why=${r.status || 'net'}#contact`); }
  return relay.redirect(`${relay.SITE}/thanks.html`);
};
