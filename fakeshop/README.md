# PretendPay Shop

A mobile-first shopping app for the satisfaction of checking out without paying. No backend, no dependencies, and no real payments.

- Browse and search 18 products, filter by category, view details
- Cart with quantities, shipping and tax math
- Shipping address, billing address (or "same as shipping") and a fake credit card
- The fake card only keeps its last 4 digits; everything stays in your browser's localStorage
- Order history with a confetti confirmation
- Installable PWA (works offline once loaded), dark mode support

## Run it

    cd fakeshop && python3 -m http.server 8000

Open http://localhost:8000 on your phone (same Wi-Fi, using your computer's IP) and choose "Add to Home Screen" to install it like an app.
Any card number of 13-19 digits with a future expiry and a 3-4 digit CVC works; tap "Fill a test card" for one.
