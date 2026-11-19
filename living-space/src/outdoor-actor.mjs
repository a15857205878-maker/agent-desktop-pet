import {leastCoveredStand} from './actor-clearance.mjs';
import * as THREE from 'three';
import {removeConnectedWhite,poseFade} from './outdoor-actor-core.mjs';
import {loadBedroomWalkFrames} from './bedroom-walk.mjs';
import {buildDistrictTrack, createWalkTiming, easeActor, planDistrictWalk, sampleDistrictTrack, sampleWalkTiming} from './town-actor-motion.mjs';
import {bindTownPoseBlend} from './town-pose-blend.mjs';

const poses={front:{x:452,y:997,height:1.45},back:{x:453,y:988,height:1.45},sit:{x:462,y:680,height:1.18}};
const stands={home:[-.20,.055,1.05],plaza:[-.40,.065,1.05],orchard:[0,.065,.70]};
// Measured waist and eye landmarks in the four cropped, right-facing tiles.
// The ground height comes from the sole, but the lateral root follows her
// body. Using whichever shoe happens to be lowest shifts the whole drawing.
const gaitLandmarks=[
 {rootX:.64,face:[.655,.652]},
 {rootX:.66,face:[.666,.65]},
 {rootX:.65,face:[.656,.654]},
 {rootX:.66,face:[.67,.65]}
];
function seatRebound(progress,delay){
 const u=THREE.MathUtils.clamp((progress-delay)/(1-delay),0,1);
 return Math.sin(2*Math.PI*u)*(1-u)**2;
}
export async function createOutdoorActor({assets,parents,camera,homeContact=false,porchLight,onChange}){
 const textures={},pixels={},anchors=Object.fromEntries(Object.entries(stands).map(([k,v])=>[k,[...v]]));
 try{for(const key of Object.keys(poses)){
  const image=new Image();image.src=assets[key];await image.decode();
  const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const p=ctx.getImageData(0,0,c.width,c.height);removeConnectedWhite(p.data,c.width,c.height);ctx.putImageData(p,0,0);pixels[key]=p;
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;textures[key]=map;
 }}catch(e){for(const t of Object.values(textures))t.dispose();throw e}
 const material=new THREE.SpriteMaterial({map:textures.front,transparent:true,alphaTest:.10,depthTest:true,depthWrite:true,toneMapped:false});
 const sprite=new THREE.Sprite(material);sprite.name='outdoor-dragon';sprite.userData.townAction='actor';
 const shadeCanvas=document.createElement('canvas');shadeCanvas.width=shadeCanvas.height=64;
 const shadeContext=shadeCanvas.getContext('2d'),shadeGradient=shadeContext.createRadialGradient(32,32,2,32,32,31);
 shadeGradient.addColorStop(0,'rgba(72,50,70,.56)');shadeGradient.addColorStop(.58,'rgba(72,50,70,.29)');
 shadeGradient.addColorStop(1,'rgba(72,50,70,0)');
 shadeContext.fillStyle=shadeGradient;shadeContext.fillRect(0,0,64,64);
 const contactTexture=new THREE.CanvasTexture(shadeCanvas);
 const contact=new THREE.Mesh(new THREE.PlaneGeometry(.65,.43),new THREE.MeshBasicMaterial({
  map:contactTexture,transparent:true,depthWrite:false,opacity:.72,polygonOffset:true,polygonOffsetFactor:-1
 }));
 contact.name='town-dragon-contact';contact.rotation.x=-Math.PI/2;contact.raycast=()=>{};
 const seatContact=new THREE.Mesh(new THREE.PlaneGeometry(.36,.19),contact.material.clone());
 seatContact.name='town-dragon-seat-contact';seatContact.rotation.x=-Math.PI/2;seatContact.raycast=()=>{};
 seatContact.visible=false;
 const poseFrames=Object.fromEntries(Object.entries(poses).map(([key,frame])=>[key,{
  texture:textures[key], center:[frame.x/1024,1-frame.y/1024], width:frame.height,height:frame.height,
  face:key==='sit'?[.447,.652]:key==='back'?[.412,.652]:[.42,.652]
 }]));
 // In the 3D benches the skirt, just below the knees in the original
 // drawing, rests on the seat. The painted scene has its own registration.
 const seatFrame={...poseFrames.sit,center:[poseFrames.sit.center[0],1-730/1024]};
 const gait=(await loadBedroomWalkFrames(assets.walk).catch(()=>[])).map((frame,index)=>({
  ...frame,width:1.42*frame.aspect,height:1.42,
  center:[gaitLandmarks[index].rootX,frame.center[1]],face:gaitLandmarks[index].face
 }));
 const leftGait=gait.map(frame=>{
  const canvas=document.createElement('canvas');
  canvas.width=frame.texture.image.width;canvas.height=frame.texture.image.height;
  const context=canvas.getContext('2d');
  context.translate(canvas.width,0);context.scale(-1,1);context.drawImage(frame.texture.image,0,0);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=frame.texture.colorSpace;texture.minFilter=frame.texture.minFilter;
  return {...frame,texture,face:[1-frame.face[0],frame.face[1]],center:[1-frame.center[0],frame.center[1]]};
 });
 const {show:showPose,setRelief,setSeatSway}=bindTownPoseBlend(sprite);
 const nightAmbient=new THREE.Color('#b8bfdc'),porchWarmth=new THREE.Color('#edd1b7');
 let clearanceKey='',clearPosition=null;
 let area='home',pose='front',pending=null,transition=null,paused=false,disposed=false,timer=null,frames=0,night=false,baseHeight=poses.front.height;
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let journey=null,manualStand=false,seatApproach=null,lastTick=null;
 let seatWeight=0,footLift=0;
 const walkPoint=new THREE.Vector3(),walkDirection=new THREE.Vector3(),approachPoint=new THREE.Vector3(),seatPoint=new THREE.Vector3();
 function apply(next,anchor,scale=1){
  pose=next;
  setSeatSway(0,0);
  showPose(next==='sit'&&scale===1?seatFrame:poseFrames[next]);
  baseHeight=poses[next].height*scale;
  sprite.scale.multiplyScalar(scale);
  sprite.position.fromArray(anchor);
  seatWeight=next==='sit'?1:0;
  if(seatWeight)seatPoint.fromArray(anchor);
  footLift=0;
  syncContact();
 }
 function syncContact(){
  const {x,z}=sprite.position;
  const home=area==='home';
  contact.position.set(x,home?.050:.073,z+.018);
  contact.scale.set(1+footLift*.12,1+footLift*.15,1);
  contact.material.opacity=(home?(night?.65:.54):(night?.77:.66))*(1-.60*seatWeight)*(1-.20*footLift);
  if(night){
   const warmth=home&&porchLight?1-THREE.MathUtils.smoothstep(Math.hypot(x-porchLight.x,z-porchLight.z),.24,1.36):0;
   material.color.copy(nightAmbient).lerp(porchWarmth,warmth*.65);
  }else material.color.set(0xffffff);
  seatContact.visible=contact.visible&&seatWeight>.015;
  seatContact.position.copy(seatPoint);
  seatContact.position.y-=.003;
  seatContact.position.z-=.155;
  seatContact.material.opacity=.68*seatWeight;
 }
 function finish(){if(pending)apply(pending.pose,pending.anchor,pending.scale);pending=null;transition=null;material.opacity=1;sprite.scale.y=baseHeight;material.rotation=0}
 function stop(){clearTimeout(timer);timer=null}
 function settleJourney(completed) {
  if(!journey)return;
  const move=journey;journey=null;
  if(completed){
   apply(move.pose,move.anchor);
   seatApproach=move.pose==='sit'?move.approach:null;
   manualStand=true;
   if(move.after)queueMicrotask(move.after);
  }
  material.rotation=0;
  move.resolve?.(completed);
 }

 function sampleRise(move,t){
  const u=t/move.rise;
  const lifted=easeActor(THREE.MathUtils.clamp((u-.18)/.78,0,1));
  const lean=Math.sin(Math.PI*u)**2;
  seatWeight=1-lifted;
  footLift=0;
  showPose(seatFrame,poseFrames.front,lifted);
  sprite.position.fromArray(move.origin).lerp(approachPoint.fromArray(move.track.segments[0].from),lifted);
  sprite.position.y-=.026*lean;
  sprite.position.z+=.049*lean;
  sprite.scale.y*=1-.032*lean;
  material.rotation=.066*lean;
 }
 function sampleWalk(move,t,delta){
  const {distance,speed}=sampleWalkTiming(move.timing,t);
  const heading=sampleDistrictTrack(move.track,distance/move.track.length,walkPoint,move.direction);
  move.speed=speed;
  move.stride=move.startStride+Math.max(0,distance-move.firstStepOffset)/.38;
  const halfStep=move.stride%2;
  const braking=move.plazaBench?easeActor(THREE.MathUtils.clamp(1-(move.travel-t)/move.release,0,1)):0;
  const frame=THREE.MathUtils.lerp(move.stride*2,move.finalStep,braking);
  const index=Math.floor(frame)%4;
  const nextLeft=heading<0;
  move.launchElapsed=Math.min(move.takeoff,move.launchOffset+t);
  const launch=easeActor(move.launchElapsed/move.takeoff);
  const landing=move.plazaBench?0:move.plantWeight*Math.max(0,1-(move.travel-t)/move.release);
  if(area!=='plaza'&&move.turnElapsed>=150&&launch>.65&&!landing&&Math.abs(heading)>.24&&nextLeft!==move.left){
   move.left=nextLeft;
   move.turnElapsed=0;
  }
  move.turnElapsed=Math.min(150,move.turnElapsed+delta);
  // Keep the authored silhouette in both directions in the plaza. The
  // body leans into the path without reflecting her ornament or tail.
  const frames=area==='plaza'||move.left?leftGait:gait;
  if(landing){
   move.landingPose??=frames[Math.round(frame)%4];
   move.plantedPose??=move.pivot?frames[0]:poseFrames.front;
   showPose(move.landingPose,move.plantedPose,easeActor(landing));
  }else if(launch<1){
   showPose(move.startPose,frames[0],launch);
  }else if(move.turnElapsed<150){
   showPose((move.left?gait:leftGait)[index],frames[index],easeActor(move.turnElapsed/150));
  }else{
   showPose(frames[index],frames[(index+1)%4],easeActor(frame%1));
  }
  sprite.position.copy(walkPoint);
  const strideWeight=Math.min(1,speed/.00155);
  const handoff=move.continuing?easeActor(Math.min(1,t/95)):1;
  seatWeight=0;
  footLift=THREE.MathUtils.lerp(move.initialLift,Math.sin(Math.PI*halfStep)**2*strideWeight*(1-braking),handoff);
  sprite.position.y+=.008*footLift;
  move.pathLean=THREE.MathUtils.lerp(move.pathLean,area==='plaza'?-.036*heading*launch:0,1-Math.exp(-delta/90));
  material.rotation=THREE.MathUtils.lerp(move.initialLean,move.pathLean+.013*Math.sin(Math.PI*halfStep)*strideWeight*(1-braking),handoff);
 }
 function sampleArrival(move,t){
  const held=move.landingPose??move.startPose;
  const docking=THREE.MathUtils.clamp(t/move.plant,0,1);
  const plant=easeActor(THREE.MathUtils.lerp(move.plantWeight,1,docking));
  const afterPlant=t-move.plant-move.pivot;
  sprite.position.fromArray(move.approach);
  material.rotation=0;
  seatWeight=0;
  footLift=0;
  if(move.plazaBench&&samplePlazaBenchTurn(move,t))return;
  if(move.pivot&&!move.plazaBench&&sampleInteractionTurn(move,t,held,plant))return;
  if(move.pose==='sit'){
   seatPoint.fromArray(move.anchor);
   if(move.settle&&afterPlant>=move.finishTime){
    move.phase='settle';
    showPose(seatFrame);
    sprite.position.copy(seatPoint);
    seatWeight=1;
    const u=(afterPlant-move.finishTime)/move.settle;
    setSeatSway(.014*seatRebound(u,0),-.028*seatRebound(u,.13));
    return;
   }
   move.phase='sit';
   const u=THREE.MathUtils.clamp(afterPlant/move.finishTime,0,1);
   const sway=Math.sin(Math.PI*u)**2;
   const lower=easeActor(u);
   const slide=easeActor(THREE.MathUtils.clamp((u-.16)/.84,0,1));
   seatWeight=lower*lower;
   showPose(poseFrames.front,seatFrame,lower);
   sprite.position.lerp(approachPoint.fromArray(move.anchor),slide);
   sprite.position.y=THREE.MathUtils.lerp(move.approach[1],move.anchor[1],lower)-.018*sway;
   sprite.scale.y*=1-.042*sway;
   material.rotation=.044*sway;
   return;
  }
  move.phase=move.kind;
  if(move.kind==='gather'){
   const u=THREE.MathUtils.clamp(afterPlant/move.finishTime,0,1);
   const reach=Math.sin(Math.PI*u)**2;
   move.reach=reach;
   showPose(poseFrames.back);
   sprite.scale.y*=1+.045*reach;
   material.rotation=-.085*move.reachSide*reach;
   return;
  }
  if(move.pose==='front'||docking<1)showPose(held,poseFrames.front,plant);
  else showPose(poseFrames.front,poseFrames[move.pose],easeActor(Math.min(1,afterPlant/130)));
  if(move.kind==='watch'&&docking===1){
   const u=THREE.MathUtils.clamp(afterPlant/move.finishTime,0,1);
   const lean=Math.sin(Math.PI*u)**2;
   sprite.position.y-=.025*lean;
   sprite.scale.y*=1-.022*lean;
   material.rotation=.06*lean;
  }
 }
 function samplePlazaBenchTurn(move,t){
  if(t>=move.plant+move.pivot)return false;
  const grounded=move.travel?leftGait[move.finalStep%4]:move.startPose;
  if(t<move.plant){
   move.phase='plant';
   const u=easeActor(t/move.plant);
   showPose(grounded,poseFrames.front,.23*u);
   material.rotation=move.pathLean*(1-.60*u);
   return true;
  }
  move.phase='turn';
  const u=easeActor((t-move.plant)/move.pivot);
  const shift=Math.sin(Math.PI*u)**2;
  showPose(grounded,poseFrames.front,.23+.77*u);
  sprite.scale.x*=1-.035*shift;
  material.rotation=move.pathLean*(.40*(1-u)-.32*shift);
  return true;
 }
 function sampleInteractionTurn(move,t,held,plant){
  const side=move.plantedPose??held;
  if(t<move.plant){
   move.phase='plant';
   showPose(held,side,plant);
   return true;
  }
  if(t>=move.plant+move.pivot)return false;
  move.phase='turn';
  const u=(t-move.plant)/move.pivot;
  const shift=Math.sin(Math.PI*u)**2;
  showPose(side,poseFrames[move.kind==='bench'?'front':'back'],easeActor(u));
  sprite.scale.x*=1-.085*shift;
  material.rotation=(move.left?-.045:.045)*shift;
  return true;
 }
 function stepJourney(delta){
  const move=journey;
  move.elapsed+=delta;
  if(move.elapsed>=move.duration){settleJourney(true);return;}
  const time=move.elapsed-move.rise;
  if(time<0)sampleRise(move,move.elapsed);
  else if(time<move.travel){
   move.phase='walk';
   sampleWalk(move,time,delta);
  }else sampleArrival(move,time-move.travel);
 }
 function tick(){timer=null;if(disposed||paused||motion.matches)return;const now=performance.now(),delta=lastTick===null?0:Math.min(80,now-lastTick);lastTick=now;
  if(journey)stepJourney(delta);
  else{
   if(transition!==null&&pending?.turn){
    pending.elapsed+=delta;
    const u=THREE.MathUtils.clamp(pending.elapsed/(pending.nod?665:385),0,1);
    const turning=pending.nod?Math.min(1,u/.57):u;
    const shift=easeActor(turning);
    const pivot=Math.sin(Math.PI*turning);
    showPose(poseFrames[pose],poseFrames[pending.pose],shift);
    sprite.scale.x*=1-.13*pivot;
    material.rotation=.052*pivot*(pose==='front'?-1:1);
    sprite.position.fromArray(pending.anchor);
    if(pending.nod&&u>.57){
     const dip=Math.sin(Math.PI*(u-.57)/.43)**2;
     sprite.position.y-=.035*dip;
     sprite.scale.y*=1-.024*dip;
     material.rotation-=.033*dip;
    }
    if(u===1)finish();
   }else{
    if(transition!==null){const f=poseFade((now-transition)/420);if(f.swap&&pending){apply(pending.pose,pending.anchor,pending.scale);pending=null}material.opacity=f.opacity;if(now-transition>=420)finish()}
    sprite.scale.y=baseHeight*(1+Math.sin(now/1400)*.004);material.rotation=Math.sin(now/1900)*.003;
   }
  }
  syncContact();
  frames++;onChange();timer=setTimeout(tick,1000/(journey||pending?.turn?50:24));
 }
 function sync(){stop();lastTick=null;if(paused||motion.matches){if(!journey&&(!pending?.turn||motion.matches))finish();if(motion.matches)settleJourney(true);onChange()}else tick()}
 function select(next,anchor,scale=1,nod=false){if(disposed||paused||transition!==null||journey)return false;pending={pose:next,anchor,scale,nod,elapsed:0,turn:area!=='home'&&pose!=='sit'&&next!=='sit'};if(motion.matches){finish();onChange()}else{transition=performance.now();sync()}return true}
 function setArea(next){settleJourney(false);clearanceKey='';clearPosition=null;manualStand=false;seatApproach=null;finish();area=next;parents[area].add(sprite,contact,seatContact);contact.visible=next!=='home'||homeContact;setRelief(next==='home'?.075:night?.055:.12);apply('front',anchors[area]);sync()}
 function travelTo(kind,anchor,options,resolve,entrance,focus) {
  const manual=kind==='ground'||kind==='depart';
  const interaction=kind==='bench'||kind==='gather';
  const plazaBench=kind==='bench'&&area==='plaza';
  const previous=journey?.kind;
  const redirect=(manual||interaction||kind==='watch')&&(previous==='ground'||previous==='depart'||
   (kind!=='depart'&&previous==='arrive')||
   (kind!=='watch'&&previous==='watch')||
   (kind==='depart'&&previous==='gather'))?journey:null;
  if(disposed||paused||(journey&&!redirect))return false;
  if(transition!==null){
   if(kind!=='depart')return false;
   finish();
  }
  const targetPose=kind==='bench'?'sit':(manual||kind==='rise'||kind==='arrive')?'front':'back';
  const groundY=area==='home'?.055:.066;
  const approach=kind==='bench'?[anchor[0],groundY,anchor[2]+.35]:anchor;
  // Dock just ahead of the front board with the hips at seat height.
  const landing=kind==='bench'?[anchor[0]+.04,anchor[1],anchor[2]+(area==='home'?.12:.11)]:anchor;
  const origin=entrance??sprite.position.toArray();
  const wasSeated=redirect?redirect.phase==='rise':pose==='sit';
  const foot=seatApproach??[origin[0],groundY,origin[2]+.28];
  const start=wasSeated?foot:[origin[0],groundY,origin[2]];
  const continuing=redirect?.phase==='walk'&&redirect.speed>.0001;
  const incoming=continuing?{x:redirect.direction.x,z:redirect.direction.z,speed:redirect.speed}:undefined;
  let route=null;
  if(manual&&options){
   route=planDistrictWalk(area,start,approach,options.benches,options.furniture,incoming);
   if(!route)return false;
  }
  if(motion.matches||gait.length!==4||!options){
   if(redirect)settleJourney(false);
   apply(targetPose,landing,options?.scale??1);manualStand=!!options;seatApproach=options&&kind==='bench'?approach:null;
   onChange();resolve?.(true);return true;
  }
  route??=planDistrictWalk(area,start,approach,options.benches,options.furniture,incoming);
  if(!route)return false;
  const track=buildDistrictTrack(route);
  const rise=wasSeated?395:0;
  const travel=track.length>.035?Math.max(420,track.length*700):0;
  const takeoff=continuing?redirect.takeoff:Math.min(150,travel*.27);
  const plant=plazaBench?112:travel?(interaction?135:105):1;
  const pivot=interaction?(plazaBench?260:kind==='bench'?215:240):0;
  const finishTime=plazaBench?465:kind==='bench'?390:kind==='gather'?535:kind==='watch'?440:kind==='depart'?125:65;
  const settle=plazaBench?460:0;
  const reachSide=focus?Math.sign(.8*(focus.x-anchor[0])-.6*(focus.z-anchor[2])):0;
  const startPose=continuing?redirect.startPose:poseFrames[rise?'front':pose];
  const heading=sampleDistrictTrack(track,0,walkPoint,walkDirection);
  const alignment=incoming?incoming.x*walkDirection.x+incoming.z*walkDirection.z:0;
  const incomingSpeed=incoming?incoming.speed*Math.max(.15,alignment):0;
  const timing=travel?createWalkTiming(track.length,travel,incomingSpeed):null;
  const startStride=continuing?redirect.stride:0;
  const firstStepOffset=timing&&!continuing?sampleWalkTiming(timing,takeoff).distance:0;
  const finalStep=Math.round(startStride+Math.max(0,track.length-firstStepOffset)/.38)*2;
  const launchOffset=continuing?redirect.launchElapsed:0;
  const keptRise=rise&&redirect?redirect.elapsed:0;
  const riseOrigin=keptRise?redirect.origin:origin;
  journey={kind,pose:targetPose,phase:rise?'rise':'walk',origin:riseOrigin,anchor:landing,approach,track,rise,travel,plant,pivot,finishTime,settle,reachSide,
   plazaBench,finalStep,pathLean:continuing?redirect.pathLean:0,
   startPose,left:continuing?redirect.left:heading<0,turnElapsed:continuing?redirect.turnElapsed:150,takeoff,
   continuing,direction:walkDirection.clone(),speed:incomingSpeed,timing,startStride,stride:startStride,
   firstStepOffset,launchOffset,launchElapsed:launchOffset,
   initialLift:continuing?footLift:0,initialLean:continuing?material.rotation:0,
   release:Math.min(plazaBench?200:120,travel*.26),plantWeight:travel?.54:0,
   elapsed:keptRise,duration:rise+travel+plant+pivot+finishTime+settle,resolve};
  redirect?.resolve?.(false);
  if(!continuing)sync();
  return true;
 }
 function changeMotion(){sync()}motion.addEventListener('change',changeMotion);
 setArea('home');
 function avoidFurniture(boxes,w,h){if(pose==='sit'||transition!==null||journey||manualStand)return;const key=area+JSON.stringify([camera.projectionMatrix.elements,camera.matrixWorld.elements,boxes.map(b=>[b.min.toArray(),b.max.toArray()])]);if(key!==clearanceKey){clearanceKey=key;const initial=anchors[area],choices=[initial,...(area==='home'?[[.45,.055,1.1],[-.8,.055,1.35],[.15,.055,1.55],[-1,.055,1.15]]:area==='plaza'?[[.5,.065,1.15],[-.65,.065,.8],[.65,.065,.65]]:[[0,.065,1.3],[.28,.065,.95],[-.2,.065,1.4]])];const itemRects=boxes.map(b=>{const points=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=new THREE.Vector3(x,y,z).project(camera);points.push([(p.x+1)*w/2,(1-p.y)*h/2])}return {left:Math.min(...points.map(p=>p[0]))-4,right:Math.max(...points.map(p=>p[0]))+4,top:Math.min(...points.map(p=>p[1]))-4,bottom:Math.max(...points.map(p=>p[1]))+4}});const size=poses.front.height/(camera.top-camera.bottom)*h;const rects=choices.map(c=>{const p=new THREE.Vector3(...c).project(camera),x=(p.x+1)*w/2,y=(1-p.y)*h/2;return {left:x+(219-452)/1024*size,right:x+(891-452)/1024*size,top:y-(997-27)/1024*size,bottom:y}});clearPosition=choices[leastCoveredStand(rects,itemRects)];}if(clearPosition){sprite.position.fromArray(clearPosition);syncContact();}}
 return {avoidFurniture,sprite,setArea,setNight(value){night=value;setRelief(area==='home'?.075:night?.055:.12);syncContact();onChange()},setPaused(value,hide=false){sprite.visible=!hide;contact.visible=!hide&&(area!=='home'||homeContact);syncContact();if(paused===value)return;paused=value;sync()},
  turn(options){
   if(pose==='sit'&&seatApproach)return travelTo('rise',seatApproach,options);
   return select(pose==='sit'?'front':pose==='front'?'back':'front',manualStand?sprite.position.toArray():clearPosition||anchors[area]);
  },
  sit(anchor,scale=1,options,callback){return options?travelTo('bench',anchor,options,callback):select('sit',anchor,scale)},
  watch(anchor,options,callback){return travelTo('watch',anchor,options,callback)},
  walkTo(anchor,options,callback){return travelTo('ground',anchor,options,callback)},
  depart(anchor,options,callback){return travelTo('depart',anchor,options,callback)},
  stopManualWalk(){
   if(journey?.kind!=='ground'&&journey?.kind!=='depart')return;
   const {x,z}=sprite.position;
   if(journey.phase==='rise'){
    const foot=journey.track.segments[0].from;
    apply('front',foot);
   }else apply('front',[x,area==='home'?.055:.066,z]);
   seatApproach=null;
   settleJourney(false);
   manualStand=true;
  },
  confirmHarvest(){if(area==='orchard')select('front',sprite.position.toArray(),1,true);},
  arrive(entrance,options){
   if(!options||motion.matches||gait.length!==4)return false;
   return travelTo('arrive',sprite.position.toArray(),options,null,entrance);
  },
  afterArrival(callback){
   if(journey?.kind!=='arrive')return false;
   journey.after=callback;
   return true;
  },
  gather(anchor,options,focus){return new Promise(resolve=>{if(!travelTo('gather',anchor,options,resolve,undefined,focus))resolve(null)})},
  opaque(uv){if(!uv)return false;const p=pixels[pose],x=Math.min(p.width-1,Math.max(0,Math.floor(uv.x*p.width))),y=Math.min(p.height-1,Math.max(0,Math.floor((1-uv.y)*p.height)));return p.data[(y*p.width+x)*4+3]>25},
  point(){return sprite.position.clone().addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1),pose==='sit'?.25:.6)},
  state:()=>({pose,area,height:baseHeight,transition:transition!==null||!!journey,action:journey?.kind??null,phase:journey?.phase??null,
   reach:journey?.reach??0,position:sprite.position.toArray(),paused,visible:sprite.visible,frames,night,instances:1}),
  dispose(){disposed=true;settleJourney(false);stop();motion.removeEventListener('change',changeMotion);sprite.removeFromParent();material.dispose();for(const shadow of [contact,seatContact]){shadow.removeFromParent();shadow.geometry.dispose();shadow.material.dispose();}contactTexture.dispose();for(const t of Object.values(textures))t.dispose();for(const step of [...gait,...leftGait])step.texture.dispose()}
 };
}
