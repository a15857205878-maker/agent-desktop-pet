import {test} from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {visibleSceneHits} from './room-visibility.mjs';
test('replaced room geometry cannot intercept scene input through hidden ancestors',()=>{
 const old=new THREE.Group(),parent=new THREE.Group(),live=new THREE.Mesh(),hidden=new THREE.Mesh();old.visible=false;old.add(parent);parent.add(hidden);const a={object:hidden},b={object:live};assert.deepEqual(visibleSceneHits([a,b]),[b]);old.visible=true;assert.deepEqual(visibleSceneHits([a,b]),[a,b]);hidden.visible=false;assert.deepEqual(visibleSceneHits([a,b]),[b]);
});
