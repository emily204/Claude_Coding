// These adapters are vendored from merch-curator/lib; update both copies together.
import {calvinKleinPage} from './calvinklein-catalog.ts';
import {sephoraPage} from './sephora-catalog.ts';
import {jellycatPage} from './jellycat-catalog.ts';
import {mkdir, writeFile, rename, unlink} from 'node:fs/promises';

const directory = new URL('../../fakeshop/data/source-catalogs/', import.meta.url);
await mkdir(directory, {recursive: true});
const only = process.argv[2] === 'all' ? undefined : process.argv[2];
if (only && !['sephora', 'jellycat', 'cider', 'calvinklein'].includes(only)) throw Error('Choose sephora, jellycat, cider or calvinklein.');
for (const [store, loadPage] of Object.entries({calvinklein: calvinKleinPage, sephora: sephoraPage, jellycat: jellycatPage, cider: null})) {
  if (only && store !== only) continue;
  const temporary = new URL(store + '.json.tmp', directory);
  try {
    let cursor = null, complete = false, coverage;
    const products = new Map();
    if (store === 'cider') {
      const {collectCider} = await import('./cider-browser.mjs');
      const result = await collectCider();
      for (const product of result.products) products.set(product.id, product);
      coverage = result.coverage;
      complete = true;
    }
    for (let page = 1; page <= 500 && !complete; page++) {
      const result = await loadPage(cursor);
      for (const product of result.products) {
        if (products.has(product.id)) throw Error('A product repeated across listing pages; previous snapshot kept.');
        products.set(product.id, product);
      }
      if (page % 10 === 0 || result.done) console.log(`${store}: page ${page}, ${products.size} products`);
      cursor = result.cursor;
      if (result.done) {complete = true; break;}
    }
    if (!complete || !products.size) throw Error('Source refresh did not finish; previous snapshot kept.');
    const snapshot = {schema_version: 1, source: store, complete: true, fetched_at: new Date().toISOString(), total: products.size, ...(coverage?{coverage}:{}), products: [...products.values()]};
    const json = JSON.stringify(snapshot) + '\n';
    if (Buffer.byteLength(json) > 10_000_000) throw Error('Source snapshot exceeds the curator size limit. Previous snapshot kept.');
    await writeFile(temporary, json);
    await rename(temporary, new URL(store + '.json', directory));
    console.log(`${store}: complete snapshot saved (${products.size} products)`);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    console.error(`${store}: ${error.message}`);
    process.exitCode = 1;
  }
}
