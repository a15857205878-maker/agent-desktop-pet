import {test} from 'node:test';import assert from 'node:assert/strict';
import {createSceneMaskCache} from './scene-mask-cache.mjs';
test('moving overlays reuse the same scene raster while a changed pose or viewport captures again',()=>{
 let calls=0;const cache=createSceneMaskCache(()=>({runs:[[1,2,3]],edgePng:String(++calls)}));
 const first=cache.read('home:1000:740:front');
 for(let i=0;i<40;i++){const packet={...cache.read('home:1000:740:front'),overlays:[[i,2,i+30,20]]};assert.equal(packet.edgePng,first.edgePng);}
 assert.equal(calls,1);assert.notEqual(cache.read('home:1000:740:sit'),first);assert.equal(calls,2);cache.read('home:390:600:sit');assert.equal(calls,3);
 cache.clear();cache.read('home:390:600:sit');assert.equal(calls,4);
});
test('capture failure leaves previous raster valid and allows a subsequent retry',()=>{
 let fail=false;const cache=createSceneMaskCache(()=>{if(fail)throw Error('capture failed');return {edgePng:'valid'}});const old=cache.read('old');fail=true;assert.throws(()=>cache.read('new'));assert.equal(cache.read('old'),old);fail=false;assert.equal(cache.read('new').edgePng,'valid');
});
