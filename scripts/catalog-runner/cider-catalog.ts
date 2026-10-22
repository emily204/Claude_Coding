type Row = Record<string, unknown>;
const row = (v: unknown): Row => v && typeof v === 'object' && !Array.isArray(v) ? v as Row : {};
const text = (v: unknown) => typeof v === 'string' ? v.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 600) : '';
export function normalizeCider(value: unknown) {
  const p = row(value), id = p.productId;
  if (!Number.isSafeInteger(id) || Number(id) <= 0 || !text(p.productName) || typeof p.productUniqueName !== 'string' || !/^[a-z0-9-]+$/i.test(p.productUniqueName)) throw Error('Cider returned an invalid product identity: '+String(id)+' / '+text(p.productUniqueName));
  const styles = Array.isArray(p.productStyle) ? p.productStyle.map(row) : [];
  const prices = styles.map(s => typeof s.salePriceUS === 'number' ? s.salePriceUS : typeof s.salePriceUS === 'string' && /^\d+(?:\.\d+)?$/.test(s.salePriceUS) ? Number(s.salePriceUS) : NaN).filter(n => Number.isFinite(n) && n >= 0);
  if (!prices.length) throw Error('Cider did not provide an explicit USD price.');
  const images: string[] = [];
  for (const style of styles) for (const value of [style.thumbImage, style.styleImage]) {
    if (typeof value !== 'string') continue;
    try {const u = new URL(value); if (u.protocol === 'https:' && u.hostname.endsWith('.shopcider.com') && !u.username && !u.password) images.push(u.href);} catch { /* Missing image. */ }
  }
  return {id: 'cider:' + id, retailer: 'Cider', url: 'https://www.shopcider.com/goods/' + p.productUniqueName, title: text(p.productName), brand: 'Cider', category: 'Clothing', description: '', price: Math.min(...prices), price_max: Math.max(...prices), currency: 'USD', images: [...new Set(images)].slice(0, 1), variants: [], availability: p.soldOut === 1 ? 'OutOfStock' : p.soldOut === 0 ? 'InStock' : 'Unknown', sku: '', fetched_at: new Date().toISOString(), method: 'Cider public clothing listing', warnings: ['Public clothing selection, which may be smaller than the advertised catalog; full variants and descriptions may differ.']};
}
export function parseCiderListing(value: unknown, expectedPage: number) {
  const data = row(value), paging = row(data.pageInfo);
  const products = Array.isArray(data.productList) ? data.productList : data.list;
  if (data.collectionId !== 12 || !Array.isArray(products) || paging.currentPage !== expectedPage || !Number.isSafeInteger(paging.totalPage) || Number(paging.totalPage) < expectedPage || Number(paging.totalPage) > 500 || !Number.isSafeInteger(paging.totalSize) || Number(paging.totalSize) <= 0 || ![0, 1].includes(Number(paging.isBottom)) || !products.length || products.length > 100) throw Error('Cider returned incomplete or unexpected clothing pagination.');
  const done = paging.isBottom === 1;
  if (!done && expectedPage === paging.totalPage) throw Error('Cider pagination did not confirm its final page.');
  const normalized = products.map(normalizeCider);
  if (new Set(normalized.map(p => p.id)).size !== normalized.length) throw Error('Cider repeated products within a page.');
  return {products: normalized, done, total: Number(paging.totalSize), totalPages: Number(paging.totalPage)};
}
export function parseCiderInitial(html: string) {
  const start = /window\.__INITIAL_STATE__\s*=\s*/.exec(html);
  if (!start) throw Error('Cider did not supply a readable initial catalog.');
  const offset = start.index + start[0].length; let depth = 0, quoted = false, escaped = false;
  for (let i = offset; i < html.length; i++) {
    const c = html[i];
    if (quoted) {if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false;}
    else if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {const root = row(JSON.parse(html.slice(offset, i + 1))); return parseCiderListing(row(row(root.storeState).categoryList), 1);}
  }
  throw Error('Cider returned incomplete initial catalog JSON.');
}
