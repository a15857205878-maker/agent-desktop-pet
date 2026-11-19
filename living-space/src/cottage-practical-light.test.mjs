import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {applyCottagePracticalLights} from './cottage-practical-light.mjs';

test('home practical light never leaks into plaza or orchard and returns without allocating lights',()=>{
 const porch=new THREE.PointLight(),window=new THREE.PointLight();const scene=new THREE.Scene();scene.add(porch,window);
 for(let i=0;i<20;i++){
  applyCottagePracticalLights(porch,window,true,true);assert.ok(porch.intensity>0&&window.intensity>0);
  applyCottagePracticalLights(porch,window,true,false);assert.equal(porch.visible,false);assert.equal(window.visible,false);assert.equal(porch.intensity,0);assert.equal(window.intensity,0);
 }
 applyCottagePracticalLights(porch,window,true,true);assert.ok(porch.visible&&window.visible);assert.deepEqual(scene.children,[porch,window]);
 applyCottagePracticalLights(porch,window,false,true);assert.equal(porch.intensity,0);assert.equal(window.intensity,0);
});

test('practical accents use warm local falloff and leave world ambient untouched',()=>{
 const porch=new THREE.PointLight(),window=new THREE.PointLight(),ambient=new THREE.HemisphereLight('#abcdee','#335544',.9);
 const before={sky:ambient.color.getHex(),ground:ambient.groundColor.getHex(),intensity:ambient.intensity};
 applyCottagePracticalLights(porch,window,true,true);
 assert.ok(porch.distance<3&&window.distance<2,'practical pools stay near their fixtures');
 for(const l of [porch,window]){assert.equal(l.decay,2);assert.ok(l.color.r>l.color.g&&l.color.g>l.color.b);}
 assert.deepEqual({sky:ambient.color.getHex(),ground:ambient.groundColor.getHex(),intensity:ambient.intensity},before);
});
