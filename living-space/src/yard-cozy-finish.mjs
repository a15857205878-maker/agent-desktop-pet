import {createCottageSurfaceTexture} from './cottage-surface-textures.mjs';
import * as THREE from 'three';

const palette=Object.freeze({wall:'#fff1df',wood:'#c59e6c',deep:'#9e784f',roof:'#d6b17e',roofAlt:'#e0bd8c',shutter:'#91af99',grass:'#aec18e',leaf:'#7da17a',leafDeep:'#5f8569',flower:'#bca1d6',peach:'#e3aa93',gold:'#ebd090',stone:'#ddd2bf',pot:'#c99b80',soil:'#947253',linen:'#eee0e9'});
function roleFor(mesh,m){
 const n=(mesh.name+' '+m.name).toLowerCase();
 if(m.vertexColors||/glow|glass|metal|lantern|windowpane/.test(n))return null;
 if(/wallcream|mat_wallcream/.test(n))return 'wall';
 if(/rooftilealt|roof.*alt/.test(n))return 'roofAlt';
 if(/rooftile|roof.*shingle/.test(n))return 'roof';
 if(/shutter/.test(n))return 'shutter';
 if(/grass|lawn/.test(n))return 'grass';
 if(/leafdeep|leafshade/.test(n))return 'leafDeep';
 if(/leaf|plantleaf/.test(n))return 'leaf';
 if(/lavender|flowerpurple|flower.*purple/.test(n))return 'flower';
 if(/flowercream|flowerpeach|flower.*peach|garden.*cream/.test(n))return 'peach';
 if(/gold|floweryellow|flower.*yellow/.test(n))return 'gold';
 if(/soil/.test(n))return 'soil';
 if(/potclay/.test(n))return 'pot';
 if(/linen|textile|doormat|plaque/.test(n))return 'linen';
 if(/stone|wallbase/.test(n))return 'stone';
 if(/wooddeep|basewood|bark|trunk/.test(n))return 'deep';
 if(/wood|rooftrim|fence/.test(n))return 'wood';
 return null;
}
function shadeTexture(){
 const w=64,data=new Uint8Array(w*w*4);
 for(let y=0;y<w;y++)for(let x=0;x<w;x++){
  const u=(x+.5)/w*2-1,v=(y+.5)/w*2-1,a=Math.max(0,1-Math.hypot(u,v))**1.6,i=(y*w+x)*4;
  data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(a*255);
 }
 const t=new THREE.DataTexture(data,w,w);t.name='cozy-yard-contact';t.magFilter=t.minFilter=THREE.LinearFilter;t.needsUpdate=true;return t;
}
export function createCozyYardFinish(model){
 const records=[],clones=new Map(),surfaceTextures=new Map();
 const texture=k=>{if(!surfaceTextures.has(k))surfaceTextures.set(k,createCottageSurfaceTexture(k));return surfaceTextures.get(k)};let night=false,disposed=false;
 model.traverse(mesh=>{
  if(!mesh.isMesh)return;
  for(let o=mesh;o;o=o.parent)if(!o.visible)return;
  const original=mesh.material,source=[original].flat(),updated=source.map(m=>{
   if(!m?.isMeshStandardMaterial||(m.emissive?.getHex()!==0&&m.emissiveIntensity>0))return m;
   const role=roleFor(mesh,m);if(!role)return m;
   const kind=!m.map&&mesh.geometry?.attributes.uv?({wall:'plaster',wood:'wood',deep:'wood',roof:'wood',roofAlt:'wood',linen:'linen'}[role]??null):null;
   const key=m.uuid+'/'+role+'/'+(kind??'original');
   if(!clones.has(key)){const clone=m.clone();clone.color.set(palette[role]);clone.roughness=role==='wall'?.96:role==='stone'?.94:.84;if(kind){clone.map=texture(kind);clone.bumpMap=texture(kind+'-height');clone.bumpScale=kind==='plaster'?.0022:kind==='linen'?.0016:.002;clone.roughnessMap=texture(kind+'-roughness');clone.roughness=1;}clones.set(key,{clone,role});}
   return clones.get(key).clone;
  });
  if(updated.some((m,i)=>m!==source[i])){records.push({mesh,original});mesh.material=Array.isArray(original)?updated:updated[0];}
 });
 const root=new THREE.Group();root.name='cozy-yard-contact-shades';model.add(root);
 const tex=shadeTexture(),mat=new THREE.MeshBasicMaterial({color:'#846c55',map:tex,transparent:true,opacity:.19,depthWrite:false,toneMapped:false});
 const geometries=[];
 for(const [name,x,z,w,d] of [
  ['house',.65,-.8,2.5,2],['bench',-1.15,-.18,1.2,.6],['tree',-1.35,-.65,.82,.76],
  ['porch-left',-.025,.28,.26,.24],['porch-right',.915,.28,.26,.24]
 ]){
  const g=new THREE.PlaneGeometry(w,d),mesh=new THREE.Mesh(g,mat);geometries.push(g);mesh.name='cozy-yard-'+name+'-contact';mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.017,z);mesh.userData.decorativeOnly=true;root.add(mesh);
 }
 function setNight(value){if(disposed)return;night=!!value;for(const {clone,role} of clones.values())clone.color.set(palette[role]).multiplyScalar(night?.97:1);mat.opacity=night?.13:.19;}
 return {root,setNight,getState:()=>({night,materialOverrides:records.length,materialClones:clones.size,surfaceTextures:surfaceTextures.size,contactShades:root.children.length,disposed}),dispose(){if(disposed)return;disposed=true;for(const r of records)r.mesh.material=r.original;for(const {clone} of clones.values())clone.dispose();root.removeFromParent();for(const g of geometries)g.dispose();mat.dispose();tex.dispose();for(const t of surfaceTextures.values())t.dispose();}};
}
export function applyCozyHomeLighting({ambient,sun,renderer,night,isHome}){
 if(!isHome)return false;
 ambient.color.set(night?'#c7d1e8':'#fff5e4');ambient.groundColor.set(night?'#64677a':'#cbb899');ambient.intensity=night?1.1:1.6;
 sun.color.set(night?'#b5c8eb':'#fff0d8');sun.intensity=night?.46:2.05;renderer.toneMappingExposure=night?1.08:1.02;
 return true;
}
export function applyCozyFixtureEmission(material,night){
 if(material.name==='Mat_WindowGlow'){material.emissiveIntensity=night?1.45:.025;return true;}
 if(material.name==='Mat_LanternGlow'){material.emissiveIntensity=night?2.2:0;return true;}
 return false;
}
