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

### Option A — drag-and-drop deploy (current workflow)

1. Log in to Netlify → open the site → **Deploys** tab.
2. Drag the **`site/` folder** (the folder itself, not the repo root) into the drop zone.
3. Wait ~1 minute for the deploy to go live. Nothing else to configure.

Every drag-and-drop is a full replacement deploy. Netlify keeps deploy history, so a bad
deploy can be instantly rolled back from the Deploys tab (**⋯ → Publish deploy** on any
older entry).

### Option B — Git-connected deploy (recommended once this repo lives on GitHub)

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
