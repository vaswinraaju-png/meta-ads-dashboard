# Ads Dashboard (White-Label)

A generic, agency-configurable Meta Ads + Social dashboard. **No backend required** — it's a static site that calls the Facebook Graph API directly from the browser.

## How it works
1. Open the dashboard in your browser (locally, on Vercel, or embedded in your CRM/site — any static host works).
2. Go to **Settings** (gear icon in the sidebar).
3. Paste in:
   - **Access Token** — a Meta access token with `ads_read`, `read_insights`, `pages_read_engagement`, `instagram_basic` scopes as needed
   - **Ad Account ID** (e.g. `act_1234567890`)
   - **Facebook Page ID**
   - **Instagram Business Account ID**
4. Click **Save**. The dashboard now works — Overview, Creatives, and Social all call the Graph API directly using this token.

## Where the token lives
Saved only in that browser's `localStorage`, under the key `wl_meta_keys_v1`. It is **never sent anywhere except directly to `graph.facebook.com`**. There is no server component, no database, nothing to configure on a backend.

**Security note:** because there's no backend, the token is visible in that browser's DevTools (Application → Local Storage) to anyone with access to that device. This is appropriate for a marketer using their own browser/device to manage their own ad account — it is **not** appropriate for handing this URL to untrusted third parties, since they'd be able to read the token out of storage. Use a token scoped to only what's needed, and rotate it if the browser/device is shared or compromised.

## Deploying
Because it's fully static (`index.html` + `css/` + `js/`), you can:
- Drop the folder into any static host (Vercel, Netlify, GitHub Pages, S3, etc.)
- Or serve it from inside an existing CRM/app as a static bundle/iframe

No environment variables, no build step, no server code needed.

## White-labeling for a new client
Edit `config/brand.config.js` only:
- `agencyName`, `productName`, `logoUrl`, `favicon`
- `colors` — full palette, applied via CSS variables at runtime
- `fonts` — display/body/mono font families + Google Fonts import URL

No other file should need edits for a rebrand.

## Structure
```
config/brand.config.js   — all white-label settings
css/base.css              — resets, CSS variable defaults
css/layout.css            — sidebar, top bar, section tabs, toolbar
css/components.css        — stat tiles, tables, creative grid, social panels
js/core.js                 — state, direct Graph API fetch, filters, formatters
js/pages/settings.js       — credential entry (localStorage)
js/pages/overview.js
js/pages/creatives.js
js/pages/social.js
index.html                 — shell
```

## Notes
- UI intentionally mirrors Meta Ads Manager's own layout (sidebar nav, dense tables, status dots) so users familiar with Ads Manager feel at home immediately.
- Program/category tagging, CRM matching, Optimization/AI-recommendations, and Admin user management were removed per scope — not ported.
- Facebook Page-level insights (and the inbox) require a **Page Access Token**, which the dashboard automatically exchanges for using your saved token (calling `/{page_id}?fields=access_token`) — this requires your token to have `pages_show_list` / `pages_read_engagement` permission on that Page.
