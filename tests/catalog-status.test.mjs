import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogStatus} from '../scripts/make-catalog-status.mjs';
test('deployment manifest uses the actual catalog version and source product count',()=>{
 const stamp='2026-10-22T20:00:00Z';assert.deepEqual(catalogStatus({schema_version:1,exported_at:stamp,products:[{},{}]}),{schema_version:1,exported_at:stamp,count:2});
 assert.deepEqual(catalogStatus({schema_version:1,exported_at:null,products:[]}),{schema_version:1,exported_at:null,count:0});
 for(const data of [{schema_version:2,exported_at:stamp,products:[]},{schema_version:1,exported_at:'bad',products:[]},{schema_version:1,exported_at:stamp,products:null}])assert.throws(()=>catalogStatus(data));
});
