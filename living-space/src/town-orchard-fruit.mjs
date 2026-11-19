import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createMiniatureFruitGeometry} from './miniature-tree-foliage.mjs';

const skins = [
  ['#f6d284','#d88750'],
  ['#fbdf94','#d1a04d'],
  ['#f4b78a','#c96d53']
];

function colored(geometry,sample) {
  const flat=geometry.index?geometry.toNonIndexed():geometry;
  if(flat!==geometry)geometry.dispose();
  const positions=flat.getAttribute('position');
  const colors=new Float32Array(positions.count*3);
  for(let i=0;i<positions.count;i++){
    sample(positions.getX(i),positions.getY(i),positions.getZ(i)).toArray(colors,i*3);
  }
  flat.setAttribute('color',new THREE.BufferAttribute(colors,3));
  return flat;
}

export function createTownFruitShape(radius,seed,variety=0) {
  const [bright,dark]=skins[variety%skins.length].map(hex=>new THREE.Color(hex));
  const pigment=new THREE.Color();
  const body=colored(createMiniatureFruitGeometry(radius,seed),(x,y,z)=>{
    const blend=THREE.MathUtils.smoothstep((y-.27*x+.16*z)/radius,-.72,.72);
    return pigment.copy(dark).lerp(bright,blend);
  });
  const stem=new THREE.CylinderGeometry(radius*.065,radius*.096,radius*.34,6);
  stem.rotateZ(-.31);
  stem.translate(radius*.032,radius*.91,0);
  const leaf=new THREE.SphereGeometry(1,8,5);
  leaf.scale(radius*.30,radius*.068,radius*.145);
  leaf.rotateY(-.29);
  leaf.rotateZ(.33);
  leaf.translate(radius*.28,radius*.98,0);
  const brown=new THREE.Color('#865637');
  const lightLeaf=new THREE.Color('#9db66a'),darkLeaf=new THREE.Color('#688452');
  const parts=[body,colored(stem,()=>brown),colored(leaf,(x,y)=>pigment.copy(darkLeaf)
    .lerp(lightLeaf,THREE.MathUtils.smoothstep(y/radius,.87,1.08)))];
  const shape=mergeGeometries(parts);
  parts.forEach(part=>part.dispose());
  return shape;
}

export function createTownFruitMaterial(){
  return new THREE.MeshStandardMaterial({
    name:'town-harvest-fruit',vertexColors:true,roughness:.46
  });
}
