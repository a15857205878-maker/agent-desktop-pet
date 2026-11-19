import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBedroomScene} from './bedroom-scene.mjs';
import {createRoomAtmosphere,projectWindowPane} from './room-atmosphere.mjs';

test('quilt stitches follow the actual softened textile surface instead of floating over its rolled edges',()=>{
 const scene=new THREE.Scene(),study=new THREE.Group();scene.add(study);const bed=createBedroomScene(scene),f=createRoomAtmosphere(scene,study);scene.updateMatrixWorld(true);
 const surfaces=['bed-quilt-cream','bed-blanket-lavender'].map(n=>bed.root.getObjectByName(n));
 const ray=new THREE.Raycaster(),v=new THREE.Vector3();let checked=0;
 bed.root.traverse(o=>{if(!['quilt-quilting-stitch','quilt-cross-stitch'].includes(o.name))return;
  const pos=o.geometry.attributes.position;
  for(let i=0;i<pos.count;i+=3){v.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);ray.set(new THREE.Vector3(v.x,2,v.z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObjects(surfaces,false)[0];if(!hit)continue;
   const gap=v.y-hit.point.y;assert.ok(gap<.009,`${o.name}: stitch floats ${gap.toFixed(4)} above cloth`);assert.ok(gap>-.006,`${o.name}: stitch is buried ${(-gap).toFixed(4)} below cloth`);checked++;
  }
 });assert.ok(checked>40);f.dispose();bed.dispose();
});

test('both windows share a world sunlight direction and soften toward the far floor edge',()=>{
 const scene=new THREE.Scene(),study=new THREE.Group();study.scale.x=-1;scene.add(study);const bed=createBedroomScene(scene);
 const f=createRoomAtmosphere(scene,study);scene.updateMatrixWorld(true);
 const a=study.getObjectByName('window-interior-bounce'),b=bed.root.getObjectByName('window-interior-bounce');
 const direction=o=>o.target.getWorldPosition(new THREE.Vector3()).sub(o.getWorldPosition(new THREE.Vector3())).normalize();
 assert.ok(direction(a).dot(direction(b))>.999,'mirrored study must agree with bedroom sunlight');
 for(const parent of [study,bed.root]){
  const patch=parent.getObjectByName('window-pane-floor-light');
  assert.ok(patch.material.opacity<=.10,'sun patch stays a gentle accent');
  assert.ok(patch.material.depthTest&&!patch.material.depthWrite);
 }
 f.dispose();bed.dispose();
});

test('window light is projected from each aperture onto the floor, with the far edge further into the room',()=>{
 const p=projectWindowPane({left:-1,right:0,bottom:1.2,top:2.4,z:-1.8,floor:.224,direction:[-.2,-1,1.1]});
 assert.equal(p.length,4);for(const v of p){assert.ok(v.every(Number.isFinite));assert.equal(v[1],.224);assert.ok(v[2]>-1.8);}
 assert.ok(p[2][2]>p[0][2]);
 assert.deepEqual(projectWindowPane({left:0,right:1,bottom:1,top:2,z:0,floor:0,direction:[0,0,1]}),[]);
});

test('refinement follows room visibility and keeps original baked texture, actor and bed anchors intact',()=>{
 const scene=new THREE.Scene(),study=new THREE.Group();study.name='study';scene.add(study);
 const originalMap=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);
 const baked=new THREE.Mesh(new THREE.BoxGeometry(4,3,4),new THREE.MeshStandardMaterial({map:originalMap}));baked.name='home-office_body';study.add(baked);
 const bedroom=createBedroomScene(scene),bed=bedroom.root.getObjectByName('bed-mattress');
 const bedPosition=bed.position.toArray(),bedGeometry=bed.geometry,actor=new THREE.Sprite(new THREE.SpriteMaterial());scene.add(actor);const actorMaterial=actor.material;
 const finish=createRoomAtmosphere(scene,study);assert.ok(finish.getState().rooms.includes('study'));assert.ok(finish.getState().rooms.includes('bedroom'));
 assert.equal(baked.material.map,originalMap);assert.equal(actor.material,actorMaterial);assert.deepEqual(bed.position.toArray(),bedPosition);assert.equal(bed.geometry,bedGeometry);
 assert.ok(bedroom.root.getObjectByName('room-atmosphere-bedroom'));assert.ok(study.getObjectByName('room-atmosphere-study'));
 bedroom.setVisible(false);assert.equal(bedroom.root.visible,false);assert.equal(scene.children.filter(o=>o.name==='room-atmosphere-bedroom').length,0);
 finish.dispose();bedroom.dispose();
});

test('material overrides and decorative resources restore exactly once when rebuilding or disposing',()=>{
 const scene=new THREE.Scene(),study=new THREE.Group();scene.add(study);const bedroom=createBedroomScene(scene);
 const wood=bedroom.root.getObjectByName('bed-headboard'),original=wood.material;
 const f=createRoomAtmosphere(scene,study);assert.notEqual(wood.material,original);assert.ok(wood.material.map);
 const g=bedroom.root.getObjectByName('room-atmosphere-bedroom');let geometryDisposals=0,textureDisposals=0;const geometries=new Set(),textures=new Set();
 g.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?[o.material].flat():[])for(const key of ['map','alphaMap'])if(m[key])textures.add(m[key]);});
 for(const x of geometries)x.addEventListener('dispose',()=>geometryDisposals++);for(const x of textures)x.addEventListener('dispose',()=>textureDisposals++);
 f.dispose();f.dispose();assert.equal(wood.material,original);assert.equal(geometryDisposals,geometries.size);assert.equal(textureDisposals,textures.size);
 const again=createRoomAtmosphere(scene,study);again.dispose();assert.equal(wood.material,original);bedroom.dispose();
});

test('bedside light stays local, follows the existing soft-light switch and restores on disposal',()=>{
 const scene=new THREE.Scene(),study=new THREE.Group();scene.add(study);const bedroom=createBedroomScene(scene);
 const originalLamp=bedroom.root.children.find(o=>o.isPointLight),originalPosition=originalLamp.position.toArray(),originalColor=originalLamp.color.clone();
 const finish=createRoomAtmosphere(scene,study),root=bedroom.root.getObjectByName('room-atmosphere-bedroom');
 const lamp=bedroom.root.getObjectByName('bedside-local-bounce'),halo=root.getObjectByName('bedside-wall-halo');
 assert.ok(lamp?.isPointLight,'bedside lamp must illuminate nearby surfaces');
 assert.ok(lamp.distance<=2&&lamp.intensity>0);const day=lamp.intensity;
 assert.equal(lamp,originalLamp);bedroom.setSoftLight(true);finish.setSoft(true);assert.ok(lamp.intensity>day);assert.ok(halo.material.opacity<=.35);
 bedroom.setSoftLight(false);finish.setSoft(false);assert.equal(lamp.intensity,.75);assert.equal(root.children.filter(x=>x.isLight).length,1);
 bedroom.setVisible(false);assert.equal(lamp.parent.visible,false);
 finish.dispose();assert.deepEqual(lamp.position.toArray(),originalPosition);assert.ok(lamp.color.equals(originalColor));bedroom.dispose();
});

test('miniature detail accents keep bed geometry, original maps and bounded mesh count',()=>{
 const scene=new THREE.Scene(),study=new THREE.Group();scene.add(study);const bedroom=createBedroomScene(scene);
 const mattress=bedroom.root.getObjectByName('bed-mattress'),position=mattress.position.toArray();
 const finish=createRoomAtmosphere(scene,study);const g=bedroom.root.getObjectByName('room-atmosphere-bedroom');
 assert.ok(study.getObjectByName('study-honey-crown-back'));
 assert.ok(g.getObjectByName('quilt-soft-edge-piping'));assert.ok(g.getObjectByName('bedroom-staggered-plank-joint'));
 assert.ok(finish.getState().decorMeshes<180);assert.deepEqual(mattress.position.toArray(),position);
 finish.dispose();bedroom.dispose();
});
