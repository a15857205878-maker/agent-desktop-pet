import {test} from 'node:test';import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCozyYardFinish,applyCozyHomeLighting} from './yard-cozy-finish.mjs';
import {createTwoStoryExterior} from './two-story-exterior.mjs';
function fixture(){const model=new THREE.Group(),wallMaterial=new THREE.MeshStandardMaterial({color:'#ccc9bd'}),glowMaterial=new THREE.MeshStandardMaterial({color:'#ffe1b8',emissive:'#ffb76a',emissiveIntensity:.1});wallMaterial.name='Mat_WallCream';glowMaterial.name='Mat_WindowGlow';const wall=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),wallMaterial),glow=new THREE.Mesh(new THREE.PlaneGeometry(.3,.4),glowMaterial),oldRoof=new THREE.Mesh(new THREE.BoxGeometry(2,.1,2),wallMaterial);oldRoof.name='Roof';oldRoof.visible=false;model.add(wall,glow,oldRoof);return {model,wall,glow,oldRoof,wallMaterial,glowMaterial};}
test('home finish owns palette clones while original and night-driven glowing materials remain authoritative',()=>{
 const f=fixture(),sourceColor=f.wallMaterial.color.getHex(),positions=f.wall.geometry.attributes.position.array.slice();const d=createCozyYardFinish(f.model);
 assert.notEqual(f.wall.material,f.wallMaterial);assert.equal(f.glow.material,f.glowMaterial);assert.equal(f.oldRoof.material,f.wallMaterial);assert.equal(f.oldRoof.visible,false);
 assert.equal(f.wallMaterial.color.getHex(),sourceColor);assert.deepEqual(f.wall.geometry.attributes.position.array,positions);
 const before=f.wall.material;for(let i=0;i<20;i++){f.glowMaterial.emissiveIntensity=2;d.setNight(true);assert.equal(f.glow.material.emissiveIntensity,2);d.setNight(false);assert.equal(f.wall.material,before);}
 d.dispose();d.dispose();assert.equal(f.wall.material,f.wallMaterial);assert.equal(f.oldRoof.visible,false);assert.equal(f.model.children.length,3);
});
test('contact shades remain floor-bound inside existing yard and all owned resources release exactly once',()=>{
 const f=fixture(),d=createCozyYardFinish(f.model),geos=new Set(),mats=new Set(),textures=new Set();d.root.updateMatrixWorld(true);
 d.root.traverse(o=>{if(!o.isMesh)return;const b=new THREE.Box3().setFromObject(o);assert.ok(b.min.x>=-2&&b.max.x<=2&&b.min.z>=-2&&b.max.z<=2);assert.ok(b.min.y>=.015&&b.max.y<.04);assert.equal(o.material.depthWrite,false);geos.add(o.geometry);mats.add(o.material);if(o.material.map)textures.add(o.material.map)});
 assert.ok(geos.size>=2&&geos.size<=5);assert.equal(textures.size,1);let gc=0,mc=0,tc=0;for(const g of geos)g.addEventListener('dispose',()=>gc++);for(const m of mats)m.addEventListener('dispose',()=>mc++);for(const t of textures)t.addEventListener('dispose',()=>tc++);
 d.dispose();d.dispose();assert.equal(gc,geos.size);assert.equal(mc,mats.size);assert.equal(tc,textures.size);
});
test('home light balances keep night readable, do not allocate lights or overwrite other districts',()=>{
 const ambient=new THREE.HemisphereLight('#fff8ec','#a6aaa0',1.45),sun=new THREE.DirectionalLight('#fff4df',1.8),renderer={toneMappingExposure:.95},scene=new THREE.Scene();scene.add(ambient,sun);
 assert.equal(applyCozyHomeLighting({ambient,sun,renderer,night:false,isHome:true}),true);assert.ok(ambient.intensity>1.45&&sun.intensity>=1.8);const day=renderer.toneMappingExposure;
 applyCozyHomeLighting({ambient,sun,renderer,night:true,isHome:true});assert.ok(ambient.intensity>=.9&&sun.intensity>=.4);assert.ok(renderer.toneMappingExposure>=day);assert.equal(scene.children.length,2);
 const state=[ambient.intensity,sun.intensity,renderer.toneMappingExposure,ambient.color.getHex(),sun.color.getHex()];assert.equal(applyCozyHomeLighting({ambient,sun,renderer,night:false,isHome:false}),false);assert.deepEqual([ambient.intensity,sun.intensity,renderer.toneMappingExposure,ambient.color.getHex(),sun.color.getHex()],state);
});
test('night window panes remain visibly in front of timber instead of glowing behind a solid frame box',()=>{
 const model=new THREE.Group(),exterior=createTwoStoryExterior(model);exterior.setNight(true);model.updateMatrixWorld(true);
 const direction=new THREE.Vector3(-6,-3.8,-8).normalize();
 for(const point of [[.35,2.25,-.009],[1.921,2.25,-1.0]]){
  const p=new THREE.Vector3(...point),ray=new THREE.Raycaster(p.clone().addScaledVector(direction,-12),direction,0,24),hits=ray.intersectObject(exterior.root,true);
  const opaque=hits.find(h=>!h.object.material.transparent||h.object.material.opacity>=.95);
  assert.ok(opaque&&/windowGlow/.test(opaque.object.name),'first opaque surface through pane should be the actual warm window, got '+opaque?.object.name);
 }
 exterior.dispose();
});
