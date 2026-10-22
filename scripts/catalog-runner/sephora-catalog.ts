// The public US makeup listing embeds its catalog in an inert JSON script.
// Read data only: never execute downloaded JavaScript or infer unreported stock.
const ORIGIN = 'https://www.sephora.com';
export const SEPHORA_CATEGORY = '/shop/makeup-cosmetics';
type Row = Record<string, unknown>;
type Cursor = {page: number; total: number; size: number; signatures: string[]};
const record = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown) => typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, 600) : '';

function image(value: unknown) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    return url.origin === ORIGIN && url.pathname.startsWith('/productimages/') && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
function amount(value: unknown) {
  if (typeof value !== 'string') return null;
  // Preserve ranges as ranges. Dollar strings are from the US catalog only.
  const match = /^\$(\d[\d,]*(?:\.\d{2})?)(?:\s*[-–]\s*\$(\d[\d,]*(?:\.\d{2})?))?$/.exec(value.trim());
  if (!match) return null;
  const min = Number(match[1].replaceAll(',', ''));
  const max = match[2] ? Number(match[2].replaceAll(',', '')) : min;
  return Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max >= min ? {min, max} : null;
}
export function normalizeSephora(value: unknown) {
  const p = record(value), sku = record(p.currentSku);
  if (typeof p.productId !== 'string' || !/^P\d+$/.test(p.productId) || !text(p.displayName)) throw Error('Sephora returned an invalid product record. Saved products were kept.');
  if (typeof p.targetUrl !== 'string') throw Error('Sephora omitted a product URL.');
  const url = new URL(p.targetUrl, ORIGIN);
  if (url.origin !== ORIGIN || !url.pathname.startsWith('/product/') || !url.pathname.endsWith('-' + p.productId) || url.username || url.password) throw Error('Sephora returned an unexpected product URL.');
  // Use a stable product URL rather than a selected SKU that can change on refresh.
  url.search = ''; url.hash = '';
  const hasSale = sku.salePrice != null && sku.salePrice !== '';
  const price = amount(hasSale ? sku.salePrice : sku.listPrice);
  if (!price) throw Error('Sephora did not supply a readable USD price. The import is incomplete; saved products were kept.');
  const images = [...new Set([p.heroImage, p.altImage].map(image).filter(Boolean))];
  return {
    id: 'sephora:' + p.productId, retailer: 'Sephora', url: url.href,
    title: text(p.displayName), brand: text(p.brandName), category: 'Makeup',
    description: '', price: price.min, price_max: price.max, currency: 'USD',
    images, variants: [], sku: text(sku.skuId),
    availability: sku.isOutOfStock === true ? 'OutOfStock' : sku.isOutOfStock === false ? 'InStock' : 'Unknown',
    fetched_at: new Date().toISOString(), method: 'Sephora public US makeup catalog',
    warnings: ['Category listing: descriptions, shade-specific prices, full variants, and stock may be incomplete.', ...(!images.length ? ['No product image was supplied by this listing.'] : [])],
  };
}

export function parseSephoraCategory(html: string, expectedPage: number) {
  // Dollar signs alone do not distinguish USD from CAD. Read the page's own
  // locale declaration as JSON, without evaluating its surrounding script.
  const locale = /Sephora\.renderQueryParams\s*=\s*(\{[^;]*\})\s*;/.exec(html);
  try {
    if (!locale || record(JSON.parse(locale[1])).country !== 'US') throw Error();
  } catch { throw Error('Sephora did not confirm a US catalog locale. Saved products were kept.'); }
  const script = /<script\b[^>]*\bid\s*=\s*(["'])linkStore\1[^>]*>([\s\S]*?)<\/script\s*>/i.exec(html);
  if (!script) throw Error('Sephora returned no readable catalog data or an access check. Saved products were kept.');
  let root: Row;
  try { root = record(JSON.parse(script[2])); } catch { throw Error('Sephora returned unreadable catalog JSON.'); }
  const category = record(record(root.page).nthCategory);
  const page = category.currentPage ?? 1, total = category.totalProducts, size = category.pageSize;
  if (category.categoryId !== 'cat140006' || category.targetUrl !== SEPHORA_CATEGORY || page !== expectedPage ||
      !Number.isSafeInteger(total) || Number(total) <= 0 || !Number.isSafeInteger(size) || Number(size) <= 0 || Number(size) > 100 ||
      !Array.isArray(category.products)) throw Error('Sephora pagination changed. The import is incomplete; saved products were kept.');
  const expectedCount = Math.min(Number(size), Number(total) - (expectedPage - 1) * Number(size));
  if (expectedCount <= 0 || category.products.length !== expectedCount) throw Error('Sephora returned an incomplete catalog page. Saved products were kept.');
  const products = category.products.map(normalizeSephora);
  const signature = products.map(p => p.id).sort().join('|');
  if (new Set(products.map(p => p.id)).size !== products.length) throw Error('Sephora repeated products within a catalog page. Saved products were kept.');
  return {products, total: Number(total), size: Number(size), signature, done: expectedPage * Number(size) >= Number(total)};
}

export async function sephoraPage(previous: string | null, fetchImpl: typeof fetch = fetch) {
  let cursor: Cursor = {page: 1, total: 0, size: 0, signatures: []};
  if (previous) {
    try { cursor = JSON.parse(previous); } catch { throw Error('Invalid Sephora refresh cursor. Start a new refresh.'); }
  }
  if (!cursor || !Number.isSafeInteger(cursor.page) || cursor.page < 1 || cursor.page > 500 ||
      !Number.isSafeInteger(cursor.total) || cursor.total < 0 || !Number.isSafeInteger(cursor.size) || cursor.size < 0 ||
      !Array.isArray(cursor.signatures) || !cursor.signatures.every(s => typeof s === 'string')) throw Error('Invalid Sephora refresh cursor.');
  const url = new URL(SEPHORA_CATEGORY, ORIGIN);
  if (cursor.page > 1) url.searchParams.set('currentPage', String(cursor.page));
  const response = await fetchImpl(url.href, {
    redirect: 'manual', signal: AbortSignal.timeout(25000),
    headers: {Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'MerchCurator/1.0 (catalog importer)'},
  });
  if (!response.ok) throw Error(`Sephora returned HTTP ${response.status}. Saved products were kept.`);
  if (!/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type') ?? '')) throw Error('Sephora did not return a catalog page.');
  const reader = response.body?.getReader();
  if (!reader) throw Error('Sephora returned an empty response.');
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const next = await reader.read(); if (next.done) break;
    length += next.value.length;
    if (length > 3_000_000) { await reader.cancel(); throw Error('Sephora returned an oversized page.'); }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const result = parseSephoraCategory(new TextDecoder().decode(bytes), cursor.page);
  if (cursor.total && (cursor.total !== result.total || cursor.size !== result.size)) throw Error('Sephora changed its catalog size during refresh. Retry the refresh; saved products were kept.');
  if (cursor.signatures.includes(result.signature)) throw Error('Sephora repeated a catalog page. The import stopped; saved products were kept.');
  return {
    products: result.products, done: result.done,
    cursor: JSON.stringify({page: cursor.page + 1, total: result.total, size: result.size, signatures: [...cursor.signatures, result.signature]}),
  };
}
