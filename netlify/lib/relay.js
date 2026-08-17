// Shared by the inquiry and assessment relays: read the posted body, hash the
// visitor's IP, sign the JSON with the shared secret over the exact bytes sent,
// and forward to Rootbook. Nothing is stored here; Netlify only relays.
//
// Env (Netlify → Site configuration → Environment variables):
//   SITE_INQUIRY_SECRET   shared with Rootbook's .env (hex, ≥32 bytes)
//   ROOTBOOK_INQUIRY_URL  https://workspace.bluestem-advisory.com/api/site/inquiry
//                         (the assessment target is derived: …/api/site/assessment)
'use strict';
const crypto = require('crypto');

const SECRET = process.env.SITE_INQUIRY_SECRET || '';
const INQUIRY_URL = process.env.ROOTBOOK_INQUIRY_URL || '';
const SITE = 'https://bluestemadvisoryllc.com';

const redirect = (to) => ({ statusCode: 303, headers: { Location: to, 'Cache-Control': 'no-store' }, body: '' });

// Form-encoded or JSON → a uniform getter.
function readBody(event) {
  const ct = String(event.headers['content-type'] || '');
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  if (ct.includes('application/json')) {
    let o = {}; try { o = JSON.parse(raw || '{}'); } catch { o = {}; }
    return { get: (k) => (o[k] == null ? '' : o[k]), json: true };
  }
  const p = new URLSearchParams(raw);
  return { get: (k) => p.get(k) || '', json: false };
}
const field = (get, k, max) => String(get(k) || '').replace(/\r/g, '').trim().slice(0, max);

function ipHashOf(event) {
  const ip = String(event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || '');
  return ip ? crypto.createHmac('sha256', SECRET).update(ip).digest('hex').slice(0, 32) : '';
}

// The context fields both forms carry.
function context(get, event, defaultPage) {
  return {
    page: field(get, 'page', 300) || (event.headers.referer || '').slice(0, 300) || defaultPage,
    referrer: field(get, 'referrer', 300),
    utm_source: field(get, 'utm_source', 80), utm_medium: field(get, 'utm_medium', 80),
    utm_campaign: field(get, 'utm_campaign', 120), utm_content: field(get, 'utm_content', 120),
  };
}

// Sign and forward. Returns { ok, status, body } — never throws.
async function forward(target, payload, ipHash) {
  const raw = Buffer.from(JSON.stringify(payload));
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac('sha256', SECRET).update(ts).update('.').update(raw).digest('hex');
  try {
    const r = await fetch(target, {
      method: 'POST', body: raw,
      headers: { 'content-type': 'application/json', 'x-site-timestamp': ts, 'x-site-signature': sig, 'x-site-ip-hash': ipHash },
      signal: AbortSignal.timeout(8000),
    });
    let body = null; try { body = await r.json(); } catch { body = null; }
    return { ok: r.ok, status: r.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: e.message };
  }
}

module.exports = {
  SECRET, INQUIRY_URL, SITE,
  ASSESSMENT_URL: INQUIRY_URL.replace(/\/inquiry\/?$/, '/assessment'),
  redirect, readBody, field, ipHashOf, context, forward,
};
