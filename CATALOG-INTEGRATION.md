# Automatic fake-shop catalog

The curator remains the editor and live D1 database. The shop reads a versioned
JSON database at `Claude_Coding/fakeshop/data/catalog.json`. GitHub Pages serves
that file alongside the shop, so the browser needs no GitHub credential or CORS
exception. It is a catalog snapshot, not a backup of the private D1 database.

## Refresh flow

1. Complete a curator store refresh, import saved pages, edit a product, or hide it.
2. The curator publishes visible, current products (including manual overrides)
   through GitHub's Contents API to `emily204/Claude_Coding`, branch
   `claude/mobile-shopping-fake-checkout-xr38pd`.
3. The existing Pages workflow deploys the updated JSON file.
4. The shop checks on opening, every 60 seconds while visible, and when returning
   to the tab. A changed snapshot replaces its catalog. Existing cart IDs and
   saved addresses/orders remain. Updates wait while reviewing a cart, checking
   out, or editing the profile; returning to browsing applies the latest snapshot.

Use **Update fake shop** in the curator to publish the initial catalog or retry a
failed publication. Refresh/publication failures do not remove the shop's last
usable catalog. Publishing is blocked while any catalog job is running or has
failed; finish/retry those jobs before publishing to avoid incomplete snapshots.
GitHub write conflicts are reported instead of overwriting a competing update.
Publishing unchanged products does not create a new commit.

## One-time activation

- Merge/deploy this curator code to the existing Sites project. A GitHub commit
  does not update the hosted curator. Keep its project identity and D1 binding.
- Add `CATALOG_GITHUB_TOKEN` securely to the **deployed curator's** runtime. Use a
  fine-grained GitHub personal access token restricted to `emily204/Claude_Coding`
  with repository Contents read/write. Its writes must be allowed on the branch
  above and allowed to trigger the existing Pages workflow. Do not use a workflow
  `GITHUB_TOKEN` for this, because its pushes normally do not trigger workflows.
- Permit HTTPS to `api.github.com` where the curator runs. The Codex environment
  has a separate configuration draft for that hostname and credential binding;
  configuring Codex alone does not configure the hosted Site.
- The shop changes must be on its existing deployment branch. Its normal Pages
  workflow still requires the existing `SHOP_PASSWORD` secret.
- On the hosted curator, click **Update fake shop** once. This reads the real
  existing D1 listings; the source ZIP and this local environment have no copy.

No token belongs in either repository, browser JavaScript, or this document.
Snapshots contain only public product fields: source IDs, retailer, URL, title,
brand, category, description, price/currency, images, and availability. Hidden
items, refresh jobs, internal warnings, account details, carts, and orders are
not published. The Pages catalog has the same accessibility as other shop assets;
the shop's client-side password screen does not provide server-side file privacy.

## Empty catalog and filtering

The initial database has `exported_at: null`; the shop keeps its bundled sample
catalog until the first real publication. It contains no invented live listings.
An actual published empty snapshot clears the shop. An invalid/unreachable feed,
or a nonempty feed with no usable products, retains the last usable catalog.

The shop shows all eligible USD products with no per-store cap; unavailable,
unpriced, and unsupported-currency products are skipped. No exchange rate is
invented. Photos remain opt-in in the existing CLI importer. Imported product
IDs use the same conversion as before, preserving carts across price/name edits.

For a manual first seed, run the existing importer from `Claude_Coding`:

    node scripts/import-catalog.mjs /path/to/merch-catalog.json

It now writes both `fakeshop/products.js` and `fakeshop/data/catalog.json`.
Explicit currency conversion flags remain supported for the CLI-generated bundle;
the automatic feed intentionally accepts only USD until a shared rate policy is
configured. Do not expect a CLI exchange rate to affect automatic updates.

## Validation

- `node --test tests/catalog-github.test.mjs` in merch-curator
- `npm run build` in merch-curator
- `node --test tests/catalog.test.mjs` in Claude_Coding
- Browser checks: bundled fallback, changed catalog, stable cart IDs, checkout
  form and price preservation, deferred updates, offline retention, empty catalog.

The integration has been validated locally using explicit test fixtures, not
production listings. No production database backup or migration was performed.

## Source snapshots for hosted access denials

Sephora can return HTTP 403 to the hosted Cloudflare Worker even when its public
listing is readable from another environment. Jellycat has also been added as a
US shop-all source. A source refresh tries the store directly; on the first
page's 403/429 or network failure, it can read a recent complete source snapshot
from this repository's `fakeshop/data/source-catalogs/{store}.json` via the public
raw.githubusercontent.com URL. It imports only that store into the curator's
existing D1 database. It never replaces the curator's complete catalog with a
source snapshot, so other stores' saved products remain intact.

The `Refresh source catalogs` workflow runs daily and can be dispatched manually.
It uses the repository's built-in Actions token with Contents write permission;
no additional personal token is needed to write snapshots in this repository.
Its collector installs only the locked dependencies under `scripts/catalog-runner`.
Adapters there are copies of merch-curator/lib/sephora-catalog.ts and
jellycat-catalog.ts; update both copies together when changing source parsing.
The collector writes each snapshot atomically only after visiting all listing
pages with unique product IDs. Failed sources keep their previous snapshots and
the workflow reports failure. Successful sources can still be committed.

The curator rejects incomplete snapshots and snapshots older than 72 hours.
Snapshot timestamp changes in the middle of a refresh require a fresh retry.
Product import notes distinguish snapshot collection time from a direct import.
These files contain only public source product information, not D1 contents,
manual edits, hidden flags, customer information, or credentials. Neither the
collector nor the seed snapshots change `fakeshop/data/catalog.json`; the live
curator remains responsible for publishing its combined visible catalog there.

A push made with the built-in Actions token does not trigger the shop's Pages
workflow; that is intentional here. The hosted curator reads the raw GitHub
snapshot directly, so a source-snapshot update requires no Pages deployment.
The collector runner's access must be verified independently: if a store also
rejects GitHub Actions, automatic collection of that source is still blocked.
