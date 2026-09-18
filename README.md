# Ads Dashboard (White-Label)

A generic, agency-configurable Meta Ads + Social dashboard. No client branding is hardcoded — everything visual lives in `config/brand.config.js`.

## Pages
- **Overview** — spend/lead KPIs, single monthly budget/lead target, campaign/adset/ad breakdown table, daily spend pacing chart.
- **Creatives** — ad creative grid with images, copy, and performance metrics.
- **Social** — Instagram + Facebook Page insights, posts/media tables, DM/inbox views.

## White-labeling for a new client
Edit `config/brand.config.js` only:
- `agencyName`, `productName`, `logoUrl`, `favicon`
- `contact` block (optional, currently unused in UI — wire in if needed)
- `colors` — full palette, applied via CSS variables at runtime
- `fonts` — display/body/mono font families + Google Fonts import URL

No other file should need edits for a rebrand.

## Backend dependencies (unchanged from original)
- `/auth/me`, `/auth/logout`
- `/api/config` — returns `{ account, fbPageId, igId }`
- `/api/meta-proxy` — proxies Facebook Graph API calls

## Structure
```
config/brand.config.js   — all white-label settings
css/base.css              — resets, CSS variable defaults
css/layout.css            — header, tab nav, control strip
css/components.css        — cards, tables, creative grid, social panels
js/core.js                 — state, fetch, filters, formatters
js/pages/overview.js
js/pages/creatives.js
js/pages/social.js
index.html                 — shell
```

## Notes
- Program/category tagging (e.g. product-line classification) has been removed — all metrics are account-wide.
- CRM matching, Optimization/AI-recommendations, and Admin user management were removed per scope — not ported.
- Notifications and Metabase sync were tied to removed features and are not included.
