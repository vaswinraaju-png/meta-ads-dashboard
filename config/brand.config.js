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
    primary:   "#0a0e17",   // Meta Ads Manager sidebar navy-black
    accent:    "#0866ff",   // Meta blue (links, CTAs)
    accent2:   "#0866ff",   // secondary accent, same blue family
    success:   "#31a24c",   // Meta "Active" status green
    warning:   "#f7b928",
    danger:    "#e41e3f",
    bg:        "#ffffff",
    surface:   "#f5f6f7",
    surface2:  "#ebedf0",
    border:    "#e4e6e9",
    border2:   "#ced0d4",
    text:      "#050505",
    muted:     "#65676b"
  },

  // Ads Manager uses a plain system sans everywhere — no display font
  fonts: {
    display: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
    body:    "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
    mono:    "'Roboto Mono',monospace"
  },

  fontImportUrl: "https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500&display=swap"
};
