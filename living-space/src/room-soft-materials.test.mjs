import {test} from 'node:test';import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createRoomAtmosphere} from './room-atmosphere.mjs';
import {createBedroomScene} from './bedroom-scene.mjs';
import {createCottageSurfaceTexture} from './cottage-surface-textures.mjs';
import {createRoomSoftSurfaceTexture} from './room-soft-materials.mjs';
test('interior texture derivation preserves CC0 channel identity and grain direction with quieter height contrast',()=>{
 for(const kind of ['wood','plaster','linen']){
  const original=createCottageSurfaceTexture(kind+'-height'),before=original.image.data.slice(),derived=createRoomSoftSurfaceTexture(kind+'-height');
  const range=t=>{let lo=255,hi=0;for(let i=0;i<t.image.data.length;i+=4){lo=Math.min(lo,t.image.data[i]);hi=Math.max(hi,t.image.data[i]);}return hi-lo;};
  assert.ok(range(derived)>0&&range(derived)<range(original)*.8);
  assert.deepEqual(original.image.data,before);assert.equal(derived.colorSpace,THREE.NoColorSpace);
  assert.equal(derived.userData.license,original.userData.license);assert.equal(derived.userData.asset,original.userData.asset);
  assert.equal(derived.rotation,original.rotation);assert.ok(derived.repeat.x<=original.repeat.x);
  const color=createRoomSoftSurfaceTexture(kind);assert.equal(color.colorSpace,THREE.SRGBColorSpace);color.dispose();original.dispose();derived.dispose();
 }
 assert.equal(createRoomSoftSurfaceTexture('sunlight'),null);
});
test('indoor plaster and textiles keep restrained relief and warm wall bounce without moving supports, then restore',()=>{
 const scene=new THREE.Scene(),study=new THREE.Group();scene.add(study);const room=createBedroomScene(scene);
 const wall=room.root.getObjectByName('bedroom-wall-right-back'),quilt=room.root.getObjectByName('bed-quilt-cream');
 const original=[wall.material,quilt.material],geometry=quilt.geometry,position=quilt.position.toArray();
 const finish=createRoomAtmosphere(scene,study);
 assert.ok(wall.material.bumpScale>0&&wall.material.bumpScale<=.0012,'plaster relief must stay quiet at desktop size');
 assert.ok(quilt.material.bumpScale>0&&quilt.material.bumpScale<=.001,'cloth relief must not sparkle like coarse threads');
 assert.ok(quilt.material.bumpMap.repeat.x<=3,'fine weave repetition should remain legible instead of dense shimmer');
 assert.ok(wall.material.emissiveIntensity>0&&wall.material.emissiveIntensity<=.08,'bounded warm bounce should lift grey plaster without becoming a lamp');
 assert.equal(quilt.geometry,geometry);assert.deepEqual(quilt.position.toArray(),position);
 const maps=new Set([wall.material.map,wall.material.bumpMap,quilt.material.map,quilt.material.bumpMap]);let released=0;for(const t of maps)t.addEventListener('dispose',()=>released++);
 finish.dispose();finish.dispose();assert.equal(released,maps.size);assert.equal(wall.material,original[0]);assert.equal(quilt.material,original[1]);room.dispose();
});
