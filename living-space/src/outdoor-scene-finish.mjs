import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {outdoorPalette as p} from './outdoor-style.mjs';

// Decorative geometry only; original model, door pivot and business data stay owned
// by their existing modules. Batch by material so details add few draw calls.
function batch(root){
 const sources=new Map();
 function add(g,kind,x=0,y=0,z=0,rotation=0){g.rotateY(rotation);g.translate(x,y,z);const v=g.index?g.toNonIndexed():g.clone();v.deleteAttribute('uv');if(!sources.has(kind))sources.set(kind,[]);sources.get(kind).push(v);g.dispose()}
 function finish(){let triangles=0;for(const [kind,list] of sources){const geo=mergeGeometries(list,false);list.forEach(g=>g.dispose());const m=new THREE.MeshStandardMaterial({color:p[kind],roughness:kind==='water'?.38:.9});m.name='finish-'+kind;const mesh=new THREE.Mesh(geo,m);mesh.castShadow=['wood','stone','rim'].includes(kind);mesh.receiveShadow=true;root.add(mesh);triangles+=geo.attributes.position.count/3}return {triangles,meshes:sources.size}}
 return {add,finish,box:(w,h,d,x,y,z,k)=>add(new THREE.BoxGeometry(w,h,d),k,x,y,z)};
}
export function createTownFountain(){
 const root=new THREE.Group();root.name='town-stone-fountain';root.position.z=-.2;
 const {add,finish}=batch(root);
 add(new THREE.CylinderGeometry(.74,.74,.11,24),'stone',0,.095,0);
 add(new THREE.CylinderGeometry(.61,.61,.035,24),'water',0,.16,0);
 add(new THREE.CylinderGeometry(.105,.15,.36,12),'stone',0,.36,0);
 const bowl=new THREE.LatheGeometry([new THREE.Vector2(.08,0),new THREE.Vector2(.12,.025),new THREE.Vector2(.26,.09),new THREE.Vector2(.27,.13),new THREE.Vector2(.235,.14),new THREE.Vector2(.22,.105),new THREE.Vector2(0,.075)],20);
 add(bowl,'rim',0,.50,0);add(new THREE.CylinderGeometry(.22,.22,.012,20),'water',0,.602,0);
 add(new THREE.CylinderGeometry(.036,.06,.16,10),'stone',0,.675,0);
 for(let i=0;i<4;i++){const a=i*Math.PI/2,g=new THREE.CylinderGeometry(.008,.012,.23,5);g.rotateZ(.22);add(g,'water',Math.sin(a)*.245,.43,Math.cos(a)*.245,a)}
 finish();return root;
}
export function addCottageFinish(model){
 const root=new THREE.Group();root.name='cottage-concept-finish';model.add(root);const {add,box,finish}=batch(root);
 // Window shutters gain actual slats; leave glass and door aperture clear.
 for(const x of [-.55,.065])for(let j=0;j<7;j++)box(.125,.018,.016,x,.89+j*.078,-.048,'leaf');
 for(const z of [-1.405,-.64])for(let j=0;j<7;j++)box(.018,.018,.11,1.911,.89+j*.078,z,'leaf');
 // Small stone plinth, confined to the existing wall footprint.
 for(let i=0;i<7;i++)box(.13,.075,.022,1.875,.10+(i%2)*.025,-1.6+i*.22,'stone');
 for(let i=0;i<5;i++)box(.17,.075,.022,.96+i*.18,.10+(i%2)*.025,-.105,'stone');
 // A matching side-window planter and warm wooden rails on the front box.
 box(.14,.16,.61,1.90,.70,-1.02,'wood');box(.16,.025,.65,1.90,.78,-1.02,'wood');
 box(.58,.025,.035,-.25,.765,.015,'wood');
 const flowers=new THREE.Group();flowers.name='cottage-window-flowers';flowers.userData.townAction='plants';root.add(flowers);const fb=batch(flowers);
 function flower(x,y,z,index){
  fb.add(new THREE.CylinderGeometry(.007,.009,.13,5),'leaf',x,y-.06,z);
  for(let j=0;j<3;j++){const a=j*2.1+index,g=new THREE.OctahedronGeometry(.045);g.scale(1,.25,.55);fb.add(g,'leaf',x+Math.sin(a)*.025,y-.06,z+Math.cos(a)*.025,a)}
  for(let j=0;j<5;j++){const a=j*Math.PI*2/5,g=new THREE.IcosahedronGeometry(.018,0);g.scale(1,.65,1);fb.add(g,index%2?'gold':'flower',x+Math.sin(a)*.022,y,z+Math.cos(a)*.022)}
  fb.add(new THREE.IcosahedronGeometry(.012,0),'gold',x,y+.009,z);
 }
 for(let i=0;i<5;i++){flower(-.45+i*.10,.91+(i%2)*.018,-.015,i);flower(1.94,.88+(i%2)*.02,-1.26+i*.115,i+1)}
 // Quiet vine along the back edge of the visible side wall, away from the window.
 for(let i=0;i<9;i++){const z=-1.59+Math.sin(i*.8)*.035,y=.43+i*.13;const g=new THREE.OctahedronGeometry(.065);g.scale(.28,.85,1);add(g,'leaf',1.90,y,z,i*.5);if(i%3===0)flower(1.94,y+.05,z,i)}
 const a=finish(),b=fb.finish();
 // Existing GLB tiles already follow the pitch. Vary whole tiles rather than
 // laying a second roof on top; the source GLB remains byte-for-byte intact.
 let roofTiles=0;model.getObjectByName('Roof')?.traverse(o=>{if(!o.isMesh||o.material?.name!=='Mat_RoofTile')return;const geometry=o.geometry.clone(),position=geometry.attributes.position,colors=new Float32Array(position.count*3);for(let i=0;i<position.count;i++){const tile=Math.floor(i/24),row=Math.floor(tile/9)%6,col=tile%9,c=new THREE.Color(p.roof).multiplyScalar(.93+((col*7+row*3)%5)*.027);c.toArray(colors,i*3)}geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));o.geometry.dispose();o.geometry=geometry;o.material.color.set('#ffffff');o.material.vertexColors=true;o.material.needsUpdate=true;roofTiles+=position.count/24});
 return {triangles:a.triangles+b.triangles,meshes:a.meshes+b.meshes,roofTiles};
}
