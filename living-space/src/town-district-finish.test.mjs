import {test} from 'node:test';import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTownDistrictFinish,applyTownDistrictLighting} from './town-district-finish.mjs';
test('district material finish owns only its clones/maps and never changes shared home, baked artwork or fruit availability',()=>{
 const home=new THREE.Group(),plaza=new THREE.Group(),orchard=new THREE.Group(),shared=new THREE.MeshStandardMaterial({name:'town-cozy-wood',color:'#b18c66'}),geo=new THREE.BoxGeometry(.5,.5,.5);
 const h=new THREE.Mesh(geo,shared),p=new THREE.Mesh(geo,shared);home.add(h);plaza.add(p);
 const baked=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:new THREE.Texture(),name:'town-cozy-stone'}));orchard.add(baked);const oldBaked=baked.material;
 const fruit=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:'#dec17e',name:'fruit-berry'}));fruit.visible=false;orchard.add(fruit);const oldFruit=fruit.material;
 const finish=createTownDistrictFinish({plaza,orchard});assert.equal(h.material,shared);assert.notEqual(p.material,shared);assert.equal(p.material.map.userData.source,'Material Maker');assert.equal(baked.material,oldBaked);assert.equal(fruit.material,oldFruit);assert.equal(fruit.visible,false);
 const maps=new Set([p.material.map,p.material.bumpMap,p.material.roughnessMap]);let releases=0;for(const t of maps)t.addEventListener('dispose',()=>releases++);
 finish.setNight(true);assert.equal(fruit.visible,false);finish.dispose();finish.dispose();assert.equal(p.material,shared);assert.equal(releases,3);geo.dispose();shared.dispose();oldFruit.dispose();oldBaked.map.dispose();oldBaked.dispose();
});
test('district light uses existing fixtures and restores home lighting ownership',()=>{
 const ambient=new THREE.HemisphereLight(),sun=new THREE.DirectionalLight(),renderer={toneMappingExposure:1};const original=ambient.intensity;
 assert.equal(applyTownDistrictLighting({ambient,sun,renderer,area:'home',night:false}),false);assert.equal(ambient.intensity,original);
 for(const area of ['plaza','orchard']){assert.ok(applyTownDistrictLighting({ambient,sun,renderer,area,night:true}));assert.ok(ambient.intensity>=1&&sun.intensity<.6);assert.ok(renderer.toneMappingExposure<=1.1);}
});
