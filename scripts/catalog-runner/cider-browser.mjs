import {chromium} from 'playwright';
import {parseCiderInitial, parseCiderListing} from './cider-catalog.ts';

export async function collectCider() {
  const proxyValue = process.env.HTTPS_PROXY || process.env.https_proxy;
  const proxy = proxyValue ? new URL(proxyValue) : null;
  const browser = await chromium.launch({
    ...(process.env.CATALOG_CHROMIUM_PATH ? {executablePath: process.env.CATALOG_CHROMIUM_PATH} : {}),
    headless: true,
    ...(proxy ? {proxy: {server: proxy.origin, ...(proxy.username ? {username: decodeURIComponent(proxy.username), password: decodeURIComponent(proxy.password)} : {})}} : {}),
  });
  try {
    const context = await browser.newContext();
    const pages = new Map(); let failure, lastProgress = Date.now();
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (['image', 'font', 'media'].includes(request.resourceType())) {await route.abort(); return;}
      try {
        // Node's configured CA trust is used, without disabling TLS validation.
        // The browser retains its own anonymous cookies and generates requests.
        const response = await route.fetch({timeout: 30000});
        if (url.hostname === 'www.shopcider.com' && url.pathname === '/ms/product/v1/list/shortList' && url.searchParams.get('collectionId') === '12') {
          if (!response.ok()) throw Error(`Cider catalog returned HTTP ${response.status()}.`);
          const payload = await response.json();
          const page = Number(url.searchParams.get('page'));
          const parsed = parseCiderListing(payload.data, page);
          pages.set(page, parsed); lastProgress = Date.now();
          if (page % 10 === 0 || parsed.done) console.log(`cider: browser page ${page}/${parsed.totalPages}`);
        }
        await route.fulfill({response});
      } catch (error) {
        if (url.pathname === '/ms/product/v1/list/shortList') failure = error;
        await route.abort();
      }
    });
    const page = await context.newPage();
    const firstResponse = await page.goto('https://www.shopcider.com/category/clothing-cid-12', {waitUntil: 'domcontentloaded', timeout: 45000});
    if (!firstResponse?.ok()) throw Error(`Cider category returned HTTP ${firstResponse?.status()}.`);
    const first = parseCiderInitial(await firstResponse.text()); pages.set(1, first);
    const deadline = Date.now() + 25 * 60 * 1000;
    while (![...pages.values()].some(result => result.done)) {
      if (failure) throw failure;
      if (Date.now() > deadline || Date.now() - lastProgress > 90000) throw Error('Cider browser pagination stopped before the final page. Previous snapshot kept.');
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.mouse.wheel(0, 9000);
      await page.waitForTimeout(300);
    }
    const products = new Map();
    const terminal = [...pages.entries()].find(([,result])=>result.done)?.[0];
    if (!terminal) throw Error('Cider did not confirm the end of its public selection.');
    for (let n = 1; n <= terminal; n++) {
      const result = pages.get(n);
      if (!result || result.total !== first.total || result.totalPages !== first.totalPages) throw Error('Cider catalog size changed during collection.');
      for (const product of result.products) products.set(product.id, product);
    }
    if (!products.size) throw Error('Cider returned an empty public selection. Previous snapshot kept.');
    console.log(`cider: complete public selection, ${products.size} unique products across ${terminal} pages (advertised catalog: ${first.total})`);
    return {products:[...products.values()],coverage:{scope:'Public clothing selection',reported_total:first.total,collected:products.size,pages:terminal}};
  } finally {await browser.close();}
}
