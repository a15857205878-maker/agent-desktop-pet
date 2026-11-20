import {createRoomSoftSurfaceTexture} from './room-soft-materials.mjs';
import * as THREE from 'three';
import {createRoomFinalFurnishings} from './room-final-furnishings.mjs';
import {STUDY_LAYOUT} from './reference-room-layout.mjs';

// Project a window aperture along one consistent sunlight direction. A deliberate
// miniature-style light decal avoids cutting holes into the supplied baked GLB.
export function projectWindowPane({left,right,bottom,top,z,floor,direction}){
 if(!direction?.every(Number.isFinite)||direction[1]>=-1e-6)return [];
 return [[left,bottom],[right,bottom],[right,top],[left,top]].map(([x,y])=>{
  const t=(floor-y)/direction[1];return [x+direction[0]*t,floor,z+direction[2]*t];
 });
}

function proceduralTexture(kind){
 if(['plaster','plaster-height','linen-height'].includes(kind)){
  const w=128,data=new Uint8Array(w*w*4),weave=kind==='linen-height',height=kind.endsWith('height');
  for(let y=0;y<w;y++)for(let x=0;x<w;x++){
   const fiber=weave?(Math.sin(x*Math.PI/2)*Math.sin(y*Math.PI/2)*.35+Math.sin((x+y)*Math.PI/8)*.1):
    Math.sin(x*Math.PI/16)*Math.cos(y*Math.PI/32)*.25+Math.sin((x*3+y*5)*Math.PI/32)*.12;
   const v=Math.round(height?128+fiber*40:253+fiber*3),i=(y*w+x)*4;
   data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
  }
  const t=new THREE.DataTexture(data,w,w);t.name='cottage-'+kind;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;
  t.colorSpace=height?THREE.NoColorSpace:THREE.SRGBColorSpace;t.repeat.set(weave?5:2,weave?5:2);t.needsUpdate=true;return t;
 }
 if(typeof document==='undefined'){
  const t=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);t.needsUpdate=true;return t;
 }
 const c=document.createElement('canvas');c.width=c.height=kind==='wood'?512:256;
 const ctx=c.getContext('2d'),w=c.width;
 if(kind==='wood'||kind==='linen'){
  ctx.fillStyle='#fffdf7';ctx.fillRect(0,0,w,w);let seed=29;
  const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
  if(kind==='wood')for(let i=0;i<130;i++){
   const y=rand()*w;ctx.strokeStyle=`rgba(124,87,49,${.025+rand()*.07})`;ctx.lineWidth=.5+rand()*.7;
   ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(w*.3,y-3,w*.65,y+4,w,y+rand()*3);ctx.stroke();
  }else for(let i=0;i<w;i+=3){ctx.strokeStyle='rgba(135,109,139,.045)';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,w);ctx.moveTo(0,i);ctx.lineTo(w,i);ctx.stroke();}
 }else{
  const img=ctx.createImageData(w,w);
  for(let y=0;y<w;y++)for(let x=0;x<w;x++){
   const u=(x+.5)/w,v=(y+.5)/w;
   const alpha=kind==='shadow'?Math.max(0,1-Math.hypot((u-.5)*2,(v-.5)*2))**1.7:
    Math.min(1,Math.min(u,1-u,v,1-v)*14)**.85*(1-.42*v);
   const i=(y*w+x)*4;img.data[i]=img.data[i+1]=img.data[i+2]=255;img.data[i+3]=Math.round(alpha*255);
  }ctx.putImageData(img,0,0);
 }
 const t=new THREE.CanvasTexture(c);t.name='cottage-'+kind;t.colorSpace=THREE.SRGBColorSpace;
 if(kind==='wood'||kind==='linen'){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;}
 return t;
}

export function createRoomAtmosphere(scene,studyModel){
 const furnishingBedroom=scene.getObjectByName('bedroom-scene-root'),finalFurnishings=studyModel&&furnishingBedroom?createRoomFinalFurnishings(studyModel,furnishingBedroom):null;
 const roots=[],geometries=new Set(),materials=new Set(),overrides=[],hidden=[],textures=new Map(),clones=new Map();let disposed=false,soft=false,bedsideLight=null,bedsideHalo=null,bedsideBefore=null;
 const texture=k=>{if(!textures.has(k))textures.set(k,createRoomSoftSurfaceTexture(k)??proceduralTexture(k));return textures.get(k)};
 const geometry=g=>{geometries.add(g);return g};
 const material=m=>{materials.add(m);return m};
 function add(group,name,g,m,position){const o=new THREE.Mesh(geometry(g),m);o.name=name;o.position.set(...position);o.userData.roomDecoration=true;group.add(o);return o;}
 function root(parent,room){const g=new THREE.Group();g.name='room-atmosphere-'+room;parent.add(g);roots.push(g);return g;}
 function finishMaterials(parent){
  parent.traverse(o=>{
   if(!o.isMesh||o.userData.roomDecoration||o.name.includes('hotspot'))return;
   const kind=/bedroom-wall-|study-architecture-wall/i.test(o.name)?'plaster':/bed.*(pillow|quilt|blanket|mattress)|stool.*(lavender|seat|cushion)|curtain|chair-(seat|backrest|wing|pillow)|reading-rug|architecture-rug/i.test(o.name)?'linen':
    /wood|beam|wardrobe|bookshelf|bed-(headboard|frame|footboard)|windowsill|plinth|bedroom-floor|study.*floor|study.*wood|study.*plinth/i.test(o.name)?'wood':null;
   if(!kind)return;
   const original=o.material;
   const updated=[original].flat().map(m=>{
    // Existing baked PBR texture remains authoritative; only untextured additions gain grain.
    if(!m?.isMeshStandardMaterial||m.map||m.opacity<.95)return m;
    const bedCloth=kind==='linen'&&/^bed-/.test(o.name),key=m.uuid+'/'+kind+(bedCloth?'/bed':'');
    if(!clones.has(key)){
     const c=m.clone();c.map=texture(kind);c.roughnessMap=texture(kind+'-roughness');c.roughness=1;
     c.bumpMap=texture(kind+'-height');c.bumpScale=kind==='plaster'?.0009:kind==='linen'?.0008:.0015;
     if(kind==='plaster'){c.color.set('#fff4e4');c.emissive.set('#ffe4c6');c.emissiveIntensity=.075;}
     if(bedCloth)c.color.lerp(new THREE.Color('#fff4e7'),.10);
     clones.set(key,c);materials.add(c);
    }
    return clones.get(key);
   });
   if(updated.some((m,i)=>m!==[original].flat()[i])){overrides.push({mesh:o,original});o.material=Array.isArray(original)?updated:updated[0];}
  });
 }
 function windowLight(g,x,z,dir){
  const glow=material(new THREE.MeshBasicMaterial({map:texture('sunlight'),color:'#ffe7b8',transparent:true,opacity:.03,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
  const columns=2,rows=2,width=1.13,height=1.16,bottom=1.23;
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
   const p=projectWindowPane({left:x-width/2+col*width/columns+.035,right:x-width/2+(col+1)*width/columns-.035,
    bottom:bottom+row*height/rows+.025,top:bottom+(row+1)*height/rows-.025,z,floor:.225,direction:dir});
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p.flat(),3));geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));geo.setIndex([0,2,1,0,3,2]);geo.computeVertexNormals();
   add(g,'window-pane-floor-light',geo,glow,[0,0,0]);
  }
  const light=new THREE.SpotLight('#ffe8c7',.65,4.8,.82,.95,2);light.name='window-interior-bounce';light.position.set(x,2.18,z+.13);light.target.position.copy(light.position).add(new THREE.Vector3(...dir).multiplyScalar(1.93/-dir[1]));g.add(light,light.target);
 }
 let contactMaterial;
 function contact(g,x,z,sx,sz,y=.226,name='furniture-contact-shade'){
  contactMaterial??=material(new THREE.MeshBasicMaterial({map:texture('shadow'),color:'#79604b',transparent:true,opacity:.28,depthWrite:false,toneMapped:false}));
  const o=add(g,name,new THREE.PlaneGeometry(sx,sz),contactMaterial,[x,y,z]);o.rotation.x=-Math.PI/2;
 }
 function bedroomWallArt(group){
  const frame=material(new THREE.MeshStandardMaterial({color:'#b5814d',map:texture('wood'),roughness:.85}));
  const paper=material(new THREE.MeshStandardMaterial({color:'#f3e3cd',roughness:.97}));
  const foliage=material(new THREE.MeshStandardMaterial({color:'#82916e',roughness:.95}));
  const blossom=material(new THREE.MeshStandardMaterial({color:'#ad8abd',roughness:.95}));
  const x=1.838,y=1.72,z=-.48;
  add(group,'bedroom-botanical-frame',new THREE.BoxGeometry(.034,.53,.41),frame,[x,y,z]);
  add(group,'bedroom-botanical-paper',new THREE.BoxGeometry(.009,.46,.34),paper,[x-.019,y,z]);
  const sprig=add(group,'bedroom-botanical-stem',new THREE.BoxGeometry(.005,.268,.013),foliage,[x-.026,y-.036,z]);
  sprig.rotation.x=.25;
  for(const [dy,dz,tilt] of [[-.09,-.041,-.65],[-.025,.043,.68],[.035,-.044,-.65]]){
   const leaf=add(group,'bedroom-botanical-leaf',new THREE.SphereGeometry(1,12,8),foliage,[x-.028,y+dy,z+dz]);
   leaf.scale.set(.004,.048,.021);
   leaf.rotation.x=tilt;
  }
  for(const [dy,dz] of [[.122,.044],[.152,.020],[.123,.002]]){
   const petal=add(group,'bedroom-botanical-petal',new THREE.SphereGeometry(1,12,8),blossom,[x-.028,y+dy,z+dz]);
   petal.scale.set(.005,.025,.022);
  }
 }
 if(studyModel){
  finishMaterials(studyModel);const g=root(studyModel,'study');windowLight(g,.3,-1.72,[.22,-1,1.25]);
  // Supplied study body is [-2,0,-2]..[2,3,2] in model-local coordinates.
  // Its X mirror remains authoritative; these follow the two existing walls.
  const crown=material(new THREE.MeshStandardMaterial({color:'#c29359',map:texture('wood'),roughness:.78}));
  if(!studyModel.getObjectByName('reference-study-room'))add(g,'study-honey-crown-back',new THREE.BoxGeometry(4.02,.10,.15),crown,[0,2.99,-1.96]);
  if(!studyModel.getObjectByName('reference-study-room'))add(g,'study-honey-crown-side',new THREE.BoxGeometry(.15,.10,4.02),crown,[-1.96,2.99,0]);
  contact(g,.3,-1.25,1.8,.94);if(finalFurnishings)contact(g,1.52,-1.02,.48,.54);
  if(studyModel.getObjectByName('reference-study-room')){
   contact(g,.30,-.82,.58,.52,.235,'desk-chair-rug-contact');
   contact(g,-STUDY_LAYOUT.chairCenter[0],STUDY_LAYOUT.chairCenter[2],.86,.80);
   contact(g,-STUDY_LAYOUT.sideTable.center[0],STUDY_LAYOUT.sideTable.center[2],.42,.42);
   contact(g,-.55,-1.55,.88,.55);
   contact(g,0,-1.77,3.8,.22);contact(g,-1.77,0,.22,3.8);
   const corner=material(new THREE.MeshBasicMaterial({map:texture('shadow'),color:'#7c624c',transparent:true,opacity:.11,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
   add(g,'study-soft-wall-corner',new THREE.PlaneGeometry(.32,2.58),corner,[-1.73,1.57,-1.851]);
   add(g,'study-soft-wall-corner-side',new THREE.PlaneGeometry(.32,2.58),corner,[-1.851,1.57,-1.73]).rotation.y=Math.PI/2;
  }else contact(g,-.68,1.60,.86,.80);
 }
 const bedroom=scene.getObjectByName('bedroom-scene-root');
 if(bedroom){
  finishMaterials(bedroom);const g=root(bedroom,'bedroom');windowLight(g,-.46,-1.72,[-.22,-1,1.25]);
  bedroomWallArt(g);
  // The wall halo is local to the bedside lamp. It never overlays the actor.
  bedsideLight=bedroom.children.find(o=>o.isPointLight)??null;
  if(bedsideLight){
   bedsideBefore={name:bedsideLight.name,color:bedsideLight.color.clone(),position:bedsideLight.position.clone(),distance:bedsideLight.distance,decay:bedsideLight.decay};
   bedsideLight.name='bedside-local-bounce';bedsideLight.position.set(1.43,1.02,.22);bedsideLight.distance=1.65;bedsideLight.decay=2;bedsideLight.color.set('#ffd69a').multiplyScalar(.45);
  }
  const haloMat=material(new THREE.MeshBasicMaterial({map:texture('shadow'),color:'#ffdc9c',transparent:true,opacity:.14,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,blending:THREE.AdditiveBlending}));
  bedsideHalo=add(g,'bedside-wall-halo',new THREE.PlaneGeometry(.88,1.02),haloMat,[1.851,1.04,.22]);bedsideHalo.rotation.y=-Math.PI/2;
  const oldPatch=bedroom.getObjectByName('bedroom-sunlight-floor-patch');if(oldPatch){hidden.push({mesh:oldPatch,visible:oldPatch.visible});oldPatch.visible=false;}
  contact(g,1.20,-.47,1.70,1.40);if(finalFurnishings)contact(g,.22,-.47,.45,.70);contact(g,.68,-1.58,1.12,.75);contact(g,-.9,-.65,1.22,1.0);
  for(const z of [-.90,-.04])contact(g,.60,z,.22,.22);
  const cornerShade=material(new THREE.MeshBasicMaterial({map:texture('shadow'),color:'#7c624c',transparent:true,opacity:.11,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
  add(g,'soft-wall-corner',new THREE.PlaneGeometry(.32,2.58),cornerShade,[1.73,1.57,-1.851]);
  add(g,'soft-wall-corner-side',new THREE.PlaneGeometry(.32,2.58),cornerShade,[1.851,1.57,-1.73]).rotation.y=-Math.PI/2;
  contact(g,0,-1.77,3.8,.22);contact(g,1.77,0,.22,3.8);
  const seamMat=material(new THREE.MeshStandardMaterial({color:'#e0d2e7',roughness:.97}));
  // Sample the actual cloth once at construction. Curved threads follow rolled
  // textile edges without adding per-frame raycasts or moving support anchors.
  const clothSurfaces=['bed-quilt-cream','bed-blanket-lavender'].map(n=>bedroom.getObjectByName(n)).filter(Boolean);
  bedroom.updateWorldMatrix(true,true);
  const stitchRay=new THREE.Raycaster(),stitchDown=new THREE.Vector3(0,-1,0).transformDirection(bedroom.matrixWorld);
  function stitch(name,start,end){
   const points=[];
   for(let i=0;i<=16;i++){
    const t=i/16,x=start[0]+(end[0]-start[0])*t,z=start[1]+(end[1]-start[1])*t;
    const origin=bedroom.localToWorld(new THREE.Vector3(x,2,z));stitchRay.set(origin,stitchDown);
    const hit=stitchRay.intersectObjects(clothSurfaces,false)[0];
    const p=hit?bedroom.worldToLocal(hit.point.clone()):new THREE.Vector3(x,.63,z);p.y+=.002;points.push(p);
   }
   add(g,name,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,.0011,5,false),seamMat,[0,0,0]);
  }
  for(const z of [-.78,-.62,-.46,-.30,-.14])stitch('quilt-quilting-stitch',[.695,z],[1.065,z]);
  for(const x of [.73,.88,1.03])stitch('quilt-cross-stitch',[x,-.85],[x,-.09]);
  const piping=material(new THREE.MeshStandardMaterial({color:'#e5d5ec',roughness:.95}));
  // Side piping emphasizes the sewn thickness while leaving the character support surface untouched.
  for(const z of [-.905,-.035])add(g,'quilt-soft-edge-piping',new THREE.CylinderGeometry(.006,.006,.43,8),piping,[.88,.61,z]).rotation.z=Math.PI/2;
  const mattress=bedroom.getObjectByName('bed-mattress');
  if(mattress){
   mattress.geometry.computeBoundingBox();
   const half=mattress.geometry.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(.5);
   const x=half.x,z=half.z,r=.034;
   const edge=new THREE.Path();
   edge.moveTo(-x+r,-z);edge.lineTo(x-r,-z);edge.quadraticCurveTo(x,-z,x,-z+r);
   edge.lineTo(x,z-r);edge.quadraticCurveTo(x,z,x-r,z);
   edge.lineTo(-x+r,z);edge.quadraticCurveTo(-x,z,-x,z-r);
   edge.lineTo(-x,-z+r);edge.quadraticCurveTo(-x,-z,-x+r,-z);
   const outline=edge.getPoints(8).slice(0,-1).map(p=>new THREE.Vector3(p.x,0,p.y));
   const hem=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline,true),96,.004,6,true);
   const linen=material(new THREE.MeshStandardMaterial({color:'#d5bfa5',roughness:.96}));
   add(g,'bed-mattress-piped-hem',hem,linen,[mattress.position.x,mattress.position.y+.054,mattress.position.z]);
  }
  const joint=material(new THREE.MeshBasicMaterial({color:'#9e744c',transparent:true,opacity:.14,depthWrite:false,toneMapped:false}));
  for(let i=0;i<11;i++)for(const z of [i%2?-.98:-.42,i%2?.62:1.18]){
   const x=-1.8+i*.32;if(x>.86&&z>.45)continue; // Preserve the actual stairwell cutout.
   const o=add(g,'bedroom-staggered-plank-joint',new THREE.PlaneGeometry(.29,.007),joint,[x,.225,z]);o.rotation.x=-Math.PI/2;
  }
  const drapes=[];bedroom.traverse(o=>{if(o.name==='bedroom-curtain-drape')drapes.push(o)});
  const cloth=material(new THREE.MeshStandardMaterial({color:'#eed9e6',map:texture('linen'),roughness:.95,side:THREE.DoubleSide}));
  for(const old of drapes){
   hidden.push({mesh:old,visible:old.visible});old.visible=false;
   const geo=new THREE.PlaneGeometry(.31,1.25,24,20),pos=geo.attributes.position;
   for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),drop=(.625-y)/1.25;
    const gathered=1-.24*Math.exp(-((y+.22)**2)/.045)+.12*drop;
    pos.setXYZ(i,x*gathered,y-.012*drop,.020*Math.cos((x/.31+.5)*Math.PI*6));
   }geo.computeVertexNormals();
   add(g,'soft-pleated-bedroom-curtain',geo,cloth,[old.position.x,old.position.y,old.position.z+.045]);
  }
 }
 function setSoft(value){if(disposed)return;soft=!!value;if(bedsideHalo)bedsideHalo.material.opacity=soft?.12:.07;}
 const getState=()=>({rooms:roots.map(r=>r.name.replace('room-atmosphere-','')),textureCount:textures.size,furnishings:finalFurnishings?.getState()??null,materialOverrides:overrides.length,decorMeshes:[...geometries].length,soft,bedsideIntensity:bedsideLight?.intensity??0,disposed});
 return {getState,setSoft,dispose(){if(disposed)return;disposed=true;if(bedsideBefore){bedsideLight.name=bedsideBefore.name;bedsideLight.color.copy(bedsideBefore.color);bedsideLight.position.copy(bedsideBefore.position);bedsideLight.distance=bedsideBefore.distance;bedsideLight.decay=bedsideBefore.decay;}for(const r of overrides)r.mesh.material=r.original;for(const r of hidden)r.mesh.visible=r.visible;finalFurnishings?.dispose();for(const r of roots)r.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures.values())t.dispose();}};
}
