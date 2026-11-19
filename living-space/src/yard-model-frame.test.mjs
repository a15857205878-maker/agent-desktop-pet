import {test} from 'node:test';import assert from 'node:assert/strict';
import * as THREE from 'three';
import {projectVisibleModel,fitModelFrame} from './yard-model-frame.mjs';
test('visible-vertex framing ignores hidden roof and empty space around the pitched model',()=>{
 const root=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(2,3,2),new THREE.MeshBasicMaterial());body.position.y=1.5;root.add(body);
 const hidden=new THREE.Group();hidden.visible=false;hidden.add(new THREE.Mesh(new THREE.BoxGeometry(200,200,200),body.material));root.add(hidden);
 const c=new THREE.OrthographicCamera(-4,4,3,-3,.1,100);c.position.set(6,4.8,8);c.lookAt(0,1,0);c.updateMatrixWorld(true);
 const b=projectVisibleModel(root,c,new THREE.Vector3(0,1,0));assert.ok(b.width<4&&b.height<5);assert.equal(b.vertices,24);
});
test('model fitting preserves aspect and all vertices clear viewport padding from narrow to wide',()=>{
 for(const [w,h] of [[390,600],[520,520],[820,586],[1100,800],[1600,900]]){
  const root=new THREE.Group(),m=new THREE.Mesh(new THREE.BoxGeometry(4,3.4,4),new THREE.MeshBasicMaterial());m.position.y=1.7;root.add(m);
  const c=new THREE.OrthographicCamera(-4,4,3,-3,.1,100);c.position.set(6,4.8,8);c.lookAt(0,1,0);c.updateMatrixWorld(true);
  const target=new THREE.Vector3(0,1,0),b=projectVisibleModel(root,c,target);fitModelFrame(c,b,w,h,{top:24,bottom:24,padding:22,target});c.updateMatrixWorld(true);
  assert.ok(Math.abs((c.right-c.left)/(c.top-c.bottom)-w/h)<1e-9);
  root.updateWorldMatrix(true,true);const a=m.geometry.attributes.position;
  for(let i=0;i<a.count;i++){const p=new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld).project(c);assert.ok(p.x>=-1&&p.x<=1&&p.y>=-1&&p.y<=1);}
 }
});
