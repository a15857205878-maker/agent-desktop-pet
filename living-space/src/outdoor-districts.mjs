import {createTownFountain} from './outdoor-scene-finish.mjs';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {outdoorPalette,outdoorLighting} from './outdoor-style.mjs';
import {createTownTree} from './town-trees.mjs';
import {addTownMapDetails} from './town-map-details.mjs';
import {createCozyTownDistrictDetails} from './cozy-town-districts.mjs';
import {createTownFruitMaterial,createTownFruitShape} from './town-orchard-fruit.mjs';
import * as THREE from 'three';

// Small, code-native district shells. No extra game rules or saved state here.
export function createOutdoorDistricts(){
 const p=outdoorPalette,lights=[];
 const mats=Object.fromEntries(Object.entries({wood:p.wood,base:p.base,cream:p.cream,stone:p.stone,grass:p.grass,leaf:p.leaf,water:p.water,purple:p.flower,metal:p.metal}).map(([name,color])=>[name,new THREE.MeshStandardMaterial({color,roughness:name==='water'?.42:.86})]));
 mats.glow=new THREE.MeshStandardMaterial({color:p.glow,emissive:p.glow,emissiveIntensity:0});
 function mesh(g,geo,mat,x,y,z,action){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;if(action)m.userData.townAction=action;g.add(m);return m}
 function box(g,w,h,d,x,y,z,mat,action){return mesh(g,new THREE.BoxGeometry(w,h,d),mat,x,y,z,action)}
 function sphere(g,r,x,y,z,mat,action){return mesh(g,new THREE.IcosahedronGeometry(r,1),mat,x,y,z,action)}
 function cylinder(g,r,h,x,y,z,mat,action){return mesh(g,new THREE.CylinderGeometry(r,r,h,12),mat,x,y,z,action)}
 function base(g){const b=box(g,4,.25,4,0,-.125,0,mats.base);b.userData.townBasePart='plinth';const t=box(g,3.96,.025,3.96,0,.0125,0,mats.grass);t.userData.townBasePart='grass'}
 function bench(parent,x,z){const g=new THREE.Group();g.name='bench-'+x+'-'+z;g.userData.townAction='bench:'+g.name;g.userData.benchAnchor=[x,.415,z+.07];parent.add(g);for(const dz of [-.12,0,.12])box(g,.95,.05,.09,x,.38,z+dz,mats.wood);for(const dy of [.53,.68])box(g,.95,.08,.04,x,dy,z-.16,mats.wood);for(const dx of [-.38,.38]){box(g,.05,.38,.05,x+dx,.19,z+.12,mats.wood);box(g,.05,.71,.05,x+dx,.355,z-.16,mats.wood)}}
 function path(g,x,z,w,d){const m=box(g,w,.025,d,x,.04,z,mats.stone);m.userData.townBasePart='path';return m}
 function lamp(g,x,z){
  cylinder(g,.035,1.25,x,.65,z,mats.wood);box(g,.18,.22,.18,x,1.36,z,mats.glow);box(g,.21,.035,.21,x,1.235,z,mats.metal);
  const bars=[];for(const dx of [-.085,.085])for(const dz of [-.085,.085]){const geo=new THREE.BoxGeometry(.018,.24,.018);geo.translate(x+dx,1.36,z+dz);bars.push(geo)}
  mesh(g,mergeGeometries(bars,false),mats.metal,0,0,0);for(const geo of bars)geo.dispose();const cap=mesh(g,new THREE.ConeGeometry(.18,.12,4),mats.metal,x,1.53,z);cap.rotation.y=Math.PI/4;
  const light=new THREE.PointLight(p.glow,0,2.8,2);light.position.set(x,1.34,z);light.castShadow=false;g.add(light);lights.push(light)
 }
 function routeSign(parent,text,action,x,z,approach){
  const group=new THREE.Group();
  group.name='route-'+action;
  group.userData.townAction=action;
  group.userData.departure=approach;
  parent.add(group);
  box(group,.045,.42,.045,x,.23,z,mats.wood);
  const c=document.createElement('canvas');c.width=256;c.height=96;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#fff7e9';ctx.fillRect(0,0,256,96);ctx.strokeStyle='#bd9875';
  ctx.lineWidth=12;ctx.strokeRect(5,5,246,86);ctx.fillStyle='#65516f';
  ctx.font='bold 38px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,128,49);
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
  const sign=mesh(group,new THREE.PlaneGeometry(.64,.24),
    new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide}),x,.5,z+.03);
  sign.rotation.y=.3;
  return new THREE.Vector3(x,.5,z+.035);
 }
 const plaza=new THREE.Group();plaza.name='small-town-plaza';base(plaza);path(plaza,0,.9,.65,1.9);path(plaza,0,-.35,3.3,.7);
 plaza.add(createTownFountain());
 bench(plaza,-1.22,-1.1);bench(plaza,1.22,-1.1);lamp(plaza,-1.62,.65);lamp(plaza,1.62,.65);
 const bulletin=new THREE.Group();bulletin.position.set(0,0,-1.42);plaza.add(bulletin);box(bulletin,.75,.65,.09,0,.85,0,mats.wood,'manage');box(bulletin,.62,.5,.025,0,.85,.06,mats.cream,'manage');for(const x of [-.28,.28])box(bulletin,.04,.7,.04,x,.35,0,mats.wood,'manage');
 const notice=document.createElement('canvas');notice.width=256;notice.height=180;const pen=notice.getContext('2d');pen.fillStyle='#fff7e9';pen.fillRect(0,0,256,180);pen.fillStyle='#65516f';pen.textAlign='center';pen.font='bold 42px sans-serif';pen.fillText('小镇事务',128,74);pen.font='27px sans-serif';pen.fillText('家具 · 日常',128,126);const noticeMap=new THREE.CanvasTexture(notice);noticeMap.colorSpace=THREE.SRGBColorSpace;mesh(bulletin,new THREE.PlaneGeometry(.60,.45),new THREE.MeshBasicMaterial({map:noticeMap}),0,.85,.075,'manage');
 const plazaHome=routeSign(plaza,'← 小屋','home',-1.25,1.42,[-1.12,.066,1.17]),
  plazaOrchard=routeSign(plaza,'果园 →','orchard',1.25,1.42,[1.12,.066,1.17]);
 const orchard=new THREE.Group();orchard.name='small-town-orchard';base(orchard);path(orchard,0,0,.65,3.65);bench(orchard,1.17,1.1);lamp(orchard,-1.55,1.05);
 const fruits=[],fruitMaterial=createTownFruitMaterial();
 for(const [tree,[x,z]] of [[-1.05,-1.05],[1.02,-.92],[-1.02,.42]].entries()){
  const canopy=createTownTree({x,z,seed:x+z,action:'harvest'});
  canopy.userData.orchardTree=tree;
  orchard.add(canopy);
  for(const [index,[dx,dy,dz]] of [[-.20,1.16,.46],[.26,1.42,.46],[.45,1.08,.18]].entries()){
   const fruit=mesh(orchard,createTownFruitShape(.085,x+z+dx,(tree+index)%3),fruitMaterial,x+dx,dy,z+dz,'harvest');
   fruit.name='town-orchard-fruit';
   fruit.userData.orchardTree=tree;
   fruits.push(fruit);
  }
 }
 for(const x of [-1.85,1.85])for(const z of [-1.7,-.8,.1,1,1.7])box(orchard,.07,.48,.07,x,.26,z,mats.wood);
 for(const x of [-1.85,1.85])box(orchard,.045,.045,3.4,x,.36,0,mats.wood);
 const orchardPlaza=routeSign(orchard,'← 广场','plaza',-.8,1.5,[-.70,.066,1.21]);
 const homeRoutes=new THREE.Group();homeRoutes.name='yard-town-routes';const homePlaza=routeSign(homeRoutes,'去广场 →','plaza',1.07,1.64,[.91,.055,1.39]);
 const detail=addTownMapDetails({plaza,orchard,home:homeRoutes});
 const refinement=createCozyTownDistrictDetails({plaza,orchard});
 return {plaza,orchard,homeRoutes,detail,refinement,disposeDetails:()=>refinement.dispose(),lighting:()=>({streetLights:lights.length,activeStreetLights:lights.filter(l=>l.intensity>0&&l.parent.visible).length}),points:{homePlaza,plazaHome,plazaOrchard,orchardPlaza,harvest:new THREE.Vector3(1.28,1.42,-.46)},setFruitAvailable(value){for(const m of fruits)m.visible=!!value},setNight(value){mats.glow.emissiveIntensity=value?2.1:0;for(const light of lights)light.intensity=value?outdoorLighting.night.street:0;refinement.setNight(value)}};
}
