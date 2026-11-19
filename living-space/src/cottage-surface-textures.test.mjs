import {test} from 'node:test';import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCottageSurfaceTexture} from './cottage-surface-textures.mjs';
import {createBedroomScene} from './bedroom-scene.mjs';
import {createRoomAtmosphere} from './room-atmosphere.mjs';
import {createCozyYardFinish} from './yard-cozy-finish.mjs';
test('CC0 material channels carry distinct source height and matte roughness with correct color spaces',()=>{
 for(const kind of ['wood','plaster','linen']){
  const color=createCottageSurfaceTexture(kind),height=createCottageSurfaceTexture(kind+'-height'),rough=createCottageSurfaceTexture(kind+'-roughness');
  assert.equal(color.image.width,128);assert.equal(color.colorSpace,THREE.SRGBColorSpace);assert.equal(height.colorSpace,THREE.NoColorSpace);assert.equal(rough.colorSpace,THREE.NoColorSpace);
  if(kind==='wood')for(const t of [color,height,rough]){assert.equal(t.rotation,Math.PI/2,'horizontal source grain must align with component V/longest axis');assert.deepEqual(t.center.toArray(),[.5,.5]);}
  assert.equal(height.userData.source,'ambientCG');assert.ok(new Set(height.image.data).size>20);assert.notDeepEqual(height.image.data,rough.image.data);
  const vals=rough.image.data.filter((_,i)=>i%4===1);assert.ok(Math.min(...vals)>=170&&Math.max(...vals)<=251);
  color.dispose();height.dispose();rough.dispose();
 }assert.equal(createCottageSurfaceTexture('shadow'),null);
});
test('outdoor applies texture only with UVs and no original map, then restores and disposes owned maps',()=>{
 const root=new THREE.Group(),original=new THREE.MeshStandardMaterial({name:'Mat_Wood'}),g=new THREE.BoxGeometry(1,1,1);
 const mapped=new THREE.Mesh(g,original);root.add(mapped);
 const missingUV=new THREE.Mesh(g.clone(),original);missingUV.geometry.deleteAttribute('uv');root.add(missingUV);
 const baked=new THREE.Mesh(g,new THREE.MeshStandardMaterial({name:'Mat_Wood',map:new THREE.Texture()}));root.add(baked);const originalBaked=baked.material.map;
 const f=createCozyYardFinish(root);assert.equal(mapped.material.bumpMap.userData.source,'ambientCG');assert.equal(missingUV.material.bumpMap,null);assert.equal(baked.material.map,originalBaked);
 const maps=new Set([mapped.material.map,mapped.material.bumpMap,mapped.material.roughnessMap]);let disposed=0;for(const t of maps)t.addEventListener('dispose',()=>disposed++);
 f.dispose();f.dispose();assert.equal(mapped.material,original);assert.equal(disposed,3);assert.equal(baked.material.map,originalBaked);
 g.dispose();missingUV.geometry.dispose();original.dispose();baked.material.dispose();originalBaked.dispose();
});
test('actual bedding receives source texture channels, original support and maps restore, all owned PBR maps dispose once',()=>{
 const scene=new THREE.Scene(),study=new THREE.Group();scene.add(study);const bed=createBedroomScene(scene),quilt=bed.root.getObjectByName('bed-quilt-cream'),original=quilt.material,geometry=quilt.geometry;
 const f=createRoomAtmosphere(scene,study);assert.equal(quilt.geometry,geometry);assert.equal(quilt.material.bumpMap.userData.source,'ambientCG');assert.equal(quilt.material.roughnessMap.userData.source,'ambientCG');
 const maps=new Set([quilt.material.map,quilt.material.bumpMap,quilt.material.roughnessMap]);let count=0;for(const m of maps)m.addEventListener('dispose',()=>count++);
 f.dispose();f.dispose();assert.equal(quilt.material,original);assert.equal(count,maps.size);bed.dispose();
});
