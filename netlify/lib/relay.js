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
// Where a visitor lands after posting: the site's main address (2026-10-05). The old
// address would still work, through one more redirect.
const SITE = 'https://bluestem-advisory.com';

const redirect = (to) => ({ statusCode: 303, headers: { Location: to, 'Cache-Control': 'no-store' }, body: '' });

// Form-encoded or JSON → a uniform getter.
function readBody(event) {
  const ct = String(event.headers['content-type'] || '');
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  if (ct.includes('application/json')) {
    let o = {}; try { o = JSON.parse(raw || '{}'); } catch { o = {}; }
    const get = (k) => (o[k] == null ? '' : o[k]);
    get.keys = () => Object.keys(o);
    return { get, json: true };
  }
  const p = new URLSearchParams(raw);
  const get = (k) => p.get(k) || '';
  get.keys = () => [...new Set([...p.keys()])];
  return { get, json: false };
}
const field = (get, k, max) => String(get(k) || '').replace(/\r/g, '').trim().slice(0, max);

// The site's main address reaches Netlify through Cloudflare's proxy, so Netlify's own
// connection IP is a Cloudflare edge server: every visitor through one edge would share a
// hash, and Rootbook's per-visitor cap would hold real leads for triage. Cloudflare puts the
// visitor's address in cf-connecting-ip and overwrites any copy a client sends it. Only a
// request sent to Netlify directly, past Cloudflare, can forge that header, and all it gains
// is a fresh hash: Rootbook's daily cap, the honeypot and the fill-time floor still hold.
function ipHashOf(event) {
  const ip = String(event.headers['cf-connecting-ip'] || event.headers['x-nf-client-connection-ip']
    || event.headers['client-ip'] || '');
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

// WHEN ROOTBOOK CAN'T BE REACHED, THE MESSAGE GOES BACK TO ITS WRITER, NOT INTO THE VOID.
// Rootbook runs on one Mac behind a tunnel; a power cut or a dropped connection there used to
// mean a lead lost: the form page said "that didn't go through" and what the visitor had typed
// was gone. Now the relay answers with a page holding their message and one button that opens
// their own email, addressed to us and already filled in, so a single press still reaches us.
// The text goes back only to the person who just typed it, in this one response: never into a
// URL, a log or a store. The mailto body is capped, because some mail apps refuse long links;
// the whole message stays on the page to copy.
const MAILTO = 'admin@bluestemadvisoryllc.com';
const html = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function rescue({ subject, body, shown, back }, why) {
  const text = body.length > 1800 ? body.slice(0, 1800) + '\n[…the rest is on the page I was sent]' : body;
  const href = `mailto:${MAILTO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Send it by email · Bluestem Advisory</title>
<link rel="icon" href="/favicon.ico">
<style>
  :root{--loam-2:#161B14;--light:#EDEAD9;--straw:#CDBE93;--copper-bright:#B85D2E}
  html,body{margin:0;background:var(--loam-2);color:var(--light);font-family:Georgia,'Literata',serif}
  main{max-width:640px;margin:0 auto;padding:12vh 24px 20vh}
  h1{font-weight:500;font-size:clamp(28px,4vw,40px);margin:0 0 18px}
  p{font-size:18px;line-height:1.55;color:rgba(237,234,217,.8);margin:0 0 16px;max-width:32em}
  a{color:var(--straw);text-decoration:none;border-bottom:2px solid rgba(205,190,147,.35);padding-bottom:3px}
  a:hover{color:var(--copper-bright);border-color:var(--copper-bright)}
  .send{display:inline-block;margin:8px 0 24px;padding:14px 22px;border:0;border-radius:10px;background:var(--straw);color:#161B14;font-family:'Karla',-apple-system,sans-serif;font-size:16px;font-weight:700}
  .send:hover{background:#DCCDA3;color:#161B14}
  blockquote{margin:0 0 24px;padding:16px 18px;border-left:3px solid rgba(205,190,147,.45);background:rgba(237,234,217,.05);white-space:pre-wrap;font-size:16px;line-height:1.55;color:var(--light)}
  .mono{font-family:ui-monospace,Menlo,monospace;font-size:12px;letter-spacing:.06em;color:rgba(237,234,217,.45);margin-top:40px}
</style>
</head>
<body>
<main>
  <h1>That didn&#39;t reach us — but it can.</h1>
  <p>Our side didn&#39;t answer just now, so nothing was sent. Your message is below. Press the button and it opens in your own email, addressed to us and ready to send.</p>
  <p><a class="send" href="${html(href)}">Send it by email</a></p>
  <blockquote>${html(shown)}</blockquote>
  <p>Or write to <a href="mailto:${MAILTO}">${MAILTO}</a> yourself, or <a href="${html(back)}">try again</a> in a few minutes.</p>
  <p class="mono">Based in Illinois · Working across the Midwest · reference ${html(why)}</p>
</main>
</body>
</html>`;
  return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
                                       'X-Robots-Tag': 'noindex' }, body: page };
}

module.exports = {
  SECRET, INQUIRY_URL, SITE, MAILTO,
  ASSESSMENT_URL: INQUIRY_URL.replace(/\/inquiry\/?$/, '/assessment'),
  redirect, readBody, field, ipHashOf, context, forward, rescue,
};
