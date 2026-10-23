import test from 'node:test';
import assert from 'node:assert/strict';
import {convertCatalog} from '../fakeshop/catalog-core.mjs';
import {mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const product = {id: 'alo:1', title: 'A shirt', retailer: 'ALO', price: 30, currency: 'USD', images: ['https://example.com/shirt.jpg'], availability: 'InStock'};
const feed = products => ({schema_version: 1, products});
test('preserves stable IDs through price/title changes', () => {
  const first = convertCatalog(feed([product])).products[0];
  const next = convertCatalog(feed([{...product, title: 'New name', price: 40}])).products[0];
  assert.equal(first.id, next.id); assert.equal(next.price, 40); assert.equal(first.cat, 'Fashion');
});
test('filters stock, missing prices, and unknown currencies without inventing exchange rates', () => {
  const {products, skipped} = convertCatalog(feed([
    product, {...product, id: '2', availability: 'OutOfStock'}, {...product, id: '3', price: null},
    {...product, id: '4', currency: 'KRW'}, {...product, id: '5', currency: ''},
  ]));
  assert.equal(products.length, 1); assert.equal(skipped.outOfStock, 1); assert.equal(skipped.noPrice, 1); assert.equal(skipped.currency, 2);
});
test('browser conversion keeps every eligible item, CLI can limit and convert currencies', () => {
  const data = feed(Array.from({length: 65}, (_, i) => ({...product, id: `alo:${i}`})));
  assert.equal(convertCatalog(data).products.length, 65);
  assert.equal(convertCatalog(data, {perStore: 40}).products.length, 40);
  assert.equal(convertCatalog(feed([{...product, currency: 'KRW', price: 10000}]), {rates: {KRW: 0.00072}}).products[0].price, 7.2);
});
test('rejects malformed exports, supports deliberate empty snapshots and optional HTTPS photos', () => {
  assert.throws(() => convertCatalog({products: []}), /schema/);
  assert.deepEqual(convertCatalog(feed([])).products, []);
  assert.equal(convertCatalog(feed([product])).products[0].img, undefined);
  assert.equal(convertCatalog(feed([product]), {withImages: true}).products[0].img, product.images[0]);
  assert.equal(convertCatalog(feed([{...product, images: ['javascript:alert(1)']}]), {withImages: true}).products[0].img, undefined);
});
test('CLI works with default arguments and writes both the bundle and repository database', () => {
  const root = mkdtempSync(join(tmpdir(), 'shop-import-test-'));
  try {
    mkdirSync(join(root, 'scripts')); mkdirSync(join(root, 'fakeshop/data'), {recursive: true});
    copyFileSync(new URL('../scripts/import-catalog.mjs', import.meta.url), join(root, 'scripts/import-catalog.mjs'));
    copyFileSync(new URL('../fakeshop/catalog-core.mjs', import.meta.url), join(root, 'fakeshop/catalog-core.mjs'));
    copyFileSync(new URL('../fakeshop/shop-categories.mjs', import.meta.url), join(root, 'fakeshop/shop-categories.mjs'));
    const input = join(root, 'export.json'); writeFileSync(input, JSON.stringify(feed([product])));
    const result = spawnSync(process.execPath, [join(root, 'scripts/import-catalog.mjs'), input], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    const database = JSON.parse(readFileSync(join(root, 'fakeshop/data/catalog.json'), 'utf8'));
    assert.equal(database.products[0].id, product.id); assert.ok(database.exported_at);
    assert.match(readFileSync(join(root, 'fakeshop/products.js'), 'utf8'), /A shirt/);
    const invalid = spawnSync(process.execPath, [join(root, 'scripts/import-catalog.mjs'), input, '--rate', 'KRW=0']);
    assert.notEqual(invalid.status, 0);
  } finally { rmSync(root, {recursive: true, force: true}); }
});
test('shop respects the curator category while retaining legacy store-based fallback',()=>{
 const data=feed([{...product,shop_category:'Other'},{...product,id:'2'}]);const converted=convertCatalog(data).products;
 assert.equal(converted.find(p=>p.id===convertCatalog(feed([{...product,shop_category:'Other'}])).products[0].id).cat,'Other');
 assert.equal(converted.find(p=>p.id===convertCatalog(feed([{...product,id:'2'}])).products[0].id).cat,'Fashion');
});
test('Nordstrom is excluded from all imported shop catalogs',()=>{
 const result=convertCatalog(feed([product,{...product,id:'nordstrom:1',retailer:'Nordstrom'}]));assert.equal(result.products.length,1);assert.equal(result.skipped.removedStore,1);
});
test('curator custom categories become shop categories without a fixed allowlist',()=>{
 const {products}=convertCatalog(feed([{...product,shop_category:'Weekend picks'},{...product,id:'2',shop_category:'Travel essentials'}]));
 assert.deepEqual(new Set(products.map(p=>p.cat)),new Set(['Weekend picks','Travel essentials']));
});
