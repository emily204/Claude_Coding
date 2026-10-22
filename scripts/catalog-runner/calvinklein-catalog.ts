import {DOMParser} from 'linkedom';
import {fetchPage, clean} from './calvinklein-http.ts';
const ORIGIN = 'https://www.calvinklein.us';
const ROOT = ORIGIN + '/en/women';
const GRID = '/on/demandware.store/Sites-PVHCKUS-Site/en_US/Search-UpdateGrid';
type Cursor = {next: string; offset: number; currency: string; seen: string[]};

export function parseCalvinKlein(html: string, offset: number, currency = '') {
 const doc = new DOMParser().parseFromString(html, 'text/html');
 if (!offset) {
  const data = JSON.parse(doc.querySelector('[data-tealium-view]')?.getAttribute('data-tealium-view') || 'null');
  if (!Array.isArray(data) || data[0]?.site_country !== 'us' || data[0]?.site_currency_code !== 'USD') throw Error('Calvin Klein did not confirm US prices.');
  currency = 'USD';
 }
 if (currency !== 'USD') throw Error('Calvin Klein currency could not be confirmed.');
 const cards = [...doc.querySelectorAll('.product[data-pid]')];
 const footer = doc.querySelector('.grid-footer');
 const nextInput = footer?.querySelector('input[name="urlshowmore"]');
 if (!cards.length || cards.length > 100 || !footer || !nextInput || footer.querySelector('.category-id')?.getAttribute('value') !== 'Tier_0000002') throw Error('Calvin Klein returned an incomplete women’s catalog page.');
 const indices = [...doc.querySelectorAll('[data-productindex]')].map(el => Number(el.getAttribute('data-productindex')));
 if (indices.length !== cards.length || indices.some((value, index) => value !== offset + index + 1)) throw Error('Calvin Klein did not return the requested product range.');
 const products = cards.map(card => {
  const id = card.getAttribute('data-pid') || '';
  const link = card.querySelector('.pdp-link a');
  const url = new URL(link?.getAttribute('href') || '', ORIGIN);
  url.search = ''; url.hash = '';
  const title = clean(link?.textContent);
  const productId = url.pathname.split('/').at(-1)?.replace(/\.html$/, '') || '';
  const values = [...card.querySelectorAll('.price .sales .value[content]')].map(el => el.getAttribute('content') || '');
  if (!values.length) {
   const range = clean(card.querySelector('.price .range')?.textContent).match(/^\$([\d,]+(?:\.\d{2})?)\s*[-–]\s*\$([\d,]+(?:\.\d{2})?)$/);
   if (range) values.push(range[1].replaceAll(',', ''),range[2].replaceAll(',', ''));
  }
  if (!/^[a-z0-9_-]+$/i.test(id) || !title || url.origin !== ORIGIN || !url.pathname.startsWith('/en/') || !/^[a-z0-9_-]+\.html$/i.test(url.pathname.split('/').at(-1) || '') || !values.length || values.some(value => !/^\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(Number(value)))) throw Error('Calvin Klein returned an invalid product or price.');
  const media = JSON.parse(card.querySelector('[data-product-image-attr]')?.getAttribute('data-product-image-attr') || '{}').product;
  const images = [...new Set<string>((Array.isArray(media?.images) ? media.images : []).flatMap((image: {url?: string}) => {
   try { const u = new URL(image.url || ''); return u.protocol === 'https:' && u.hostname === 'calvinklein.scene7.com' ? [u.href] : []; } catch { return []; }
  }))].slice(0,40);
  let category = ''; try { category = clean(JSON.parse(card.querySelector('[data-category]')?.getAttribute('data-category') || '{}').product_merch_category); } catch { /* Optional category only. */ }
  return {id:'calvinklein:' + productId, retailer:'Calvin Klein', url:url.href, title, brand:'Calvin Klein', category, description:'', price:Math.min(...values.map(Number)), price_max:Math.max(...values.map(Number)), currency, images, variants:[], availability:media?.available === true ? 'InStock' : media?.available === false ? 'OutOfStock' : 'Unknown', sku:id, fetched_at:new Date().toISOString(), method:'Public US women’s catalog', warnings:['Listing prices and stock only; sizes and cart promotions are not included.']};
 });
 const value = nextInput.getAttribute('value');
 let next = '';
 if (value) {
  const u = new URL(value, ORIGIN);
  if (u.origin !== ORIGIN || u.pathname !== GRID || u.username || u.password || u.searchParams.get('cgid') !== 'Tier_0000002' || Number(u.searchParams.get('start')) !== offset + cards.length || u.searchParams.get('srule') !== 'featured' || Number(u.searchParams.get('sz')) !== 16) throw Error('Calvin Klein returned invalid pagination.');
  next = u.href;
 }
 return {products:[...new Map(products.map(p => [p.id,p])).values()], next, currency, offset:offset + cards.length};
}
export async function calvinKleinPage(previous: string | null) {
 const cursor: Cursor = previous ? JSON.parse(previous) : {next:ROOT, offset:0, currency:'', seen:[]};
 const u = new URL(cursor.next);
 if (u.origin !== ORIGIN || u.username || u.password || (cursor.offset ? u.pathname !== GRID || Number(u.searchParams.get('start')) !== cursor.offset || u.searchParams.get('cgid') !== 'Tier_0000002' : u.href !== ROOT)) throw Error('Invalid Calvin Klein refresh cursor.');
 const response = await fetchPage(u.href, 'text/html', AbortSignal.timeout(25000));
 if (new URL(response.url).origin !== ORIGIN) throw Error('Calvin Klein redirected outside its US store.');
 const page = parseCalvinKlein(response.text, cursor.offset, cursor.currency);
 const products = page.products.filter(p => !cursor.seen.includes(p.id));
 return {products, done:!page.next, cursor:JSON.stringify({next:page.next, offset:page.offset, currency:page.currency, seen:[...cursor.seen,...page.products.map(p => p.id)]})};
}
