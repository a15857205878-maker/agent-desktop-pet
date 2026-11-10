import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addCottageFinish,createTownFountain} from './outdoor-scene-finish.mjs';
test('cottage additions preserve door and stay inside original district footprint',()=>{
 const model=new THREE.Group(),door=new THREE.Group();door.name='Prop_FrontDoor';door.position.set(.07,.07,-.09);model.add(door);
 const result=addCottageFinish(model);assert.ok(result.triangles>0);assert.ok(result.meshes<=8);assert.equal(model.getObjectByName('Prop_FrontDoor'),door);
 const bounds=new THREE.Box3().setFromObject(model);assert.ok(bounds.min.x>=-2&&bounds.max.x<=2&&bounds.min.z>=-2&&bounds.max.z<=2);
 const plants=model.getObjectByName('cottage-window-flowers');assert.equal(plants.userData.townAction,'plants');
});
test('fountain replaces placeholder with bounded stone basins, without saved actions',()=>{
 const f=createTownFountain();const b=new THREE.Box3().setFromObject(f);assert.ok(b.max.y<.85&&b.min.x>=-.75&&b.max.x<=.75);assert.ok(f.children.length<=4);
 f.traverse(o=>{assert.equal(o.userData.townAction,undefined);if(o.geometry){for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v))}});
});
