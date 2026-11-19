import * as THREE from 'three';

// Use the same geometry and transforms as the visible prop. The tint stays
// inside its silhouette and shares one material and a reusable overlay pool.
export function createTownHoverHighlight(onChange){
 const tint=new THREE.MeshBasicMaterial({
  color:'#fff1bb',transparent:true,opacity:.23,depthWrite:false,toneMapped:false,
  polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2,side:THREE.FrontSide
 });
 const pool=[];
 let target=null,kind=null,attached=0;

 function detach(){
  for(let i=0;i<attached;i++){
   pool[i].removeFromParent();
   pool[i].geometry=null;
  }
  attached=0;
 }
 function set(nextKind,next){
  if(next===target&&nextKind===kind)return;
  detach();
  kind=nextKind;
  target=next;
  if(target){
   const meshes=[];
   target.traverseVisible(mesh=>{
    if(mesh.isMesh&&mesh.layers.mask!==0&&[mesh.material].flat().some(m=>!m.transparent)){
     meshes.push(mesh);
    }
   });
   for(const mesh of meshes){
    const overlay=pool[attached]??new THREE.Mesh(mesh.geometry,tint);
    if(!pool[attached]){
     overlay.name='town-hotspot-tint';
     overlay.raycast=()=>{};
     pool.push(overlay);
    }
    overlay.geometry=mesh.geometry;
    mesh.add(overlay);
    attached++;
   }
  }
  onChange();
 }
 return {
  set,
  clear(){if(target)set(null,null);},
  setNight(value){tint.color.set(value?'#e5d1fa':'#fff1bb');tint.opacity=value?.27:.23;},
  state:()=>({kind,target:target?.name??null,meshes:attached}),
  dispose(){detach();target=null;kind=null;tint.dispose();}
 };
}
