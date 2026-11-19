import {createTownDistrictFinish,applyTownDistrictLighting} from './town-district-finish.mjs';
import {createTownDepthDetails} from './town-depth-details.mjs';
import {createTownHarvestFeedback} from './town-harvest-feedback.mjs';
import {createTownLandmarks} from './town-landmarks.mjs';
import {createTownComicStyle} from './town-comic-style.mjs';
import {createTownHoverHighlight} from './town-hover-highlight.mjs';
import {createTownRouteFade} from './town-route-fade.mjs';
import {createCozyYardFinish,applyCozyHomeLighting,applyCozyFixtureEmission} from './yard-cozy-finish.mjs';
import {createReferenceYardDetails} from './reference-yard-details.mjs';
import {projectVisibleModel,fitModelFrame} from './yard-model-frame.mjs';
import {installYardDiorama} from './yard-diorama.mjs';
import {createMicroHouseDetails} from './micro-house-details.mjs';
import {createTwoStoryExterior} from './two-story-exterior.mjs';
import {installYardLife} from './yard-life.mjs';
import {addCottageFinish} from './outdoor-scene-finish.mjs';
import {createOutdoorActor} from './outdoor-actor.mjs';
import {orchardStop} from './town-actor-motion.mjs';
import {harmonizeHomeMaterials,outdoorLighting} from './outdoor-style.mjs';
import {applyCottagePracticalLights} from './cottage-practical-light.mjs';
import {refineHomeTree} from './town-trees.mjs';
import {createTownFurniture} from './town-furniture.mjs';
import {createTownSceneTools} from './town-scene-tools.mjs';
import {createOutdoorDistricts} from './outdoor-districts.mjs';
import {cottageStyle} from './cottage-style.mjs';
import {createYardCare} from './yard-care.mjs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const inWorkstation=new URLSearchParams(location.search).get('host')==='workstation';
const desktopDiorama=!inWorkstation&&parent!==window&&new URLSearchParams(location.search).get('desktop')==='1';
let diorama=null,homeProjected=null;
const homeHint=inWorkstation?'点击房门打开专注闹钟':'点击房门回小屋';
if(inWorkstation){document.getElementById('exit-town').hidden=false;document.getElementById('exit-town').textContent='返回工作站';document.getElementById('home').textContent='专注闹钟';document.querySelector('canvas').setAttribute('aria-label','小镇院落，点击房门打开专注闹钟');}
document.querySelector('canvas').setAttribute('aria-description','点击空地走过去，点击伙伴转身或起身，点击长椅坐下。聚焦场景后空格转身，B键坐下。');
const canvas=document.querySelector('canvas'),message=document.getElementById('message'),nightButton=document.getElementById('night');
const orchardGate=document.getElementById('orchard-gate');
const header=document.querySelector('body > header');
const districtsNav=document.getElementById('district-nav');
let dockObserver=null;

const harvestButton=document.getElementById('harvest');
const fallback=document.getElementById('fallback');
if(inWorkstation){
 fallback.textContent='返回工作站';
 document.querySelector('#error p').textContent='小镇暂时无法加载，请返回工作站后重试。';
}
const placementPin=document.createElement('div');placementPin.id='placement-pin';placementPin.hidden=true;placementPin.setAttribute('aria-hidden','true');document.body.append(placementPin);
let locatedItem=null,locateTimer=null;
let furniture=null,tools=null,actor=null;
const benches=new Map();
let yardLife=null;
let harvestInFlight=false;
let orchardRefreshTimer=null;
let harvestTree=null;
let area='home',districts=null,orchardLocked=true,orchardState=null,homeMaterials=0,homeFinish=null,twoStoryExterior=null,cozyFinish=null,referenceYard=null;
let renderFrames=0;
let renderer,model,door,closed=false,hostHidden=false,night=false,leaving=false,leaveTimer=null,raf=null,resizeTimer=null;
const care=createYardCare({onFeedback:text=>setTownFeedback(text),onState:s=>{tools?.setState(s);if(districts){applyOrchardState(s);updateControls()}},onBusy:busy=>{tools?.setBusy();updateControls(busy);}});
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-4,4,3,-3,.1,100),raycaster=new THREE.Raycaster();
const ambient=new THREE.HemisphereLight(cottageStyle.day.sky,cottageStyle.day.floor,1.5),sun=new THREE.DirectionalLight(cottageStyle.day.sun,2),lamp=new THREE.PointLight('#ffc76d',0,3.3,2),windowLight=new THREE.PointLight('#ffbf70',0,2.5,2);sun.position.set(-3,7,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.1,far:20});sun.shadow.normalBias=.025;lamp.castShadow=true;lamp.shadow.mapSize.set(512,512);lamp.shadow.camera.near=.05;lamp.shadow.camera.far=4;lamp.shadow.normalBias=.02;scene.add(ambient,sun,lamp,windowLight);
function post(t){if(parent!==window)parent.postMessage({t},location.origin);else message.textContent='请从桌宠房间进入院落。';}
let districtFinish=null,depthDetails=null,harvestFeedback=null,landmarks=null,comicStyle=null;
let pendingRoute=null;
const hotspots=createTownHoverHighlight(render);
const floorNormal=new THREE.Vector3();
const moveMarker=new THREE.Mesh(new THREE.RingGeometry(.077,.115,32),new THREE.MeshBasicMaterial({color:'#947ed4',transparent:true,opacity:.86,depthWrite:false,toneMapped:false}));
let markerTimer=0;
moveMarker.name='town-move-marker';moveMarker.rotation.x=-Math.PI/2;moveMarker.visible=false;moveMarker.raycast=()=>{};
const reduceWaterMotion=matchMedia('(prefers-reduced-motion: reduce)');
const routeFade=createTownRouteFade(canvas,{
 isHidden:()=>hostHidden||document.hidden,
 reduceMotion:()=>reduceWaterMotion.matches
});
function actorMaskCell(companion){
 if(!companion?.visible)return null;
 // Refresh the native cutout at walking-space intervals. Standing and
 // reduced-motion destinations use a finer cell without continuous readbacks.
 const quantum=companion.transition?.24:.035;
 return companion.position.map(x=>Math.round(x/quantum));
}
function render(){if(closed||hostHidden||document.hidden)return;const d=furniture?.getDraft(),point=d?furniture?.previewPoint():locatedItem?furniture?.itemPoint(area,locatedItem.id):null;placementPin.hidden=(!d&&!locatedItem)||!point;if(d&&point){const r=canvas.getBoundingClientRect();placementPin.textContent=d.name+' · '+(d.valid?'待确认':'此处不可放');placementPin.dataset.valid=String(d.valid);placementPin.style.left=(r.left+point.x)+'px';placementPin.style.top=(r.top+point.y-12)+'px';}if(!d&&locatedItem&&point){const r=canvas.getBoundingClientRect();placementPin.textContent=locatedItem.name+' · 已摆放';placementPin.dataset.valid='true';placementPin.style.left=(r.left+point.x)+'px';placementPin.style.top=(r.top+point.y-12)+'px';}actor?.avoidFurniture(furniture?.obstacles(area)||[],innerWidth,innerHeight);const companion=actor?.state();if(harvestTree)harvestTree.node.rotation.z=harvestTree.angle+.021*(companion?.reach??0);if(renderer){depthDetails?.step(performance.now(),area==='plaza'&&!tools?.isOpen()&&!reduceWaterMotion.matches);harvestFeedback?.step(performance.now(),area==='orchard'&&!tools?.isOpen()&&!reduceWaterMotion.matches);renderer.render(scene,camera);renderFrames++;diorama?.rendered({area,night,pose:companion?.pose,transition:companion?.transition,hidden:hostHidden,modelRevision:JSON.stringify([furniture?.count()??0,d??null,area==='orchard'&&!!orchardState?.town.daily[orchardState.today]?.harvested,area==='orchard'&&orchardLocked]),actorRevision:actorMaskCell(companion)});}}
async function locateItem(id,target,name){if(care.isBusy()||tools?.isEditing())return;tools?.close();await goArea(target);if(closed||area!==target)return;clearTimeout(locateTimer);locatedItem={id,name};render();locateTimer=setTimeout(()=>{locatedItem=null;render()},6000);}

function setNight(value){night=!!value;if(area==='home')sun.position.set(-3,7,5);window.microHouseDetails?.setNight(night);twoStoryExterior?.setNight(night);referenceYard?.setNight(night);cozyFinish?.setNight(night);districtFinish?.setNight(night);depthDetails?.setNight(night);landmarks?.setNight(night);comicStyle?.setNight(night);hotspots.setNight(night);document.body.dataset.night=String(night);nightButton.setAttribute('aria-pressed',String(night));nightButton.textContent=night?'日间':'夜间';scene.background=desktopDiorama?null:new THREE.Color(night?cottageStyle.night.background:cottageStyle.paper);ambient.color.set(night?cottageStyle.night.sky:cottageStyle.day.sky);ambient.groundColor.set(night?cottageStyle.night.floor:cottageStyle.day.floor);sun.color.set(night?cottageStyle.night.sun:cottageStyle.day.sun);ambient.intensity=night?outdoorLighting.night.ambient:outdoorLighting.day.ambient;sun.intensity=night?outdoorLighting.night.sun:outdoorLighting.day.sun;if(renderer)renderer.toneMappingExposure=night?outdoorLighting.night.exposure:outdoorLighting.day.exposure;applyCozyHomeLighting({ambient,sun,renderer,night,isHome:area==='home'});applyTownDistrictLighting({ambient,sun,renderer,area,night});sun.shadow.radius=3.2;sun.shadow.normalBias=.02;applyCottagePracticalLights(lamp,windowLight,night,area==='home');districts?.setNight(night);actor?.setNight(night);model?.traverse(o=>{for(const m of o.material?[o.material].flat():[]){applyCozyFixtureEmission(m,night);}});try{localStorage.setItem('dragon-yard-night',String(night))}catch{}render();}
function resize(){
 if(!renderer||!model||closed)return;
 const w=innerWidth,h=innerHeight;
 renderer.setSize(w,h);
 camera.position.set(6,4.8,8);
 camera.lookAt(0,1,0);
 camera.updateMatrixWorld(true);
 homeProjected=projectVisibleModel(activeModel(),camera);
 const top=Math.max(w<=620?150:105,Math.ceil(districtsNav.getBoundingClientRect().bottom)+12);
 fitModelFrame(camera,homeProjected,w,h,desktopDiorama?{top:24,bottom:24,padding:22}:{top,bottom:110,padding:18});
 render();
}
function leave(){if(leaving||closed)return;if(care.isBusy())return;if(tools?.isEditing()){tools.cancel();return;}if(area!=='home'||!door||hostHidden||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches){post('room-town-close');return;}leaving=true;updateControls(true);message.textContent=inWorkstation?'打开专注闹钟…':'回小屋…';const start=performance.now();function step(now){if(closed)return;door.rotation.y=Math.PI/2*Math.min(1,(now-start)/280);render();if(now-start<280&&!hostHidden&&!document.hidden)raf=requestAnimationFrame(step);else{raf=null;leaveTimer=setTimeout(()=>post('room-town-close'),40);}}raf=requestAnimationFrame(step);}
function hitActivity(e, detail){if(!model||!door)return null;const r=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-2*(e.clientY-r.top)/r.height),camera);
for(const hit of raycaster.intersectObject(activeModel(),true)){let visible=true;for(let o=hit.object;o;o=o.parent)if(!o.visible){visible=false;break;}if(!visible)continue;if(hit.object===actor?.sprite&&(!actor.sprite.visible||!actor.opaque(hit.uv)))continue;for(let o=hit.object;o;o=o.parent){if(o.userData.townItemId)return 'item:'+o.userData.townItemId;if(o.userData.townAction){
 const action=o.userData.townAction;
 if(detail){
  detail.hotspot=o;
  if(action==='harvest'){
   if(o.isMesh)detail.hotspot=districts.orchard.children.find(node=>
     node.name==='town-tree'&&node.userData.orchardTree===o.userData.orchardTree);
  }
 }
 return action;
}if(o===door)return 'door';if(o.name==='Planters')return 'plants';}
 const {x,y,z}=hit.point;
 if(hit.face&&y>=.004&&y<=.090&&Math.abs(x)<1.9&&Math.abs(z)<1.9&&
   floorNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).y>.72){
  if(detail)detail.ground=[x,y,z];
  return 'ground';
 }
 return null;
}return null;}
function actorAvailability(){if(!canHighlight())hotspots.clear();actor?.setPaused(closed||hostHidden||document.hidden||leaving||care.isBusy()||!!tools?.isOpen()||!!tools?.isEditing()||(area==='orchard'&&orchardLocked),!!tools?.isEditing()||(area==='orchard'&&orchardLocked));}
function firstBench(){return area==='home'?'home':activeModel()?.children.find(o=>o.userData.benchAnchor)?.name}
function movementOptions(){
 if(area==='home')return undefined;
 return {
  benches:activeModel().children.map(node=>node.userData.benchAnchor).filter(Boolean),
  furniture:furniture?.obstacles(area)||[]
 };
}
const floorPropBounds={
 plaza:[[.59,-1.44,.20,.16],[0,-1.45,.41,.19],[-.76,-1.65,.25,.18],[.76,-1.65,.25,.18]],
 orchard:[[1.47,-.37,.31,.22],[1.45,.15,.22,.16]]
};
function groundOptions(){
 const options=movementOptions()??{benches:[benches.get('home')].filter(Boolean),furniture:furniture?.obstacles(area)||[]};
 const props=(floorPropBounds[area]??[]).map(([x,z,halfWidth,halfLength])=>({
  min:{x:x-halfWidth,z:z-halfLength},max:{x:x+halfWidth,z:z+halfLength}
 }));
 return {...options,furniture:[...options.furniture,...props]};
}
function walkOnGround(point){
 if(!point||hostHidden||document.hidden||closed||leaving||care.isBusy()||
   tools?.isOpen()||tools?.isEditing()||harvestInFlight||(area==='orchard'&&orchardLocked))return;
 const [x,,z]=point;
 const target=[THREE.MathUtils.clamp(x,-1.72,1.72),area==='home'?.055:.066,THREE.MathUtils.clamp(z,-1.72,1.72)];
 const notice = startTownAction(
  done => actor?.walkTo(target, groundOptions(), done), '正往标记处走…', '到这儿了。'
 );
 if (!notice || area !== notice.area) return;
 moveMarker.position.set(target[0], .074, target[2]);
 activeModel().add(moveMarker);
 moveMarker.visible = true;
 clearTimeout(markerTimer);
 markerTimer = 0;
 if (!actor.state().transition) {
  markerTimer = setTimeout(() => {clearMoveMarker(); render();}, 260);
 }
 render();
}
function turnActor(){
 if(actor?.afterArrival(turnActor))return true;
 actor?.stopManualWalk();
 return actor?.turn(groundOptions());
}
let lastNotice, noticeTimer = 0;
function setTownFeedback(text, kind = '') {
 lastNotice = null;
 message.textContent = text;
 message.dataset.kind = kind;
 clearTimeout(noticeTimer);
 if (kind) {
  noticeTimer = setTimeout(() => {message.dataset.kind = '';}, kind === 'pending' ? 9000 : 2700);
 }
 updateMessageVisibility();
}
function startTownAction(start, pending, arrived) {
 const notice = {area};
 const accepted = start(completed => queueMicrotask(() => {
  if (closed || leaving || lastNotice !== notice || area !== notice.area) return;
  if (completed && arrived) setTownFeedback(arrived, 'complete');
  else if (!completed) setTownFeedback(areaHint());
  if (moveMarker.visible && actor?.state().action !== 'ground' && !markerTimer) {
   moveMarker.visible = false;
   render();
  }
 }));
 if (!accepted) return null;
 setTownFeedback(pending, 'pending');
 lastNotice = notice;
 return notice;
}
function clearMoveMarker() {
 clearTimeout(markerTimer);
 markerTimer = 0;
 moveMarker.visible = false;
}
function watchFountain(){
 if(area!=='plaza'||!canHighlight())return;
 if (startTownAction(done => actor?.watch([-.13,.066,.86], groundOptions(), done),
     '正往喷泉边走…', '到喷泉边了。')) clearMoveMarker();
}
function sitOnBench(name){
 if(!canHighlight())return;
 const anchor=benches.get(name);
 if (anchor && startTownAction(done => actor?.sit(anchor, 1, groundOptions(), done),
     '正往长椅走…', '已经坐好。点击龙娘可以起身。')) clearMoveMarker();
}

const routeAreas=['home','plaza','orchard'];
const areaNames={home:'家园',plaza:'广场',orchard:'果园'};
const hoverTitles={
 actor:'伙伴 · 转身 / 起身',ground:'空地 · 点击走过去',plants:'花草 · 点击浇水',
 home:'路牌 · 返回家园',plaza:'路牌 · 前往广场',orchard:'路牌 · 前往果园',
 harvest:'果树 · 点击采果',fountain:'喷泉 · 走近看看',manage:'事务牌 · 日常与奖励',
 door:inWorkstation?'房门 · 专注闹钟':'房门 · 点击回小屋'
};
function canHighlight(){
 return !closed&&!hostHidden&&!document.hidden&&!leaving&&!routeFade.active()&&!care.isBusy()&&!tools?.isOpen()&&!tools?.isEditing();
}
function headToRoute(destination,sign){
 if(!canHighlight())return;
 const approach=sign?.userData.departure;
 if(!actor||!approach||(area==='orchard'&&orchardLocked)){
  void goArea(destination,undefined,true,Boolean(approach));
  return;
 }
 if(pendingRoute?.sign===sign)return;
 if(actor.afterArrival(()=>headToRoute(destination,sign))){
  setTownFeedback('走完这段就去路牌。', 'pending');
  return;
 }
 const intent={from:area,sign};
 const previous=pendingRoute;
 pendingRoute=intent;
 const [x,y,z]=approach;
 const candidates=[approach,[x-.16,y,z],[x+.16,y,z],[x,y,z-.15]];
 const options=groundOptions();
 const accepted=candidates.some(target=>actor.depart(target,options,completed=>queueMicrotask(()=>{
  if(pendingRoute!==intent)return;
  pendingRoute=null;
  if(completed&&area===intent.from&&!closed&&!leaving&&!hostHidden&&!document.hidden){
   setTownFeedback('正在前往' + areaNames[destination] + '…', 'pending');
   void goArea(destination,undefined,true,true);
  }
 })));
 if(!accepted){
  pendingRoute=previous;
  if(!previous)setTownFeedback('路牌前暂时走不过去。', 'blocked');
  return;
 }
 clearMoveMarker();
 setTownFeedback('正往' + areaNames[destination] + '的路牌走…', 'pending');
}
let down=null;
canvas.addEventListener('pointerdown',e=>{if(e.button===0)down={x:e.clientX,y:e.clientY};});
canvas.addEventListener('pointerup',e=>{
 const valid=down&&e.button===0&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<6;
 down=null;
 if(!valid||orchardGate.open||leaving||(routeFade.active()&&!routeFade.entering()))return;
 if(tools?.isEditing()){tools.pick(e);return;}
 const detail={};
 const kind=hitActivity(e,detail);
 if(kind==='ground'){walkOnGround(detail.ground);return;}
 if(routeFade.active())return;
 if(kind==='actor'&&!care.isBusy()&&!tools?.isOpen()&&turnActor()){
  clearMoveMarker();
  setTownFeedback(actor.state().action==='rise' ? '从长椅站起来…' : '陪你在外面待一会儿。', 'complete');
 }
 if(kind==='fountain')watchFountain();
 if(kind?.startsWith('bench:'))sitOnBench(kind.slice(6));
 if(kind==='door')leave();
 if(kind==='plants')care.water();
 if(routeAreas.includes(kind))headToRoute(kind,detail.hotspot);
 if(kind==='harvest')harvestFruit(detail.hotspot?.userData.orchardTree);
 if(kind==='manage'&&!care.isBusy())tools?.open('daily');
 if(kind?.startsWith('item:'))tools?.open('items',kind.slice(5));
});
canvas.addEventListener('pointercancel',()=>{down=null;hotspots.clear();});
canvas.addEventListener('pointerleave',()=>{hotspots.clear();});
canvas.addEventListener('pointermove',e=>{
 const detail={};
 const kind=hitActivity(e,detail);
 canvas.style.cursor=kind?'pointer':'default';
 canvas.title=(kind==='harvest'&&harvestedToday())?'果树 · 今日已采果':kind?.startsWith('bench:')?'长椅 · 坐下休息':(hoverTitles[kind]??'');
 const enabled=canHighlight()&&!e.buttons&&e.pointerType!=='touch'&&
  (routeAreas.includes(kind)||kind?.startsWith('bench:')||(kind==='harvest'&&!orchardLocked&&!harvestInFlight&&!harvestedToday()));
 if(enabled&&detail.hotspot)hotspots.set(kind,detail.hotspot);
 else hotspots.clear();
});
function suspend(){clearTimeout(orchardRefreshTimer);routeFade.pause();hotspots.clear();depthDetails?.step(performance.now(),false);harvestFeedback?.step(performance.now(),false);actor?.setPaused(true);cancelAnimationFrame(raf);raf=null;if(leaving){clearTimeout(leaveTimer);leaveTimer=null;leaving=false;if(door)door.rotation.y=0;updateControls(care.isBusy());message.textContent=areaHint();}}
function syncSceneVisibility(){
 const hidden=document.hidden||hostHidden;
 diorama?.setHidden?.(hidden);
 if(hidden){suspend();return;}
 routeFade.resume();
 actorAvailability();
 render();
 refreshOrchard();
 scheduleOrchardRefresh();
}
function receive(e){
 if(e.source!==parent||e.origin!==location.origin||e.data?.t!=='room-town-visibility')return;
 hostHidden=!!e.data.hidden;
 syncSceneVisibility();
}
function visible(){syncSceneVisibility();}
function dispose(){if(closed)return;routeFade.finish();pendingRoute=null;hotspots.dispose();clearTimeout(noticeTimer);clearMoveMarker();moveMarker.removeFromParent();moveMarker.geometry.dispose();moveMarker.material.dispose();comicStyle?.dispose();landmarks?.dispose();harvestFeedback?.dispose();depthDetails?.dispose();districtFinish?.dispose();districts?.disposeDetails?.();cozyFinish?.dispose();referenceYard?.dispose();diorama?.dispose();twoStoryExterior?.dispose();window.microHouseDetails?.dispose();closed=true;yardLife?.dispose();clearTimeout(locateTimer);clearTimeout(orchardRefreshTimer);placementPin.remove();actor?.dispose();care.dispose();tools?.dispose();furniture?.dispose();clearTimeout(leaveTimer);clearTimeout(resizeTimer);cancelAnimationFrame(raf);dockObserver?.disconnect();window.removeEventListener('resize',onResize);window.removeEventListener('focus',refreshOrchard);window.removeEventListener('message',receive);document.removeEventListener('visibilitychange',visible);const geometries=new Set(),materials=new Set(),textures=new Set();for(const root of [model,districts?.plaza,districts?.orchard])root?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?[o.material].flat():[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v)}});for(const t of textures)t.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();renderer?.dispose();renderer?.forceContextLoss();}
function exitTown(){if(care.isBusy())return;if(tools?.isEditing())tools.cancel();post('room-town-exit')}
function activeModel(){return area==='home'?model:districts?.[area]}
function updateMessageVisibility(){message.hidden=(!!tools?.isOpen()||!!tools?.isEditing())&&message.textContent===areaHint()}
function harvestedToday(){return Boolean(orchardState?.town.daily[orchardState.today]?.harvested)}
function syncOrchardGate(){
 const locked=area==='orchard'&&orchardLocked;
 if(locked&&!orchardGate.open&&!routeFade.active()){
  orchardGate.hidden=false;
  orchardGate.showModal();
 }else if(!locked&&orchardGate.open){
  orchardGate.close();
  orchardGate.hidden=true;
  const target=document.querySelector('[data-area="'+area+'"]');
  (target?.getClientRects().length&&!target.disabled?target:canvas).focus({preventScroll:true});
 }
}
function areaHint(){return area==='home'?homeHint:area==='plaza'?'沿路牌回家园，或去果园走走。':orchardLocked?'果园尚未开放。':harvestedToday()?'今天的果子已收好。':'点击果树或采果按钮，收好今天的果子。'}
function updateControls(busy=care.isBusy()){
 actorAvailability();
 busy=busy||routeFade.active();
 for(const id of ['harvest','home','exit-town','unlock-orchard','gate-back'])document.getElementById(id).disabled=busy||leaving||!model;
 for(const b of document.querySelectorAll('[data-area]')){b.disabled=busy||leaving||!model||!!tools?.isEditing();b.setAttribute('aria-pressed',String(b.dataset.area===area))}
 for(const b of document.querySelectorAll('#town-tool-tray [data-tool]'))b.disabled=busy||leaving||!model||!!tools?.isEditing();
 harvestButton.hidden=area!=='orchard'||orchardLocked;
 harvestButton.disabled=busy||leaving||harvestInFlight||harvestedToday();
 harvestButton.textContent=harvestedToday()?'今日已采果':harvestInFlight?'正在采果…':'采果';
 document.querySelector('header strong').textContent='小镇手记';
 if(orchardLocked&&orchardState){const cost=orchardState.catalog?.areas?.find(x=>x.id==='orchard')?.unlock_cost??12;document.getElementById('unlock-orchard').disabled=busy||leaving||orchardState.town.berries<cost;}
 syncOrchardGate();
}
function applyOrchardState(s){
 const previousDay=orchardState?.today;
 orchardState=s;
 orchardLocked=!s.town.areas?.includes('orchard');
 districts.setFruitAvailable(!orchardLocked&&!harvestedToday());
 const cost=s.catalog?.areas?.find(x=>x.id==='orchard')?.unlock_cost??12;
 document.getElementById('gate-note').textContent=`花 ${cost} 树果开放果园，之后每天可采一次果。现有 ${s.town.berries} 树果。`;
 document.getElementById('unlock-orchard').textContent=`解锁果园 · ${cost} 树果`;
 if(area==='orchard'&&previousDay&&s.today!==previousDay){
  setTownFeedback(areaHint());
 }
 scheduleOrchardRefresh();
}
async function goArea(next,allow=()=>true,showArrival=false,fadeAtSign=false){
 if(next===area||!allow()||!routeAreas.includes(next)||!model||closed||leaving||
    routeFade.active()||care.isBusy()||tools?.isEditing())return;
 const from=area;
 pendingRoute=null;
 clearMoveMarker();
 hotspots.clear();
 const fading=fadeAtSign&&from!==next&&routeFade.begin(from,next);
 if(fading)updateControls();
 try{
  if(next==='orchard'){
   setTownFeedback('正在查看果园…', 'pending');
   const snapshot=await care.inspect();
   if(closed||leaving||!snapshot||snapshot.error||!allow())return;
   applyOrchardState(snapshot);
  }
  if(fading&&!(await routeFade.fade('out',0,140)))return;
  if(closed||leaving||!allow())return;
  harvestFeedback?.reset();
  area=next;
  locatedItem=null;
  clearTimeout(locateTimer);
  actor?.setArea(next);
  model.visible=area==='home';
  districts.plaza.visible=area==='plaza';
  districts.orchard.visible=area==='orchard';
  lamp.position.copy(model.getObjectByName('Prop_DoorLantern').getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0,0,.2));
  updateControls();
  resize();
  setNight(night);
  setTownFeedback(showArrival ? '已到' + areaNames[next] + '。' + areaHint() : areaHint(), showArrival ? 'complete' : '');
  if(showArrival&&from!==next)walkIn(from);
  scheduleOrchardRefresh();
  if(fading)await routeFade.fade('in',1,175);
 }finally{
  if(fading){
   routeFade.finish();
   if(!closed)updateControls();
  }
 }
}
function walkIn(from){
 if(!actor||(area==='orchard'&&orchardLocked))return;
 const entrance={
  home:[1.12,.055,1.50],
  plaza:from==='orchard'?[1.14,.066,1.20]:[-1.10,.066,1.20],
  orchard:[-.67,.066,1.28]
 }[area];
 if(entrance)actor.arrive(entrance,groundOptions());
}
async function unlockOrchard(){if(area!=='orchard'||leaving||closed)return;const result=await care.unlockOrchard();if(!closed&&result?.state){applyOrchardState(result.state);updateControls();render();}}
async function harvestFruit(tree=1){
 if(area!=='orchard'||leaving||closed||orchardLocked||harvestInFlight||harvestedToday()||care.isBusy())return;
 harvestInFlight=true;
 updateControls();
 try{
  const options=groundOptions();
  if(actor){
   clearMoveMarker();
   setTownFeedback('正往果树旁走…', 'pending');
   harvestTree=bindHarvestTree(tree);
   const focus=harvestTree?.node.position;
   const target=orchardStop(tree);
   const [x,y,z]=target;
   const side=focus&&x<focus.x?-1:1;
   const stops=[target,[x+side*.16,y,z],[x,y,z+.16]];
   let completed=false;
   for(const stop of stops){
    if(area!=='orchard'||leaving||closed)return;
    completed=await actor.gather(stop,options,focus);
    if(completed===false)return;
    if(completed)break;
   }
   if(area!=='orchard'||leaving||closed)return;
   if(!completed){
    setTownFeedback('果树旁暂时走不过去。', 'blocked');
    return;
   }
  }
  setTownFeedback('正在收好果子…', 'pending');
  const result=await care.harvest();
  if(!closed&&result?.state){
   applyOrchardState(result.state);
   if(!result.already)setTownFeedback(message.textContent, 'complete');
   const position=actor?.state().position;
   if(area==='orchard'&&!result.already&&position&&!reduceWaterMotion.matches){
    harvestFeedback?.play(position);
    actor.confirmHarvest();
   }
   updateControls();
   render();
  }
 }finally{
  if(harvestTree)harvestTree.node.rotation.z=harvestTree.angle;
  harvestTree=null;
  harvestInFlight=false;
  if(!closed){updateControls();render();}
 }
}
function bindHarvestTree(tree){
 const node=districts.orchard.children.find(node=>node.name==='town-tree'&&node.userData.orchardTree===tree);
 return node?{node,angle:node.rotation.z}:null;
}
function orchardIsVisible(){
 return area==='orchard'&&!closed&&!hostHidden&&!document.hidden;
}
function refreshOrchard(){
 if(orchardIsVisible()&&!harvestInFlight&&!tools?.isEditing()&&!routeFade.active())return care.inspect();
 return null;
}
function scheduleOrchardRefresh(){
 clearTimeout(orchardRefreshTimer);
 if(!orchardIsVisible())return;
 // The town rules use UTC+9 for daily rewards, regardless of Windows locale.
 const now=Date.now(),townTime=new Date(now+9*60*60*1000);
 const dayChanged=townTime.toISOString().slice(0,10)!==orchardState?.today;
 const nextMidnight=townTime.setUTCHours(24,0,0,0)-9*60*60*1000;
 orchardRefreshTimer=setTimeout(async()=>{
  await refreshOrchard();
  scheduleOrchardRefresh();
 },dayChanged?15000:Math.max(250,nextMidnight-now+250));
}
window.addEventListener('focus',refreshOrchard);
if(!desktopDiorama){
 function alignControls(){
  const navTop=Math.ceil(header.getBoundingClientRect().bottom)+8;
  document.body.style.setProperty('--yard-nav-top',navTop+'px');
  const sheetTop=navTop+Math.ceil(districtsNav.getBoundingClientRect().height)+10;
  document.body.style.setProperty('--yard-panel-top',sheetTop+'px');
  onResize();
 }
 dockObserver=new ResizeObserver(alignControls);
 dockObserver.observe(header);
 dockObserver.observe(districtsNav);
 alignControls();
}
function onResize(){clearTimeout(resizeTimer);resizeTimer=setTimeout(resize,30)}
window.addEventListener('resize',onResize);window.addEventListener('message',receive);document.addEventListener('visibilitychange',visible);window.addEventListener('pagehide',dispose,{once:true});
for(const b of document.querySelectorAll('[data-area]'))b.onclick=()=>goArea(b.dataset.area,undefined,true);document.getElementById('unlock-orchard').onclick=unlockOrchard;document.getElementById('gate-back').onclick=()=>goArea('plaza');
orchardGate.addEventListener('cancel',event=>{event.preventDefault();void goArea('plaza')});document.getElementById('harvest').onclick=()=>harvestFruit();
document.getElementById('home').onclick=leave;fallback.onclick=()=>post(inWorkstation?'room-town-exit':'room-town-close');nightButton.onclick=()=>setNight(!night);for(const b of document.querySelectorAll('#town-tool-tray [data-tool]'))b.onclick=()=>{if(!leaving)tools?.open(b.dataset.tool)};document.getElementById('exit-town').onclick=exitTown;window.addEventListener('keydown',e=>{if(tools?.key(e))return;if(e.target===canvas&&!tools?.isOpen()&&!care.isBusy()&&!leaving&&!routeFade.active()){if(e.code==='Space'){e.preventDefault();turnActor();}else if(e.code==='KeyB'){e.preventDefault();sitOnBench(firstBench());}}if(e.key==='Escape'&&!orchardGate.open){e.preventDefault();if(tools?.isOpen())tools.close();else if(inWorkstation)exitTown();else leave()}});
(async()=>{try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});diorama=installYardDiorama({enabled:desktopDiorama,canvas,renderer,scene,camera,onCommand:action=>{down=null;parent.postMessage({t:'room-yard-command',action},location.origin)},isModalOpen:()=>orchardGate.open||!!tools?.isOpen()||!!tools?.isEditing()});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;const gltf=await new GLTFLoader().loadAsync(window.yardData);if(closed){gltf.scene.traverse(o=>{o.geometry?.dispose();for(const m of o.material?[o.material].flat():[])m.dispose()});return;}model=gltf.scene;homeMaterials=harmonizeHomeMaterials(model);refineHomeTree(model);homeFinish=addCottageFinish(model);window.microHouseDetails=createMicroHouseDetails(model);twoStoryExterior=createTwoStoryExterior(model);referenceYard=createReferenceYardDetails(model);model.traverse(o=>{if(o.isMesh){o.receiveShadow=true;o.castShadow=!/windowGlow|windowGlass/i.test(o.name)&&![o.material].flat().some(m=>['Mat_WindowGlow','Mat_LanternGlow','finish-water','finish-leaf','finish-gold','finish-flower'].includes(m?.name))}});cozyFinish=createCozyYardFinish(model);districts=createOutdoorDistricts();districts.plaza.getObjectByName('town-stone-fountain').userData.townAction='fountain';districts.points.fountain=new THREE.Vector3(0,.73,-.2);districtFinish=createTownDistrictFinish(districts);depthDetails=createTownDepthDetails(districts);harvestFeedback=createTownHarvestFeedback(districts.orchard);landmarks=createTownLandmarks({home:model,plaza:districts.plaza,orchard:districts.orchard});model.add(districts.homeRoutes);comicStyle=createTownComicStyle({home:model,plaza:districts.plaza,orchard:districts.orchard});districts.plaza.visible=false;districts.orchard.visible=false;scene.add(model,districts.plaza,districts.orchard);door=model.getObjectByName('Prop_FrontDoor');if(!door)throw Error('missing door');model.updateMatrixWorld(true);lamp.position.copy(model.getObjectByName('Prop_DoorLantern').getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0,0,.2));windowLight.position.set(1.95,1.1,-1);try{night=localStorage.getItem('dragon-yard-night')==='true'}catch{}furniture=createTownFurniture({parents:{home:model,plaza:districts.plaza,orchard:districts.orchard},camera,canvas,onChange:render});furniture.setLegacyVisible(false);tools=createTownSceneTools({client:care,furniture,getArea:()=>area,goArea,onChange:()=>{updateControls();updateMessageVisibility();render()},onExit:exitTown,onLocate:locateItem,onFeedback:text=>{message.textContent=text;updateMessageVisibility()}});resize();
const homeBench=model.getObjectByName('Bench');if(homeBench){homeBench.userData.townAction='bench:home';benches.set('home',[-1.15,.386,-.11]);}
for(const root of [districts.plaza,districts.orchard])root.traverse(o=>{if(o.userData.benchAnchor)benches.set(o.name,o.userData.benchAnchor)});
try{actor=await createOutdoorActor({assets:window.yardActorAssets,parents:{home:model,plaza:districts.plaza,orchard:districts.orchard},camera,homeContact:desktopDiorama,porchLight:lamp.position,onChange:render});if(closed){actor.dispose();return;}actor.setArea(area);resize();}catch(e){window.yardActorError=e.message;}
setNight(night);updateControls(false);message.textContent=areaHint();care.inspect();window.yardScene={ready:true,setNight,goArea,groundPoint:(x,z)=>{const p=new THREE.Vector3(x,.05,z).project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}},actorPoint:()=>{const p=actor?.point().project(camera);return p?{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}:null},benchPoint:()=>{const root=activeModel(),node=area==='home'?root.getObjectByName('Bench'):root.children.find(o=>o.userData.benchAnchor);const p=area==='home'?node?.localToWorld(new THREE.Vector3(.4,.63,-.12)):node?.getWorldPosition(new THREE.Vector3());if(!p)return null;if(area!=='home'){p.fromArray(node.userData.benchAnchor);p.y=.6;}p.project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}},sitOnBench,actorTurn:turnActor,previewPoint:()=>furniture.previewPoint(),itemPoint:id=>furniture.itemPoint(area,id),cellPoint:(x,y)=>furniture.screenCell(area,x,y),openTool:tool=>tools.open(tool),getState:()=>({resources:{geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs?.length??0,renderCalls:renderFrames},actor:actor?.state()??null,actorError:window.yardActorError??null,furnitureCount:furniture?.count()??0,draft:furniture?.getDraft(),placementPreview:!!furniture?.previewVisible(),orchardBalance:orchardState?.town.berries??null,harvested:!!orchardState?.town.daily[orchardState.today]?.harvested,area,orchardLocked,visibleAreas:[model,districts.plaza,districts.orchard].filter(x=>x.visible).length,night,leaving,hostHidden,careBusy:care.isBusy(),detail:districts.detail,districtRefinement:districts.refinement?.getState()??null,districtFinish:districtFinish?.getState()??null,depthDetails:depthDetails?.state()??null,harvestFeedback:harvestFeedback?.state()??null,landmarks:landmarks?.state()??null,comicStyle:comicStyle?.state()??null,hotspot:hotspots.state(),areaTransition:routeFade.state(),homeFinish,referenceYard:referenceYard?.getState()??null,cozyFinish:cozyFinish?.getState()??null,twoStoryExterior:twoStoryExterior?.getState()??null,style:{family:'cottage',homeMaterials,...districts.lighting(),practicalLights:{porch:lamp.intensity,window:windowLight.intensity,porchDistance:lamp.distance,windowDistance:windowLight.distance,visible:lamp.visible&&windowLight.visible}},drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,diorama:diorama?.getState?.()??null,framing:homeProjected,modelCount:scene.children.filter(x=>x===model).length}),routePoint:name=>{const p=districts.points[name].clone().project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}},plantPoint:()=>{const p=new THREE.Vector3(1.25,.36,.75).project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}},doorPoint:()=>{const p=door.localToWorld(new THREE.Vector3(.37,.8,.04)).project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}}};yardLife=installYardLife({getState:()=>({scene:area,pose:actor?.state().pose||'front',night,busy:closed||leaving||routeFade.active()||care.isBusy()||!!tools?.isOpen()||!!tools?.isEditing()||orchardLocked&&area==='orchard',hidden:hostHidden||document.hidden,orchard:!!orchardState&&!orchardLocked,transition:actor?.state().transition}),goArea,sit:()=>sitOnBench(firstBench()),turn:turnActor});post('room-yard-ready');}catch(e){if(closed)return;document.getElementById('error').hidden=false;message.textContent=inWorkstation?'小镇加载失败，可返回工作站。':'院落加载失败，可返回小屋。';window.yardLoadError=e.message;post('room-yard-failed');}})();

