// The site's inquiry relay (Rootbook IMPROVEMENTS item 56).
//
// The form on index.html POSTs here (plain HTML — no JavaScript needed). This
// function checks the honeypot, hashes the visitor's IP (never forwards it raw),
// signs the JSON with the shared secret over the exact bytes it sends, and
// forwards to Rootbook, which creates or attaches a lead. Then it redirects the
// visitor to /thanks. Nothing is stored here; Netlify only relays.
//
// Env (Netlify → Site configuration → Environment variables):
//   SITE_INQUIRY_SECRET   shared with Rootbook's .env (hex, ≥32 bytes)
//   ROOTBOOK_INQUIRY_URL  https://workspace.bluestem-advisory.com/api/site/inquiry
const crypto = require('crypto');

const SECRET = process.env.SITE_INQUIRY_SECRET || '';
const TARGET = process.env.ROOTBOOK_INQUIRY_URL || '';
const SITE = 'https://bluestemadvisoryllc.com';

const redirect = (to) => ({ statusCode: 303, headers: { Location: to, 'Cache-Control': 'no-store' }, body: '' });
const field = (p, k, max) => String(p.get(k) || '').replace(/\r/g, '').trim().slice(0, max);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!SECRET || !TARGET) {
    // Misconfigured — never fail silently for the visitor; the mailto stays on the page.
    console.error('inquiry relay: SITE_INQUIRY_SECRET / ROOTBOOK_INQUIRY_URL not set');
    return redirect(`${SITE}/#contact?sent=0`);
  }
  const ct = String(event.headers['content-type'] || '');
  const bodyRaw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  const p = ct.includes('application/json') ? new Map(Object.entries(JSON.parse(bodyRaw || '{}'))) : new URLSearchParams(bodyRaw);
  const get = ct.includes('application/json') ? (k) => p.get(k) : (k) => p.get(k);

  // Honeypot: a real person never sees this field. Bots fill it; we say thanks and drop it.
  if (String(get('website') || '').trim()) return redirect(`${SITE}/thanks.html`);

  const ip = String(event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || '');
  const ipHash = ip ? crypto.createHmac('sha256', SECRET).update(ip).digest('hex').slice(0, 32) : '';
  const payload = {
    name: field(p, 'name', 120), email: field(p, 'email', 200), organization: field(p, 'organization', 200),
    org_type: field(p, 'org_type', 40), question: String(get('question') || '').trim().slice(0, 5000),
    page: field(p, 'page', 300) || (event.headers.referer || '').slice(0, 300),
    referrer: field(p, 'referrer', 300),
    utm_source: field(p, 'utm_source', 80), utm_medium: field(p, 'utm_medium', 80),
    utm_campaign: field(p, 'utm_campaign', 120), utm_content: field(p, 'utm_content', 120),
    ip_hash: ipHash,
  };
  if (!payload.email || !payload.question) return redirect(`${SITE}/#contact?sent=0`);

  const raw = Buffer.from(JSON.stringify(payload));
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac('sha256', SECRET).update(ts).update('.').update(raw).digest('hex');
  try {
    const r = await fetch(TARGET, {
      method: 'POST', body: raw,
      headers: { 'content-type': 'application/json', 'x-site-timestamp': ts, 'x-site-signature': sig, 'x-site-ip-hash': ipHash },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) { console.error(`inquiry relay: rootbook answered ${r.status}`); return redirect(`${SITE}/#contact?sent=0`); }
    return redirect(`${SITE}/thanks.html`);
  } catch (e) {
    console.error(`inquiry relay: ${e.message}`);
    return redirect(`${SITE}/#contact?sent=0`);
  }
};
