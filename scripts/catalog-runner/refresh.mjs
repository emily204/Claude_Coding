// These adapters are vendored from merch-curator/lib; update both copies together.
import {sephoraPage} from './sephora-catalog.ts';
import {jellycatPage} from './jellycat-catalog.ts';
import {mkdir, writeFile, rename, unlink} from 'node:fs/promises';

const directory = new URL('../../fakeshop/data/source-catalogs/', import.meta.url);
await mkdir(directory, {recursive: true});
const only = process.argv[2];
if (only && !['sephora', 'jellycat'].includes(only)) throw Error('Choose sephora or jellycat.');
for (const [store, loadPage] of Object.entries({sephora: sephoraPage, jellycat: jellycatPage})) {
  if (only && store !== only) continue;
  const temporary = new URL(store + '.json.tmp', directory);
  try {
    let cursor = null, complete = false;
    const products = new Map();
    for (let page = 1; page <= 500; page++) {
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
    const snapshot = {schema_version: 1, source: store, complete: true, fetched_at: new Date().toISOString(), total: products.size, products: [...products.values()]};
    await writeFile(temporary, JSON.stringify(snapshot) + '\n');
    await rename(temporary, new URL(store + '.json', directory));
    console.log(`${store}: complete snapshot saved (${products.size} products)`);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    console.error(`${store}: ${error.message}`);
    process.exitCode = 1;
  }
}
