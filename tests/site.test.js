'use strict';
// What the site tells search engines about its own addresses, checked offline against the
// files that ship. No dependencies: Node's own test runner.
//
//   node --test tests/site.test.js
//
// Why (2026-10-07): Google kept filing three pages under the old address. The site said the
// right thing in its canonical tags, but its own menus linked to /about.html and
// /index.html, copies at other addresses, and the old address had no sitemap for Google to
// re-read it by. These keep each of those from coming back.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SITE = path.join(__dirname, '..', 'site');
const MAIN = 'bluestem-advisory.com';
const OLD = 'bluestemadvisoryllc.com';

const pages = (dir = SITE) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? pages(path.join(dir, e.name)) : e.name.endsWith('.html') ? [path.join(dir, e.name)] : []);
const locs = (file) => [...fs.readFileSync(path.join(SITE, file), 'utf8').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => new URL(m[1]));
// The file a clean address is served from: / is index.html, /about is about.html.
const fileFor = (p) => path.join(SITE, p === '/' ? 'index.html' : `${p}.html`);

test('every link between pages uses the address the page names as its own', () => {
  const bad = [];
  let links = 0;
  for (const file of pages()) {
    for (const [, href] of fs.readFileSync(file, 'utf8').matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)) {
      if (/^(https?:|mailto:|tel:|#)/.test(href) && !href.startsWith(`https://${MAIN}/`)) continue;
      links += 1;
      const p = href.replace(`https://${MAIN}`, '').split(/[?#]/)[0];
      // Relative links resolve differently on /assessment/deeper; .html is a copy of the page.
      if (!p.startsWith('/') || /\.html$/.test(p) || p.endsWith('/index')) bad.push(`${path.relative(SITE, file)}: ${href}`);
    }
  }
  assert.ok(links > 20, `found the links (${links})`);
  assert.deepStrictEqual(bad, [], 'links to a copy of a page');
});

test('every page in the sitemap names itself as the real page', () => {
  const urls = locs('sitemap.xml');
  assert.equal(urls.length, 4);
  for (const u of urls) {
    assert.equal(u.host, MAIN);
    const html = fs.readFileSync(fileFor(u.pathname), 'utf8');
    assert.match(html, new RegExp(`<link rel="canonical" href="${u.href.replace(/[.?]/g, '\\$&')}"\\s*/?>`), u.pathname);
  }
});

test("the old address's sitemap lists the same pages there, and Netlify serves it rather than forwarding it", () => {
  const main = locs('sitemap.xml').map((u) => u.pathname);
  const old = locs('sitemap-old.xml');
  assert.deepStrictEqual(old.map((u) => u.host), main.map(() => OLD));
  assert.deepStrictEqual(old.map((u) => u.pathname), main);
  // Netlify applies the first rule that matches, so the sitemap's rule must come before the
  // rule that forwards everything else on the old address.
  const rules = fs.readFileSync(path.join(__dirname, '..', 'netlify.toml'), 'utf8').split('[[redirects]]').slice(1)
    .map((b) => Object.fromEntries([...b.matchAll(/^\s*(from|to|status|force)\s*=\s*"?([^"\n]*)"?/gm)].map((m) => [m[1], m[2]])));
  const at = (from) => rules.findIndex((r) => r.from === from);
  const served = rules[at(`https://${OLD}/sitemap-old.xml`)];
  assert.ok(served, 'a rule serves the sitemap on the old address');
  assert.deepStrictEqual([served.to, served.status, served.force], ['/sitemap-old.xml', '200', 'true']);
  assert.ok(at(`https://${OLD}/sitemap-old.xml`) < at(`https://${OLD}/*`), 'before the forward');
});
