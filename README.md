# Bluestem Advisory — Website

Source for **bluestemadvisoryllc.com**, the site for Bluestem Advisory LLC, an Illinois
management consultancy. The site is fully static — two self-contained HTML pages with all
CSS, JavaScript, illustrations, and the founder portrait embedded inline. No build step,
no dependencies, no framework.

## Repository layout

```
.
├── README.md            ← this file
├── netlify.toml         ← Netlify deploy configuration
└── site/                ← the publish directory (what actually deploys)
    ├── index.html       ← main page (hero, work, approach, why, contact)
    ├── about.html       ← About us page (founder bio, the practice)
    ├── og-image.png     ← 1200×630 link-preview card (iMessage, Slack, LinkedIn…)
    ├── favicon.ico      ← multi-size icon (16/32/48/64)
    ├── favicon-32.png   ← standard PNG favicon
    └── apple-touch-icon.png  ← 180×180 iOS home-screen icon
```

Design notes for future edits:

- **Typefaces**: Literata (headings/display), Newsreader (body), Karla (labels, buttons, UI)
  — loaded from Google Fonts in each page's `<head>`.
- **Palette** (CSS custom properties in `:root`): paper `#F2F0E6`, ink `#232A20`,
  copper `#A14E24`, straw `#CDBE93`, deep green `#1E4230`, stem blue `#5F6E8C`,
  loam darks for the root-zone sections.
- The **hero prairie illustration** (bluestem bunch with jointed stems, black-eyed susans,
  clover spikes) is a programmatically generated inline SVG. The **depth ruler**, growing
  scroll root, section reveals, mobile menu, and footer root-draw are all vanilla JS at the
  bottom of `index.html`.
- The founder portrait on `about.html` is embedded as base64 JPEG (~106 KB) so the page
  stays a single file.
- Both pages reference `og-image.png` and the favicon files by **absolute path from the
  site root** (`/og-image.png`, `/favicon.ico`), so those files must always deploy
  alongside the HTML.

---

## Hosting architecture (who does what)

| Concern | Provider | Notes |
|---|---|---|
| Domain registration | **Wix** | bluestemadvisoryllc.com |
| DNS records | **Wix** | points the domain at Netlify |
| Hosting / CDN / HTTPS | **Netlify** | serves the static files, free tier |

Wix is **only** the registrar/DNS host. The Wix *site builder* must stay disconnected
from the domain (see the gotcha below — this has bitten us before).

---

## Netlify configuration

### Option A — drag-and-drop deploy (the original workflow; superseded by B)

1. Log in to Netlify → open the site → **Deploys** tab.
2. Drag the **`site/` folder** (the folder itself, not the repo root) into the drop zone.
3. Wait ~1 minute for the deploy to go live. Nothing else to configure.

Every drag-and-drop is a full replacement deploy. Netlify keeps deploy history, so a bad
deploy can be instantly rolled back from the Deploys tab (**⋯ → Publish deploy** on any
older entry).

### Option B — Git-connected deploy — THIS IS THE CURRENT WORKFLOW (2026-08-17)

The site is connected to this GitHub repo: **every push to `main` is a Netlify deploy**, and
every deploy spends Netlify credits/build minutes, so pushes are batched — several changes,
one push — rather than one push per tweak. `netlify.toml` carries an `ignore` rule that skips
the deploy when a push touched nothing under `site/`, `netlify/` or `netlify.toml`.


1. Netlify → **Add new site → Import an existing project → GitHub** → pick this repo.
2. Settings when prompted (also encoded in `netlify.toml`, which Netlify reads
   automatically):
   - **Build command**: *(leave empty — static site)*
   - **Publish directory**: `site`
3. Every push to the default branch auto-deploys. Pull requests get preview URLs.

### Site settings worth knowing

- **Custom domain**: Site settings → Domain management → add
  `bluestemadvisoryllc.com` and `www.bluestemadvisoryllc.com`.
- **HTTPS**: Netlify provisions a Let's Encrypt certificate automatically once DNS
  resolves to Netlify. If the cert stalls, use **Verify DNS configuration** then
  **Renew certificate** on the same page.
- `netlify.toml` in this repo also adds a clean `/about` URL and cache headers for the
  image assets.

---

## Wix DNS configuration

In Wix: **Domains → bluestemadvisoryllc.com → Advanced / DNS records.** The records that
point the domain at Netlify:

| Type | Host | Value | Purpose |
|---|---|---|---|
| A | `@` | `75.2.60.5` | apex → Netlify's load balancer |
| CNAME | `www` | `<your-site-name>.netlify.app` | www → your Netlify site |

(`<your-site-name>` is the site's Netlify subdomain, visible at the top of the site's
overview page in Netlify.)

Remove or avoid any other A/AAAA records on `@` and any CNAME on `www` that point at Wix
infrastructure (`*.wixdns.net`, Wix IPs `185.230.63.*`, etc.).

> **⚠️ The gotcha that cost us time once already:** if the domain is still *connected to a
> Wix site* (even a blank placeholder site), **Wix silently restores its own A records**,
> which yanks the domain back to Wix and can resurface Wix branding in link previews.
> The fix is to fully disconnect: **Wix dashboard → Domains → ⋯ → Disconnect from site**
> (the domain remains registered at Wix; only the site-builder attachment is removed).
> After disconnecting, re-check the DNS records once more — then they'll stick.

DNS propagation after changes is usually minutes but can take up to 24–48 h. Check with
`dig bluestemadvisoryllc.com +short` — it should return `75.2.60.5`.

### Alternative: hand DNS to Netlify entirely

Instead of managing records in Wix, you can use **Netlify DNS**: Netlify → Domain
management → add the domain → Netlify shows four `dnsX.p0X.nsone.net` nameservers → paste
those into Wix under **Domains → ⋯ → Transfer away? No — "Use custom nameservers."**
Then all records live in Netlify and the Wix auto-restore issue disappears permanently.
Either approach works; custom nameservers is the more durable one.

---

## Link previews (iMessage / social)

Both pages carry Open Graph + Twitter card tags pointing at
`https://bluestemadvisoryllc.com/og-image.png`. If a stale preview (e.g. the old Wix
logo) still shows when texting the link, it's the messaging app's cache — previews
refresh when the link is shared to a new conversation, or over time. Facebook/LinkedIn
caches can be force-refreshed with their sharing debugger tools.

## Editing checklist

1. Edit `site/index.html` / `site/about.html` directly (single-file pages).
2. If nav links change, update them in **both** files (each page has its own nav + mobile menu).
3. Deploy via Option A or push via Option B.
4. Spot-check: hero illustration, depth ruler, mobile menu, `/about` link, favicon in tab.

## The two things the site sends to Rootbook (2026-08-16)

Both go through Netlify Functions in `netlify/functions/`, which share `netlify/lib/relay.js`:
honeypot, hashed visitor IP (never the raw address), HMAC-SHA256 over the exact bytes with
`SITE_INQUIRY_SECRET`, forward to Rootbook, redirect. Nothing is stored on Netlify. Env vars
(Netlify → Site configuration → Environment variables): `SITE_INQUIRY_SECRET` (same value as
Rootbook's `.env`) and `ROOTBOOK_INQUIRY_URL`; the assessment target is derived from the latter.

- **The inquiry form** (`#contact` on the homepage → `functions/inquiry.js` → Rootbook
  `POST /api/site/inquiry`, IMPROVEMENTS 56). Plain HTML form; the mailto stays beside it as
  the fallback; `/thanks` afterwards. Live since 2026-08-16.
- **The self-assessment** (`/assessment` → `functions/assessment.js` → Rootbook
  `POST /api/site/assessment`, IMPROVEMENTS 57). Two parts of five questions, four concrete
  answers each, three bands per part: **part one** (`/assessment`, v4 — is the plan alive?)
  and **Go deeper** (`/assessment/deeper`, v4d — the ground under it), offered on part one's
  result page; the band on screen at `/assessment/<band>`, the written version emailed by
  Rootbook. **Rootbook's `src/assessment.js` is the authority on the wording and the scoring.**
  The site's copy is `content/assessment.v4.json` + `v4d.json`, generated from it, and
  `scripts/build-assessment.js` renders both quiz pages + the six result pages + the
  starting-fresh page — edit the JSON only by regenerating (the loop is in the script's
  header), then run the script and commit the outputs. Works with JavaScript off (the whole
  form renders stacked); the page's script only makes it one question at a time, remembers
  who part one was for (sessionStorage) so part two never asks again (its who-step stays in the
  form, unseen), reads part two WITH part one when Rootbook answers `combined` (the result page
  draws all ten on the original thresholds — `?cs=&cm=&ca=&cb=`), and — on "we don't have a
  strategic plan" — offers to skip the questions and just be called (`skipped=1`; Rootbook
  refuses it on any other opener). `?t=1` on a result page (they asked to be called) hides
  the "write to us" line. Approved and public since 2026-08-17 (v3 wording; halved to v4/v4d
  the same day; linked from *Start at the root* on the homepage; result pages stay
  `noindex`). The score is drawn as a root system by `site/scoreviz.js`, a verbatim
  copy of Rootbook's `src/scoreviz.js` (the same drawing goes into the write-up email).
