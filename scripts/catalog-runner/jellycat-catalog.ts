import {DOMParser} from 'linkedom';
const ORIGIN = 'https://us.jellycat.com';
type Cursor = {page: number; signatures: string[]};
const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

export function parseJellycatCategory(html: string, expectedPage: number) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const active = doc.querySelector('.pagination [aria-current="page"]');
  const activeUrl = active?.getAttribute('href');
  if (!activeUrl || Number(new URL(activeUrl, ORIGIN).searchParams.get('page') ?? 1) !== expectedPage) throw Error('Jellycat did not confirm the requested catalog page. Saved products were kept.');
  const cards = [...doc.querySelectorAll('.productGrid article[data-test]')];
  if (!cards.length || cards.length > 100) throw Error('Jellycat returned no readable catalog products. Saved products were kept.');
  const products = cards.map(card => {
    const id = /^card-(\d+)$/.exec(card.getAttribute('data-test') ?? '')?.[1];
    const link = card.querySelector('.card-title a');
    const title = clean(link?.textContent), href = link?.getAttribute('href');
    if (!id || !title || !href) throw Error('Jellycat returned an incomplete product record.');
    const url = new URL(href, ORIGIN);
    if (url.origin !== ORIGIN || !/^\/[a-z0-9-]+\/$/i.test(url.pathname) || url.username || url.password) throw Error('Jellycat returned an unexpected product URL.');
    url.search = ''; url.hash = '';
    const priceText = clean(card.querySelector('[data-product-price-without-tax]')?.textContent);
    const match = /^\$([\d,]+(?:\.\d{2})?)\s+USD(?:\s*[-–]\s*\$([\d,]+(?:\.\d{2})?)\s+USD)?$/.exec(priceText);
    const price = match ? Number(match[1].replaceAll(',', '')) : NaN;
    const maximum = match?.[2] ? Number(match[2].replaceAll(',', '')) : price;
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(maximum) || maximum < price) throw Error('Jellycat did not supply a readable USD price.');
    const images = [...new Set([...card.querySelectorAll('img')].map(img => img.getAttribute('src') ?? '').filter(value => {
      try {const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'cdn11.bigcommerce.com' && u.pathname.startsWith('/s-23s5gfmhr7/') && !u.username && !u.password;} catch {return false;}
    }))].slice(0, 10);
    return {id: 'jellycat:' + id, retailer: 'Jellycat', url: url.href, title, brand: 'Jellycat', category: 'Plush & gifts', description: '', price, price_max: maximum, currency: 'USD', images, variants: [], availability: /out of stock|sold out/i.test(card.textContent ?? '') ? 'OutOfStock' : 'Unknown', sku: '', fetched_at: new Date().toISOString(), method: 'Jellycat public US shop-all catalog', warnings: ['Listing data: descriptions, full variants, stock and checkout prices may differ.']};
  });
  if (new Set(products.map(p => p.id)).size !== products.length) throw Error('Jellycat repeated products within a page.');
  const next = doc.querySelector('.pagination a[aria-label="Next"]')?.getAttribute('href');
  if (next) {
    const url = new URL(next, ORIGIN);
    if (url.origin !== ORIGIN || url.pathname !== '/shop-all' || [...url.searchParams.keys()].some(k => k !== 'page') || Number(url.searchParams.get('page')) !== expectedPage + 1) throw Error('Jellycat pagination left the expected catalog sequence.');
  }
  return {products, done: !next, signature: products.map(p => p.id).sort().join('|')};
}

export async function jellycatPage(previous: string | null, fetchImpl: typeof fetch = fetch) {
  let cursor: Cursor = {page: 1, signatures: []};
  if (previous) {try {cursor = JSON.parse(previous);} catch {throw Error('Invalid Jellycat refresh cursor.');}}
  if (!cursor || !Number.isInteger(cursor.page) || cursor.page < 1 || cursor.page > 500 || !Array.isArray(cursor.signatures) || !cursor.signatures.every(s => typeof s === 'string')) throw Error('Invalid Jellycat refresh cursor.');
  const url = new URL('/shop-all', ORIGIN); if (cursor.page > 1) url.searchParams.set('page', String(cursor.page));
  const response = await fetchImpl(url.href, {redirect: 'manual', signal: AbortSignal.timeout(25000), headers: {Accept: 'text/html', 'User-Agent': 'MerchCurator/1.0 (catalog importer)'}});
  if (!response.ok) throw Error(`Jellycat returned HTTP ${response.status}. Saved products were kept.`);
  if (!/text\/html/i.test(response.headers.get('content-type') ?? '')) throw Error('Jellycat did not return catalog HTML.');
  const reader = response.body?.getReader(); if (!reader) throw Error('Jellycat returned an empty page.');
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {const item = await reader.read(); if (item.done) break; length += item.value.length; if (length > 3_000_000) {await reader.cancel(); throw Error('Jellycat returned an oversized page.');} chunks.push(item.value);}
  const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.length;}
  const result = parseJellycatCategory(new TextDecoder().decode(bytes), cursor.page);
  if (cursor.signatures.includes(result.signature)) throw Error('Jellycat repeated a catalog page. Saved products were kept.');
  return {products: result.products, done: result.done, cursor: JSON.stringify({page: cursor.page + 1, signatures: [...cursor.signatures, result.signature]})};
}
