// ─────────────────────────────────────────────────────────────
// BRAND CONFIG — edit this file to white-label the dashboard
// for a new client/agency. Nothing elsewhere should need touching.
// ─────────────────────────────────────────────────────────────
window.BRAND = {
  agencyName: "Your Agency",
  productName: "Ads Dashboard",
  logoUrl: "logo.png",
  favicon: "logo.png",

  // Contact block shown in header/footer (optional — leave blank to hide)
  contact: {
    name: "",
    phone: "",
    whatsapp: "",
    email: ""
  },

  // Ad account / social IDs are pulled from /api/config at runtime,
  // this file only controls visual identity.

  colors: {
    primary:   "#141821",   // main dark surface (nav, headers)
    accent:    "#e8b64a",   // highlight / CTA color
    accent2:   "#4a90e2",   // secondary accent (links, active states)
    success:   "#2f9e44",
    warning:   "#e8590c",
    danger:    "#d0342c",
    bg:        "#ffffff",
    surface:   "#f6f7f9",
    surface2:  "#eceef2",
    border:    "#e1e4ea",
    border2:   "#c7ccd6",
    text:      "#181c25",
    muted:     "#8891a3"
  },

  fonts: {
    display: "'Sora', sans-serif",   // big numbers / headings
    body:    "'Inter', sans-serif",  // everything else
    mono:    "'JetBrains Mono', monospace" // figures / data
  },

  fontImportUrl: "https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
};
