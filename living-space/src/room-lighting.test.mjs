import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {createRoomLighting} from './room-lighting.mjs';
function fixture(){const model=new THREE.Group(),lamp=new THREE.Group();lamp.name='home-office_floor_lamp_glow';const source=new THREE.MeshStandardMaterial({color:'#dbcbb3',emissive:'#332211',emissiveIntensity:.3});source.name='floor-lamp_shade_glow';const shade=new THREE.Mesh(new THREE.BoxGeometry(.4,.3,.4),source);shade.position.set(1.6,1.65,1);lamp.add(shade);model.add(lamp);return {model,lamp,shade,source};}

test('sun rays enter from the rear window while broad front fill stays shadow-free',()=>{
 const scene=new THREE.Scene(),l=createRoomLighting(scene,{toneMappingExposure:1.1});scene.updateMatrixWorld(true);
 const g=scene.getObjectByName('room-lighting'),sun=g.children.find(o=>o.isDirectionalLight),fill=g.getObjectByName('room-front-soft-fill');
 const ray=sun.target.getWorldPosition(new THREE.Vector3()).sub(sun.getWorldPosition(new THREE.Vector3())).normalize();
 assert.ok(ray.dot(new THREE.Vector3(-.22,-1,1.25).normalize())>.999,'sun and window projection must share a direction');
 assert.ok(fill?.isDirectionalLight&&fill.intensity>0);assert.equal(fill.castShadow,false);l.dispose();
});
test('lighting setup keeps gathered curtains from sealing the sun aperture with a hard shadow',()=>{
 const f=fixture(),curtain=new THREE.Mesh(new THREE.PlaneGeometry(.3,1.3),new THREE.MeshStandardMaterial());curtain.name='study-curtains';f.model.add(curtain);
 const l=createRoomLighting(new THREE.Scene(),{shadowMap:{enabled:false}});l.bindModel(f.model);assert.equal(curtain.castShadow,false);l.dispose();curtain.geometry.dispose();curtain.material.dispose();
});

test('reference desk lamp binds to its visible bulb and illuminates its tabletop locally',()=>{
 const scene=new THREE.Scene(),f=fixture();f.lamp.name='reference-study-lamp-glow';f.shade.position.set(-.8,1.3,-1.4);scene.add(f.model);
 const l=createRoomLighting(scene,{toneMappingExposure:1.1});assert.equal(l.bindModel(f.model),true);l.setSoft(true);
 const light=f.model.getObjectByName('study-floor-lamp-local');assert.ok(light.distance<=2);assert.ok(light.target.position.y<0&&light.target.position.y>-.9);assert.equal(l.getState().lampType,'desk');l.dispose();assert.equal(f.shade.material,f.source);
});

test('cached shadow maps refresh once per room switch so hidden-room furniture cannot leave ghost shadows',()=>{
 const renderer={shadowMap:{enabled:false,type:THREE.BasicShadowMap,autoUpdate:true,needsUpdate:false}},l=createRoomLighting(new THREE.Scene(),renderer);
 l.setRoom('study');assert.equal(renderer.shadowMap.needsUpdate,true);renderer.shadowMap.needsUpdate=false;
 l.setRoom('study');assert.equal(renderer.shadowMap.needsUpdate,false);l.setRoom('bedroom');assert.equal(renderer.shadowMap.needsUpdate,true);
 renderer.shadowMap.needsUpdate=false;l.setRoom('bedroom');assert.equal(renderer.shadowMap.needsUpdate,false);l.dispose();
});

test('daylight keeps warm directional modelling rather than uniform ambient fill',()=>{const scene=new THREE.Scene(),l=createRoomLighting(scene,{toneMappingExposure:1.1});const root=scene.getObjectByName('room-lighting'),key=root.children.find(o=>o.isDirectionalLight),ambient=root.children.find(o=>o.isHemisphereLight);assert.ok(key.intensity/ambient.intensity>=2);assert.ok(key.color.r>key.color.g&&key.color.g>key.color.b);assert.ok(ambient.intensity>0);l.dispose();});
test('floor lamp supplies a local light and its own material without changing ambient',()=>{const scene=new THREE.Scene(),renderer={toneMappingExposure:1.1},l=createRoomLighting(scene,renderer),f=fixture();scene.add(f.model);assert.equal(l.bindModel(f.model),true);const before=l.getState();assert.equal(before.lampAttached,true);assert.equal(before.fill,0);assert.notEqual(f.shade.material,f.source);l.setSoft(true);const on=l.getState();assert.equal(on.lightType,'SpotLight');assert.ok(on.fill>0);assert.deepEqual(on.lampPosition,[1.6,1.65,1]);assert.equal(on.hemisphere,before.hemisphere);assert.equal(on.key,before.key);assert.equal(on.exposure,1.1);assert.ok(f.shade.material.emissiveIntensity>f.source.emissiveIntensity);for(let i=0;i<25;i++){l.setSoft(false);l.setSoft(true)}l.setSoft(false);assert.deepEqual(l.getState(),before);assert.equal(f.shade.material.emissiveIntensity,.3);l.dispose();l.dispose();assert.equal(f.shade.material,f.source);assert.equal(scene.children.length,1);});
test('no model lamp means no invented floating light',()=>{const scene=new THREE.Scene(),l=createRoomLighting(scene,{toneMappingExposure:1.1});assert.equal(l.bindModel(new THREE.Group()),false);l.setSoft(true);assert.equal(l.getState().fill,0);assert.equal(l.getState().lampAttached,false);l.dispose();});

test('static room shadows are cached and renderer/model flags restore on disposal',()=>{
 const scene=new THREE.Scene(),renderer={toneMappingExposure:1.1,shadowMap:{enabled:false,autoUpdate:true,type:THREE.BasicShadowMap}},f=fixture();const body=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());body.name='room-body';f.model.add(body);const l=createRoomLighting(scene,renderer);l.bindModel(f.model);
 assert.equal(renderer.shadowMap.enabled,true);assert.equal(renderer.shadowMap.autoUpdate,false);assert.equal(body.castShadow,true);assert.equal(body.receiveShadow,true);assert.equal(f.shade.castShadow,false);
 const key=scene.getObjectByName('room-lighting').children.find(x=>x.isDirectionalLight);assert.equal(key.shadow.mapSize.x,2048);
 l.dispose();l.dispose();assert.equal(body.castShadow,false);assert.equal(body.receiveShadow,false);assert.equal(renderer.shadowMap.enabled,false);assert.equal(renderer.shadowMap.autoUpdate,true);
});

test('study lamp follows study visibility so it cannot illuminate the independent bedroom',()=>{
 const scene=new THREE.Scene(),renderer={toneMappingExposure:1.1},f=fixture();scene.add(f.model);
 const l=createRoomLighting(scene,renderer);l.bindModel(f.model);l.setSoft(true);
 const spot=f.model.getObjectByName('study-floor-lamp-local');assert.ok(spot,'study spotlight must belong to study hierarchy');
 f.model.visible=false;assert.equal(spot.parent.visible,false);const before=spot.getWorldPosition(new THREE.Vector3()).toArray();assert.deepEqual(before,l.getState().lampPosition);
 l.dispose();assert.equal(f.model.getObjectByName('study-floor-lamp-local'),undefined);
});
