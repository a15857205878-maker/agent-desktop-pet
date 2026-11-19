import * as THREE from 'three';
export function roundedBlock(w,h,d,r=.012){
 r=Math.min(r,w/4,h/4,d/4);const s=new THREE.Shape(),x=-w/2,y=-h/2;
 s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
 const g=new THREE.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:2,curveSegments:3,steps:1});g.translate(0,0,-(d-2*r)/2);return g;
}
export function miniatureParts(model,name,palette){
 const root=new THREE.Group();root.name=name;model.add(root);let disposed=false;
 const materials=Object.fromEntries(Object.entries(palette).map(([key,v])=>[key,new THREE.MeshStandardMaterial(typeof v==='string'?{color:v,roughness:.84}:v)]));
 function add(name,g,kind,x,y,z){const m=new THREE.Mesh(g,materials[kind]);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;root.add(m);return m;}
 const box=(name,w,h,d,kind,x,y,z)=>add(name,roundedBlock(w,h,d),'wood'===kind?'wood':kind,x,y,z);
 function finish(){
  // Only this module's static, direct children are batched. Material/action
  // boundaries remain separate so the existing door and plant picking works.
  const groups=new Map();for(const m of [...root.children]){m.updateMatrix();const key=Object.keys(materials).find(k=>materials[k]===m.material)+':'+(m.userData.townAction||'');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m);}
  for(const [key,meshes]of groups){const arrays={position:[],normal:[],uv:[]},names=[];for(const m of meshes){const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);for(const k of Object.keys(arrays))arrays[k].push(g.attributes[k].array);names.push(m.name);g.dispose();m.geometry.dispose();m.removeFromParent();}const geo=new THREE.BufferGeometry();for(const [k,values]of Object.entries(arrays)){const data=new Float32Array(values.reduce((n,a)=>n+a.length,0));let n=0;for(const a of values){data.set(a,n);n+=a.length;}geo.setAttribute(k,new THREE.BufferAttribute(data,k==='uv'?2:3));}const mesh=new THREE.Mesh(geo,meshes[0].material);mesh.name=root.name+'-'+key;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.parts=names;if(meshes[0].userData.townAction)mesh.userData.townAction=meshes[0].userData.townAction;root.add(mesh);}
 }
 return {root,materials,add,box,finish,dispose(){if(disposed)return;disposed=true;const geometries=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry)});for(const g of geometries)g.dispose();for(const m of Object.values(materials))m.dispose();root.removeFromParent();}};
}
