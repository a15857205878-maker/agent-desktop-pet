import {leastCoveredStand} from './actor-clearance.mjs';
import * as THREE from 'three';
import {removeConnectedWhite,poseFade} from './outdoor-actor-core.mjs';

const poses={front:{x:452,y:997,height:1.45},back:{x:453,y:988,height:1.45},sit:{x:462,y:680,height:1.18}};
const stands={home:[-.20,.055,1.05],plaza:[-.40,.065,1.05],orchard:[0,.065,.70]};
export async function createOutdoorActor({assets,parents,camera,onChange}){
 const textures={},pixels={},anchors=Object.fromEntries(Object.entries(stands).map(([k,v])=>[k,[...v]]));
 try{for(const key of Object.keys(poses)){
  const image=new Image();image.src=assets[key];await image.decode();
  const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const p=ctx.getImageData(0,0,c.width,c.height);removeConnectedWhite(p.data,c.width,c.height);ctx.putImageData(p,0,0);pixels[key]=p;
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;textures[key]=map;
 }}catch(e){for(const t of Object.values(textures))t.dispose();throw e}
 const material=new THREE.SpriteMaterial({map:textures.front,transparent:true,alphaTest:.10,depthTest:true,depthWrite:false,toneMapped:false});
 const sprite=new THREE.Sprite(material);sprite.name='outdoor-dragon';sprite.userData.townAction='actor';
 let clearanceKey='',clearPosition=null;
 let area='home',pose='front',pending=null,transition=null,paused=false,disposed=false,timer=null,frames=0,night=false,baseHeight=poses.front.height;
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 function apply(next,anchor,scale=1){pose=next;material.map=textures[pose];material.needsUpdate=true;const p=poses[pose];sprite.center.set(p.x/1024,1-p.y/1024);baseHeight=p.height*scale;sprite.scale.set(baseHeight,baseHeight,1);sprite.position.fromArray(anchor);}
 function finish(){if(pending)apply(pending.pose,pending.anchor,pending.scale);pending=null;transition=null;material.opacity=1;sprite.scale.y=baseHeight;material.rotation=0}
 function stop(){clearTimeout(timer);timer=null}
 function tick(){timer=null;if(disposed||paused||motion.matches)return;const now=performance.now();if(transition!==null){const f=poseFade((now-transition)/420);if(f.swap&&pending){apply(pending.pose,pending.anchor,pending.scale);pending=null}material.opacity=f.opacity;if(now-transition>=420)finish()}
  sprite.scale.y=baseHeight*(1+Math.sin(now/1400)*.004);material.rotation=Math.sin(now/1900)*.003;frames++;onChange();timer=setTimeout(tick,1000/24);
 }
 function sync(){stop();if(paused||motion.matches){finish();onChange()}else tick()}
 function select(next,anchor,scale=1){if(disposed||paused||transition!==null)return false;pending={pose:next,anchor,scale};if(motion.matches){finish();onChange()}else{transition=performance.now();sync()}return true}
 function setArea(next){clearanceKey='';clearPosition=null;finish();area=next;parents[area].add(sprite);apply('front',anchors[area]);sync()}
 function changeMotion(){sync()}motion.addEventListener('change',changeMotion);
 setArea('home');
 function avoidFurniture(boxes,w,h){if(pose==='sit'||transition!==null)return;const key=area+JSON.stringify([camera.projectionMatrix.elements,camera.matrixWorld.elements,boxes.map(b=>[b.min.toArray(),b.max.toArray()])]);if(key!==clearanceKey){clearanceKey=key;const initial=anchors[area],choices=[initial,...(area==='home'?[[.45,.055,1.1],[-.8,.055,1.35],[.15,.055,1.55],[-1,.055,1.15]]:area==='plaza'?[[.5,.065,1.15],[-.65,.065,.8],[.65,.065,.65]]:[[0,.065,1.3],[.28,.065,.95],[-.2,.065,1.4]])];const itemRects=boxes.map(b=>{const points=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=new THREE.Vector3(x,y,z).project(camera);points.push([(p.x+1)*w/2,(1-p.y)*h/2])}return {left:Math.min(...points.map(p=>p[0]))-4,right:Math.max(...points.map(p=>p[0]))+4,top:Math.min(...points.map(p=>p[1]))-4,bottom:Math.max(...points.map(p=>p[1]))+4}});const size=poses.front.height/(camera.top-camera.bottom)*h;const rects=choices.map(c=>{const p=new THREE.Vector3(...c).project(camera),x=(p.x+1)*w/2,y=(1-p.y)*h/2;return {left:x+(219-452)/1024*size,right:x+(891-452)/1024*size,top:y-(997-27)/1024*size,bottom:y}});clearPosition=choices[leastCoveredStand(rects,itemRects)];}if(clearPosition)sprite.position.fromArray(clearPosition);}
 return {setStandAnchor(next,value){const wanted=value||stands[next];if(anchors[next].every((v,i)=>Math.abs(v-wanted[i])<.00001))return;anchors[next]=[...wanted];clearanceKey='';clearPosition=null;if(next===area&&pose!=='sit'&&transition===null)apply(pose,anchors[next]);},avoidFurniture,sprite,setArea,setNight(value){night=value;material.color.set(value?'#b8bfdc':'#ffffff');onChange()},setPaused(value,hide=false){sprite.visible=!hide;if(paused===value)return;paused=value;sync()},turn(){return select(pose==='sit'?'front':pose==='front'?'back':'front',clearPosition||anchors[area])},sit(anchor,scale=1){return select('sit',anchor,scale)},
  opaque(uv){if(!uv)return false;const p=pixels[pose],x=Math.min(p.width-1,Math.max(0,Math.floor(uv.x*p.width))),y=Math.min(p.height-1,Math.max(0,Math.floor((1-uv.y)*p.height)));return p.data[(y*p.width+x)*4+3]>25},
  point(){return sprite.position.clone().addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1),pose==='sit'?.25:.6)},
  state:()=>({pose,area,height:baseHeight,transition:transition!==null,paused,visible:sprite.visible,frames,night,instances:1}),
  dispose(){disposed=true;stop();motion.removeEventListener('change',changeMotion);sprite.removeFromParent();material.dispose();for(const t of Object.values(textures))t.dispose()}
 };
}
