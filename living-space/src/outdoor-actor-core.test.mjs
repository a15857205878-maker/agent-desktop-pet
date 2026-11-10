import test from 'node:test';
import assert from 'node:assert/strict';
import {removeConnectedWhite,poseFade} from './outdoor-actor-core.mjs';
test('background matte keeps enclosed white artwork opaque',()=>{
 const rgba=new Uint8ClampedArray(7*7*4).fill(255);
 for(let y=1;y<6;y++)for(let x=1;x<6;x++)if(x===1||x===5||y===1||y===5){const i=(y*7+x)*4;rgba[i]=30;rgba[i+1]=25;rgba[i+2]=40;}
 removeConnectedWhite(rgba,7,7);
 assert.equal(rgba[3],0);assert.equal(rgba[(3*7+3)*4+3],255);assert.equal(rgba[(1*7+1)*4+3],255);
});
test('fade changes pose only while invisible and respects endpoints',()=>{
 assert.deepEqual(poseFade(0),{swap:false,opacity:1});
 assert.equal(poseFade(.5).opacity,0);assert.equal(poseFade(.5).swap,true);
 assert.deepEqual(poseFade(1),{swap:true,opacity:1});
});
