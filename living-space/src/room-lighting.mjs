import {cottageStyle} from './cottage-style.mjs';
import * as THREE from 'three';
export function createRoomLighting(scene,renderer){
 const group=new THREE.Group();group.name='room-lighting';const hemisphere=new THREE.HemisphereLight(cottageStyle.day.sky,cottageStyle.day.floor,2),key=new THREE.DirectionalLight(cottageStyle.day.sun,2.4),fill=new THREE.SpotLight('#ffc478',0,4.2,1.05,.9,2);key.position.set(-4,7,5);fill.add(fill.target);fill.target.position.set(-.15,-1.7,.22);fill.castShadow=false;group.add(hemisphere,key,fill);scene.add(group);let soft=false,lampPosition=null,records=[];
 function restore(){for(const r of records){r.mesh.material=r.original;if(r.tag===undefined)delete r.mesh.userData.roomLamp;else r.mesh.userData.roomLamp=r.tag;for(const m of r.materials)m.clone.dispose();}records=[];lampPosition=null;fill.intensity=0;}
 function apply(){fill.intensity=soft&&lampPosition?9:0;for(const r of records)for(const m of r.materials){if(!m.clone.emissive)continue;if(soft){m.clone.emissive.set(m.bulb?'#ffdda0':'#ffc66f');m.clone.emissiveIntensity=m.bulb?3:1.15;}else{m.clone.emissive.copy(m.emissive);m.clone.emissiveIntensity=m.intensity;}}}
 function bindModel(model){
  restore();const root=model.getObjectByName('home-office_floor_lamp_glow');if(!root)return false;model.updateWorldMatrix(true,true);let bulb=null;
  root.traverse(mesh=>{if(!mesh.isMesh)return;const original=mesh.material,materials=(Array.isArray(original)?original:[original]).map(m=>({clone:m.clone(),emissive:m.emissive?.clone(),intensity:m.emissiveIntensity,bulb:/bulb/.test(m.name)}));if(materials.some(m=>m.bulb))bulb=mesh;records.push({mesh,original,materials,tag:mesh.userData.roomLamp});mesh.material=Array.isArray(original)?materials.map(m=>m.clone):materials[0].clone;mesh.userData.roomLamp=true;});
  if(!records.length)return false;lampPosition=new THREE.Box3().setFromObject(bulb||root).getCenter(new THREE.Vector3());fill.position.copy(lampPosition);apply();return true;
 }
 function setSoft(value){soft=!!value;apply();}
 const getState=()=>({soft,hemisphere:hemisphere.intensity,key:key.intensity,fill:fill.intensity,exposure:renderer.toneMappingExposure,lightCount:group.children.length,lightType:fill.type,lampAttached:!!lampPosition,lampPosition:lampPosition?.toArray()??null,lampMaterialCount:records.reduce((n,r)=>n+r.materials.length,0)});
 return {setSoft,bindModel,getState,dispose:()=>{restore();scene.remove(group)}};
}
