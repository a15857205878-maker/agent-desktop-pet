import {outdoorPalette as p} from './outdoor-style.mjs';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Deterministic hand-shaped crowns, shared silhouettes in the house and orchard.
export function createTownTree({x=0,z=0,scale=1,seed=0,action}={}){
 const root=new THREE.Group();root.name='town-tree';root.position.set(x,0,z);root.scale.setScalar(scale);if(action)root.userData.townAction=action;
 const palette={bark:p.bark,cut:p.wood,shade:p.leafShade,leaf:p.leaf,light:p.leafLight};
 const buckets=Object.fromEntries(Object.keys(palette).map(k=>[k,[]]));
 function add(geometry,kind){const g=geometry.index?geometry.toNonIndexed():geometry.clone();g.deleteAttribute('uv');buckets[kind].push(g);geometry.dispose()}
 function limb(a,b,r1,r2,kind='bark'){const delta=b.clone().sub(a),g=new THREE.CylinderGeometry(r2,r1,delta.length(),7);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());add(g,kind)}
 const v=(x,y,z)=>new THREE.Vector3(x,y,z);
 // Three uneven leaf shelves give each cluster a leafy overhang instead of a ball.
 // The shelves stay inside the original crown envelope and share one merged mesh.
 function leafCluster(radius,phase){
  const points=[0,.82*radius,0],indices=[],segments=8;
  for(const [height,width] of [[.54,.58],[.05,.94],[-.42,.70]]){
   for(let j=0;j<segments;j++){const a=j*Math.PI*2/segments,ruffle=1-.055*(1+Math.sin(j*2.3+phase));points.push(Math.cos(a)*radius*width*ruffle,height*radius,Math.sin(a)*radius*width*ruffle);}
  }
  points.push(0,-.72*radius,0);
  for(let j=0;j<segments;j++){
   const next=(j+1)%segments;indices.push(0,1+next,1+j);
   for(let row=0;row<2;row++){const a=1+row*segments+j,b=1+row*segments+next;indices.push(a,b,a+segments,b,b+segments,a+segments);}
   indices.push(25,17+j,17+next);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setIndex(indices);g.computeVertexNormals();
  const faceted=g.toNonIndexed();g.dispose();faceted.computeVertexNormals();return faceted;
 }
 limb(v(0,.025,0),v(-.035,.46,.015),.10,.077);limb(v(-.035,.46,.015),v(.025,.92,0),.077,.046);limb(v(.025,.92,0),v(.04,1.34,-.03),.046,.015);
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5+.4;limb(v(Math.cos(a)*.16,.027,Math.sin(a)*.16),v(0,.20,0),.022,.04);}
 const crown=[[-.32,1.07,.05,.30],[.30,1.16,.08,.31],[-.10,1.43,-.10,.36],[.19,1.47,-.06,.29],[-.32,1.34,-.16,.28],[.04,1.18,.31,.30],[.28,1.34,.25,.25],[-.25,1.43,.24,.26],[.03,1.63,.04,.27],[.34,1.23,-.18,.22],[-.02,1.14,-.31,.28]];
 for(let i=0;i<crown.length;i++){
  const [cx,cy,cz,r]=crown[i],variation=Math.sin(i*2.9+seed)*.04;
  if(i<6){const start=v(0,.56+i*.06,0),joint=v(cx*.54,cy-.25,cz*.55);limb(start,joint,.035,.021);limb(joint,v(cx,cy,cz),.021,.009);}
  // Flattened pointed leaves catch light at different angles along each crown edge.
  for(let j=0;j<8;j++){const a=j*Math.PI/4+i*.7+seed,leaf=new THREE.OctahedronGeometry(.068,0);leaf.scale(1.35,.18,.65);leaf.rotateZ(.20*Math.sin(a));leaf.rotateY(a);leaf.translate(cx+Math.cos(a)*r*.74,cy+.06+Math.sin(a*2)*.055,cz+Math.sin(a)*r*.70);add(leaf,j%4===0?'light':j%3===0?'shade':'leaf');}
  const g=leafCluster(r,i+seed);g.scale(1.03+variation,.83+(i%3)*.05,.94);g.rotateY(i*.83+seed);g.translate(cx+variation,cy,cz);add(g,i%4===0?'shade':i%3===0?'light':'leaf');
 }
 // Small leaf tips soften cluster boundaries without a texture dependency.
 for(let i=0;i<18;i++){const a=i*2.4+seed,r=.32+(i%3)*.065,g=new THREE.OctahedronGeometry(.055,0);g.scale(.90,.30,.62);g.rotateZ(.35);g.rotateY(a);g.translate(Math.cos(a)*r,1.13+(i%5)*.105,Math.sin(a)*r);add(g,i%2?'light':'leaf');}
 for(const [kind,geometries] of Object.entries(buckets)){if(!geometries.length)continue;const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());const material=new THREE.MeshStandardMaterial({color:palette[kind],roughness:.95});const mesh=new THREE.Mesh(geometry,material);mesh.name='tree-'+kind;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
 return root;
}

export function refineHomeTree(model){
 const trunk=model.getObjectByName('Tree_Trunk'),canopy=model.getObjectByName('Tree_Canopy');if(!trunk||!canopy)return;
 const tree=createTownTree({x:trunk.position.x,z:trunk.position.z,scale:1.43,seed:.7});tree.name='home-detailed-tree';
 for(const old of [trunk,canopy]){old.removeFromParent();old.traverse(o=>{o.geometry?.dispose();for(const m of o.material?[o.material].flat():[])m.dispose()})}
 model.add(tree);
}
