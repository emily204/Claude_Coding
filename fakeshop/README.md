# PretendPay Shop

A mobile-first shopping app for the satisfaction of checking out without paying. No backend, no dependencies, and no real payments.

- Browse and search 18 products, filter by category, view details
- Cart with quantities, shipping and tax math
- Shipping address, billing address (or "same as shipping") and a fake credit card
- The fake card only keeps its last 4 digits; everything stays in your browser's localStorage
- Order history with a confetti confirmation
- Installable PWA (works offline once loaded), dark mode support

## Install on an Android phone (Chrome or Samsung Internet)

The repo deploys itself to GitHub Pages (`.github/workflows/pages.yml`). After a one-time setup
(Settings > Pages > Source: **GitHub Actions**), the app is served at
`https://<your-username>.github.io/Claude_Coding/`.

1. Open that address on your phone in Chrome.
2. Tap the three-dot menu, then **Add to Home screen** (or **Install app**).
3. Launch it from the home screen like any other app.

## Run locally

    cd fakeshop && python3 -m http.server 8000

Any card number of 13-19 digits with a future expiry and a 3-4 digit CVC works; tap "Fill a test card" for one.
