import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeCatalog,decodeCatalog} from '../fakeshop/catalog-codec.mjs';
import {convertCatalog} from '../fakeshop/catalog-core.mjs';
import {catalogStatus} from '../scripts/make-catalog-status.mjs';
test('compressed catalogs preserve shop IDs, content and deployment timestamp',async()=>{
 const data={schema_version:1,exported_at:'2026-10-22T00:00:00Z',products:Array.from({length:1000},(_,i)=>({id:'alo:'+i,title:'Shirt '+i,description:'Materials and details. '.repeat(50),retailer:'ALO',price:12,currency:'USD',availability:'InStock',images:['https://example.com/'+i+'.jpg']}))};
 const envelope=JSON.parse(await encodeCatalog(data));assert.equal(envelope.encoding,'gzip-base64');
 const decoded=await decodeCatalog(envelope);assert.deepEqual(convertCatalog(decoded),convertCatalog(data));assert.deepEqual(catalogStatus(decoded),{schema_version:1,exported_at:data.exported_at,count:1000});
});
test('invalid compressed data is rejected and legacy placeholder catalogs still decode',async()=>{
 const placeholder={schema_version:1,exported_at:null,products:[]};assert.deepEqual(await decodeCatalog(placeholder),placeholder);
 await assert.rejects(decodeCatalog({schema_version:1,encoding:'gzip-base64',count:0,exported_at:'bad',data:''}));
});
