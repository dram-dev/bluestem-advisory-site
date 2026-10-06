'use strict';
// The site's two relays, offline. A stub stands in for Rootbook (global fetch), so nothing
// leaves the machine and no lead is made anywhere. No dependencies: Node's own test runner.
//
//   node --test tests/
const { test, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SET = { SITE_INQUIRY_SECRET: 'test-secret-0123456789abcdef', ROOTBOOK_INQUIRY_URL: 'https://rootbook.test/api/site/inquiry' };
const UNSET = { SITE_INQUIRY_SECRET: undefined, ROOTBOOK_INQUIRY_URL: undefined };

// The relays read their settings when they load, so each case loads them afresh under its own.
function load(env) {
  for (const k of Object.keys(require.cache)) if (k.startsWith(path.join(ROOT, 'netlify'))) delete require.cache[k];
  const saved = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  const mods = { inquiry: require('../netlify/functions/inquiry'), assessment: require('../netlify/functions/assessment') };
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  return mods;
}

const post = (fields) => ({ httpMethod: 'POST', isBase64Encoded: false,
  headers: { 'content-type': 'application/x-www-form-urlencoded', 'cf-connecting-ip': '203.0.113.9' },
  body: new URLSearchParams(fields).toString() });

let calls = [];
const rootbook = (answer) => {
  calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    if (answer instanceof Error) throw answer;
    return { ok: answer.status < 400, status: answer.status, json: async () => answer.body || null };
  };
};
afterEach(() => { delete global.fetch; });

const question = { name: 'Ada Visitor', email: 'ada@example.org', organization: 'Prairie Co-op', org_type: 'cooperative',
  question: 'Can you help our board <b>rebuild</b> the plan?', page: '/', ft: '15000' };
const mailtoBody = (html) => {
  // Decoded as a browser decodes an attribute: the page escapes ' and & inside the link.
  const href = html.match(/class="send" href="([^"]+)"/)[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  return decodeURIComponent(href.split('&body=')[1]);
};

test('a question Rootbook takes goes on to the thanks page, signed', async () => {
  const { inquiry } = load(SET);
  rootbook({ status: 200, body: { ok: true, lead: 'created' } });
  const r = await inquiry.handler(post(question));
  assert.equal(r.statusCode, 303);
  assert.equal(r.headers.Location, 'https://bluestem-advisory.com/thanks.html');
  assert.equal(calls.length, 1);
  assert.match(calls[0].init.headers['x-site-signature'], /^[0-9a-f]{64}$/);
});

test("when Rootbook can't be reached, the visitor gets their message back with a one-press email", async () => {
  const { inquiry } = load(SET);
  rootbook(new Error('connect ECONNREFUSED'));
  const r = await inquiry.handler(post(question));
  assert.equal(r.statusCode, 200, 'a page, not a redirect: nothing they typed goes into a URL');
  assert.equal(r.headers.Location, undefined);
  assert.equal(r.headers['Cache-Control'], 'no-store');
  assert.match(r.body, /Send it by email/);
  assert.match(r.body, /href="mailto:admin@bluestemadvisoryllc\.com\?subject=A%20question%20from%20the%20website&amp;body=/);
  const body = mailtoBody(r.body);
  assert.match(body, /^Can you help our board <b>rebuild<\/b> the plan\?/, 'the email carries their words');
  assert.match(body, /Ada Visitor, Prairie Co-op$/);
  assert.match(r.body, /<blockquote>Can you help our board &lt;b&gt;rebuild&lt;\/b&gt; the plan\?<\/blockquote>/,
    'shown on the page, escaped');
  assert.match(r.body, /reference net/);
  assert.match(r.body, /<meta name="robots" content="noindex">/);
});

test('a Rootbook error is rescued the same way, and names its status', async () => {
  const { inquiry } = load(SET);
  rootbook({ status: 502 });
  const r = await inquiry.handler(post(question));
  assert.equal(r.statusCode, 200);
  assert.match(r.body, /reference 502/);
});

test('a long message is capped in the email link but kept whole on the page', async () => {
  const { inquiry } = load(SET);
  rootbook(new Error('timeout'));
  const long = 'word '.repeat(900).trim();
  const r = await inquiry.handler(post({ ...question, question: long }));
  const body = mailtoBody(r.body);
  assert.ok(body.length < 1900, `capped (${body.length})`);
  assert.match(body, /the rest is on the page I was sent/);
  assert.ok(r.body.includes(long), 'the whole message stays on the page to copy');
});

test('the honeypot and the fill-time floor say thanks and send nothing', async () => {
  const { inquiry } = load(SET);
  rootbook({ status: 200, body: { ok: true } });
  for (const extra of [{ website: 'http://spam.test' }, { ft: '900' }, { ft: '' }]) {
    const r = await inquiry.handler(post({ ...question, ...extra }));
    assert.equal(r.headers.Location, 'https://bluestem-advisory.com/thanks.html');
  }
  assert.equal(calls.length, 0, 'Rootbook never asked');
});

test('a relay missing its settings sends the visitor back to the form, for both forms', async () => {
  const { inquiry, assessment } = load(UNSET);
  rootbook({ status: 200, body: {} });
  assert.equal((await inquiry.handler(post(question))).headers.Location, 'https://bluestem-advisory.com/#contact?sent=0');
  // It used `backTo` before declaring it, and answered 502.
  const a = await assessment.handler(post({ q_understanding: '2', email: 'ada@example.org' }));
  assert.equal(a.statusCode, 303);
  assert.equal(a.headers.Location, 'https://bluestem-advisory.com/assessment?sent=0');
  const d = await assessment.handler(post({ q_ground: '1', email: 'ada@example.org', page: '/assessment/deeper' }));
  assert.equal(d.headers.Location, 'https://bluestem-advisory.com/assessment/deeper?sent=0');
  assert.equal(calls.length, 0);
});

test('an assessment Rootbook scores goes to its result page', async () => {
  const { assessment } = load(SET);
  rootbook({ status: 200, body: { ok: true, score: 9, max: 15, band: 'taking_hold', points: [2, 1, 3, 2, 1] } });
  const r = await assessment.handler(post({ q_understanding: '2', q_owners: '1', email: 'ada@example.org', version: 'v4' }));
  assert.equal(r.headers.Location, 'https://bluestem-advisory.com/assessment/taking-hold?s=9&m=15&a=21321');
});

test("an assessment Rootbook can't take is rescued with who they are and their answers", async () => {
  const { assessment } = load(SET);
  rootbook(new Error('connect ECONNREFUSED'));
  const r = await assessment.handler(post({ q_understanding: '2', q_owners: '1', email: 'ada@example.org',
    name: 'Ada Visitor', organization: 'Prairie Co-op', wants_talk: 'on', version: 'v4' }));
  assert.equal(r.statusCode, 200);
  const body = mailtoBody(r.body);
  assert.match(body, /I'd like to talk this through\./);
  assert.match(body, /Ada Visitor, Prairie Co-op, ada@example\.org/);
  assert.match(body, /Answers \(v4\): understanding 2, owners 1/);
  assert.match(r.body, /href="https:\/\/bluestem-advisory\.com\/assessment">try again/);
});
