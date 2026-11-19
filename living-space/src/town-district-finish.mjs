import * as THREE from 'three';
import {outdoorPalette} from './outdoor-style.mjs';
import {createMakerDistrictSurfaceTexture} from './maker-district-surfaces.mjs';
import {applyComponentUV} from './cottage-component-uv.mjs';

const colors={wood:'#c59e6c',deep:'#9e784f',wall:'#fff1df',stone:'#e0d5c2',rim:'#eee2ca',grass:'#afc294',light:'#a6bf83',leaf:'#7da17a',shade:'#5f8569',lavender:'#bca1d6',peach:'#e3aa93',soil:'#947253'};
function roleFor(mesh,m){
 const n=(mesh.name+' '+m.name).toLowerCase();
 if(m.map||m.vertexColors||m.transparent&&m.opacity<.95||m.emissive?.getHex()||/water|glass|glow|metal|fruit|berry|gold/.test(n))return null;
 if(/wooddeep|bark|trunk|basewood/.test(n))return 'deep';
 if(/wood|fence/.test(n))return 'wood';
 if(/wallcream|cream/.test(n))return 'wall';
 if(/lavender|flowerpurple/.test(n))return 'lavender';
 if(/peach|flowercream/.test(n))return 'peach';
 if(/leafshade|leafdeep/.test(n))return 'shade';
 if(/leaflight/.test(n))return 'light';
 if(/leaf|foliage/.test(n))return 'leaf';
 if(/grass|lawn/.test(n))return 'grass';
 if(/soil/.test(n))return 'soil';
 if(/rim/.test(n))return 'rim';
 if(/stone|paving/.test(n))return 'stone';
 for(const [key,role] of [['wood','wood'],['base','deep'],['cream','wall'],['stone','stone'],['grass','grass'],['leaf','leaf']])if(m.color?.getHexString()===new THREE.Color(outdoorPalette[key]).getHexString())return role;
 return null;
}
export function createTownDistrictFinish({plaza,orchard}){
 const originals=[],clones=new Map(),textures=new Map(),geometryOverrides=new Map();let disposed=false,night=false;
 const texture=k=>{if(!textures.has(k))textures.set(k,createMakerDistrictSurfaceTexture(k));return textures.get(k)};
 function prepareUV(mesh,kind){
  // New model batches already carry per-component UVs. Legacy benches,
  // fountains and the upper paving need their own reversible UV copies.
  if([mesh.material].flat().some(m=>m.map))return; // A mixed mesh's baked faces own their original UV layout.
  if(/cozy/i.test(mesh.name+' '+[mesh.material].flat().map(m=>m.name).join(' '))&&mesh.geometry.attributes.uv)return;
  if(geometryOverrides.has(mesh))return;
  const original=mesh.geometry,clone=original.clone();applyComponentUV(clone,{kind});geometryOverrides.set(mesh,{original,clone});mesh.geometry=clone;
 }
 for(const root of [plaza,orchard])root?.traverse(o=>{
  if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(!p.visible)return;const original=o.material,source=[original].flat();
  const updated=source.map(m=>{
   if(!m?.isMeshStandardMaterial)return m;const role=roleFor(o,m);if(!role)return m;
   const kind=o.geometry?.attributes.position?({wood:'wood',deep:'wood',wall:'plaster',stone:'plaster',rim:'plaster',leaf:'leaf',shade:'leaf',light:'leaf'}[role]??null):null;
   if(kind)prepareUV(o,kind);
   const key=m.uuid+'/'+role+'/'+(kind??'color');
   if(!clones.has(key)){const c=m.clone();c.color.set(colors[role]);c.roughness=.92;
    if(kind){c.map=texture(kind);c.bumpMap=texture(kind+'-height');c.roughnessMap=texture(kind+'-roughness');c.roughness=1;c.bumpScale=kind==='wood'?.0038:kind==='leaf'?.00035:.003;}
    clones.set(key,{material:c,role});}
   return clones.get(key).material;
  });
  if(updated.some((m,i)=>m!==source[i])){originals.push({mesh:o,original});o.material=Array.isArray(original)?updated:updated[0];}
 });
 return {setNight(v){if(disposed)return;night=!!v;for(const {material,role} of clones.values())material.color.set(colors[role]).multiplyScalar(night?.97:1);},getState:()=>({night,materialOverrides:originals.length,materialClones:clones.size,sourceTextures:textures.size,uvGeometryCopies:geometryOverrides.size,disposed}),dispose(){if(disposed)return;disposed=true;for(const r of originals)r.mesh.material=r.original;for(const [mesh,r] of geometryOverrides){mesh.geometry=r.original;r.clone.dispose();}for(const {material} of clones.values())material.dispose();for(const t of textures.values())t.dispose();}};
}
export function applyTownDistrictLighting({ambient,sun,renderer,area,night}){
 if(!['plaza','orchard'].includes(area))return false;
 sun.position.set(...(night?[-3,7,5]:[-4.4,5.7,3.7]));
 ambient.color.set(night?'#c7d1e8':'#fff5e4');ambient.groundColor.set(night?'#64677a':'#c8b499');ambient.intensity=night?1.1:(area==='orchard'?1.27:1.32);
 sun.color.set(night?'#b5c8eb':'#fff0d8');sun.intensity=night?.43:(area==='orchard'?2.32:2.24);renderer.toneMappingExposure=night?1.08:1.00;return true;
}
