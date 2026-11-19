import {test} from 'node:test';import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMakerDistrictSurfaceTexture} from './maker-district-surfaces.mjs';
import {createTownDistrictFinish} from './town-district-finish.mjs';
test('actual MaterialMaker output exposes9offline channels with correct sampling/color spaces',()=>{
 for(const kind of ['wood','plaster','leaf'])for(const channel of ['','-height','-roughness']){const t=createMakerDistrictSurfaceTexture(kind+channel);assert.equal(t.image.width,256);assert.equal(t.userData.source,'Material Maker');assert.equal(t.userData.version,'1.8');assert.equal(t.colorSpace,channel?THREE.NoColorSpace:THREE.SRGBColorSpace);assert.ok(new Set(t.image.data.filter((_,i)=>i%4===0)).size>8,'actual export is not flat or missing');assert.ok(t.generateMipmaps);if(kind==='wood')assert.equal(t.rotation,Math.PI/2);t.dispose();}
});
test('leaf pilot actually uses maker PBR channels, preserves original geometry/harvest parent and releases exactly once',()=>{
 const plaza=new THREE.Group(),orchard=new THREE.Group(),tree=new THREE.Group();tree.userData.townAction='harvest';orchard.add(tree);const g=new THREE.IcosahedronGeometry(.3,1),m=new THREE.MeshStandardMaterial({name:'town-cozy-leaf',color:'#7da17a'}),leaf=new THREE.Mesh(g,m);tree.add(leaf);const originalPixels=g.attributes.position.array.slice();
 const f=createTownDistrictFinish({plaza,orchard});assert.equal(leaf.material.map.userData.source,'Material Maker');assert.ok(leaf.material.bumpScale<=.001);assert.equal(leaf.parent,tree);assert.equal(tree.userData.townAction,'harvest');assert.deepEqual(leaf.geometry.attributes.position.array,originalPixels);
 const maps=new Set([leaf.material.map,leaf.material.bumpMap,leaf.material.roughnessMap]);let freed=0;for(const t of maps)t.addEventListener('dispose',()=>freed++);f.dispose();f.dispose();assert.equal(leaf.material,m);assert.equal(freed,3);g.dispose();m.dispose();
});
