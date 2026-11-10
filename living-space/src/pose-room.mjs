import {createRoomAutoLife} from './room-auto-life.mjs';
import {createTownSurface} from './room-town-surface.mjs';
import {createRoomAlarm,createRoomExit} from './room-alarm.mjs';
import {createRoomWorkstation} from './room-workstation-client.mjs';
import {createRoomLighting} from './room-lighting.mjs';
import {createRoomPhone} from './room-phone.mjs';
import {createRoomHandheld,handheldAnchor} from './room-handheld.mjs';
import {buildRoomCutout} from './room-cutout.mjs';
import {createRoomActionController} from './room-action-controller.mjs';
import {createRoomActivities} from './room-activities.mjs';
import {furnitureAt} from './room-hotspots.mjs';
import {installRoomUI} from './pure-room-ui.mjs';
import {motionFrame,transitionFrame,blinkFrame,demoPose} from './pose-motion.mjs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const stage=document.getElementById('stage'),canvas=document.querySelector('canvas');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
const scene=new THREE.Scene();scene.background=null;const lighting=createRoomLighting(scene,renderer);
const handheld=createRoomHandheld();scene.add(handheld);
const camera=new THREE.OrthographicCamera(-4,4,3,-3,.1,100);camera.position.set(-6.8,5.6,7.2);camera.lookAt(0,1.29,0);
let phone=null,alarm=null,exitMat=null;
let sprite,model,textures,pose='back',queued=false,zoomed=false,renderCount=0;const settings={x:0,y:0,z:0,size:1.7},saved={desk:{...settings},chair:{...settings}},configs={back:{station:'desk',base:[-.334,.74,-.75],center:[.49,.27],aspect:1,next:'turn',label:'背身挂机 · 点击角色可以回头'},turn:{station:'desk',base:[-.334,.74,-.75],center:[.49,.27],aspect:1,next:'back',label:'回头回应 · 点击角色回到背身'},relax:{station:'chair',base:[.68,.66,1.60],center:[.49,.46],aspect:.5,next:'rest',label:'扶手椅放松 · 点击角色闭目休息'},rest:{station:'chair',base:[.68,.66,1.60],center:[.49,.46],aspect:.5,next:'relax',label:'闭目休息 · 点击角色睁眼'}};
const status=document.getElementById('status');
const actionController=createRoomActionController();
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let externallyHidden=false;let motionEnabled=!reducedMotion.matches,transition=null,frameTimer=0,rafId=0,motionTime=0,lastFrameTime=0,poseStarted=0,restWeight=0,demoEnabled=true,demoTime=0;
const blendUniforms={nextPoseMap:{value:null},poseUvDelta:{value:new THREE.Vector2()},poseBlend:{value:0},poseFrameBounds:{value:new THREE.Vector2(0,.5)},nextPoseBounds:{value:new THREE.Vector2(0,.5)},eyeOnly:{value:0},sourcePoseOffset:{value:new THREE.Vector2()}};
function setBlend(target,amount){if(!textures)return;blendUniforms.nextPoseMap.value=textures[target];blendUniforms.poseUvDelta.value.copy(textures[target].offset).sub(sprite.material.map.offset);blendUniforms.poseBlend.value=amount;blendUniforms.eyeOnly.value=Number(configs[pose].station==='chair'&&['relax','rest'].includes(target));blendUniforms.sourcePoseOffset.value.copy(sprite.material.map.offset);const right=t=>t===textures.rest||t===textures.turn;const currentRight=right(sprite.material.map),nextRight=right(textures[target]);blendUniforms.poseFrameBounds.value.set(currentRight?.5:0,currentRight?1:.5);blendUniforms.nextPoseBounds.value.set(nextRight?.5:0,nextRight?1:.5);}
function finishTransition(){if(!transition)return;const target=transition.target;transition=null;applyPose(target);sprite.material.opacity=1;setBlend(target==='rest'?'rest':target,target==='rest'?1:0);if(target==='turn'&&!demoEnabled&&motionEnabled)startHead();}
function startHead(){actionController.startHead();applyPose('turn');sprite.material.map=textures.back;sprite.material.needsUpdate=true;setBlend('turn',0);redraw();}
function setMotion(enabled){motionEnabled=!!enabled;clearTimeout(frameTimer);finishTransition();if(sprite){sprite.material.rotation=0;setBlend(pose,pose==='rest'?1:0);update();}const button=document.getElementById('motion');button.textContent=motionEnabled?'暂停动作':'开启动作';button.setAttribute('aria-pressed',String(motionEnabled));lastFrameTime=0;redraw();}
function setDemo(enabled){
 demoEnabled=!!enabled;demoTime=0;
 const button=document.getElementById('demo');button.setAttribute('aria-pressed',String(demoEnabled));
 if(demoEnabled){setMotion(true);setPose('back',{automatic:true});}redraw();
}
document.getElementById('demo').addEventListener('click',()=>setDemo(!demoEnabled));
document.getElementById('motion').addEventListener('click',()=>setMotion(!motionEnabled));
document.getElementById('motion').textContent=motionEnabled?'暂停动作':'开启动作';document.getElementById('motion').setAttribute('aria-pressed',String(motionEnabled));
reducedMotion.addEventListener('change',e=>setMotion(!e.matches));
function animate(now){
 if(!sprite)return;
 const realDtMs=lastFrameTime?Math.max(0,now-lastFrameTime):0,dt=Math.min(realDtMs/1000,.1);lastFrameTime=now;
 if(motionEnabled){motionTime+=dt*1.5;if(demoEnabled)demoTime+=dt*1.5;}
 if(motionEnabled&&demoEnabled&&!transition){const target=demoPose(demoTime);if(target!==pose)setPose(target,{automatic:true});}
 const action=actionController.step(realDtMs,{pose,motionEnabled,demoEnabled,transitioning:!!transition,gameActive:activities.active(),hidden:document.hidden||externallyHidden,menuOpen:!document.getElementById('context-menu').hidden});
 if(transition){
  const f=transitionFrame((now-transition.start)/transition.duration,transition.transfer);
  if(f.swap&&!transition.swapped){transition.swapped=true;applyPose(transition.target);setBlend(transition.target,transition.target==='rest'?1:0);}
  sprite.material.opacity=f.opacity;
  if(!transition.transfer){if(configs[pose].station==='chair')setBlend('rest',transition.eyeStart+(Number(transition.target==='rest')-transition.eyeStart)*f.blend);else setBlend(transition.target,f.blend);}
  if(f.progress===1)finishTransition();
 }else if(action.headWeight!==null){setBlend('turn',action.headWeight);if(action.headFinished){applyPose('back');setBlend('back',0);}}
 else if(action.eyeWeight!==null)setBlend('rest',action.eyeWeight);
 else if(motionEnabled&&pose==='relax')setBlend('rest',demoEnabled?blinkFrame(motionTime-poseStarted):blinkFrame(actionController.getState().blinkMs/1000*1.5));
 else setBlend(pose,pose==='rest'?1:0);
 if(motionEnabled&&!demoEnabled&&pose==='turn'&&!transition&&!actionController.isHeadTurning()&&motionTime-poseStarted>3.2)setPose('back',{automatic:true});
 const targetRest=pose==='rest'?1:configs[pose].station==='chair'?blendUniforms.poseBlend.value:0;
 restWeight+=(targetRest-restWeight)*(1-Math.exp(-dt/.45));
 const f=motionEnabled?motionFrame(motionTime,pose,restWeight):{stretch:1,rotation:0};
 sprite.scale.set(settings.size*configs[pose].aspect,settings.size*f.stretch,1);sprite.material.rotation=f.rotation;
}

let cachedMask=null,maskTimer=0;
const roomUI=installRoomUI({canvas,onMenuChange:open=>open?activities.pause('menu'):activities.resume('menu'),onMask:()=>{if(roomUI?.native){clearTimeout(maskTimer);maskTimer=setTimeout(sendMask,60)}}});
function sendMask(){
 if(!roomUI.native||!window.poseRoom.ready)return;
 if(!cachedMask){
  const w=canvas.width,h=canvas.height,surface=document.createElement('canvas');surface.width=w;surface.height=h;
  renderer.render(scene,camera);const context=surface.getContext('2d',{willReadFrequently:true});context.drawImage(canvas,0,0,w,h);
  const cutout=buildRoomCutout(context.getImageData(0,0,w,h));context.putImageData(new ImageData(cutout.fringe,w,h),0,0);
  cachedMask={width:w,height:h,runs:cutout.runs,edgePng:surface.toDataURL('image/png')};

 }
 const overlays=[...document.querySelectorAll('#context-menu:not([hidden]),#adjust-panel:not([hidden]),#furniture-feedback:not([hidden]),#room-focus-hint:not([hidden]),#room-game:not([hidden]),#room-town-surface:not([hidden])')].flatMap(e=>{const parts=[...e.querySelectorAll('[data-room-surface]')];return parts.length?parts:[e]}).map(e=>{const r=e.getBoundingClientRect();const sx=cachedMask.width/stage.clientWidth,sy=cachedMask.height/stage.clientHeight;const radius=Math.min(parseFloat(getComputedStyle(e).borderTopLeftRadius)||0,r.width/2,r.height/2);return [r.left*sx,r.top*sy,r.right*sx,r.bottom*sy,radius*sx]});
 parent.postMessage({t:'room-mask',...cachedMask,overlays},location.origin);
}
window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||e.data?.t!=='room-visibility')return;externallyHidden=!!e.data.hidden;externallyHidden?activities.pause('host'):activities.resume('host');clearTimeout(frameTimer);if(externallyHidden){cancelAnimationFrame(rafId);queued=false;}else{lastFrameTime=0;redraw();}});
function render(now){queued=false;if(document.hidden||externallyHidden||townSurface.active())return;animate(now);renderer.render(scene,camera);renderCount++;if(motionEnabled&&window.poseRoom.ready){clearTimeout(frameTimer);frameTimer=setTimeout(redraw,1000/30)}}
function redraw(){if(!queued){queued=true;rafId=requestAnimationFrame(render)}}
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);const span=Math.max(6.08,7.8*h/w);camera.left=-span*w/h/2;camera.right=span*w/h/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();cachedMask=null;setTimeout(sendMask,100);redraw()}
function update(){if(!sprite)return;const c=configs[pose];sprite.position.set(c.base[0]+settings.x,c.base[1]+settings.y,c.base[2]+settings.z);sprite.center.set(...c.center);sprite.scale.set(settings.size*c.aspect,settings.size,1);redraw()}
function applyPose(value){if(!configs[value]||!sprite)return;const old=configs[pose].station,next=configs[value].station;if(old!==next){Object.assign(saved[old],settings);Object.assign(settings,saved[next]);document.querySelectorAll('input').forEach(input=>input.value=String(settings[input.name]));}if(value!==pose)poseStarted=motionTime;pose=value;sprite.material.map=textures[configs[value].station==='chair'?'relax':value];sprite.material.needsUpdate=true;document.querySelectorAll('[data-pose]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pose===pose)));status.textContent=configs[pose].label;update()}
function setPose(value,{immediate=false,automatic=false}={}){
 if(!configs[value]||!sprite)return;
 if(!automatic){demoEnabled=false;document.getElementById('demo').setAttribute('aria-pressed','false');}
 finishTransition();
 if(!immediate&&motionEnabled&&value==='back'&&actionController.isHeadTurning()){actionController.returnHead();redraw();return;}
 actionController.selectPose();
 if(!immediate&&motionEnabled&&window.poseRoom.ready&&value==='turn'&&configs[pose].station==='desk'&&!automatic){startHead();return;}
 if(immediate||!motionEnabled||!window.poseRoom.ready||value===pose){applyPose(value);setBlend(value,value==='rest'?1:0);return;}
 transition={target:value,start:performance.now(),duration:configs[value].station===configs[pose].station?(configs[pose].station==='chair'?(value==='rest'?180:300):440):800,transfer:configs[value].station!==configs[pose].station,swapped:false,eyeStart:blendUniforms.poseBlend.value};
 if(configs[pose].station!=='chair')setBlend(value,0);redraw();
}

document.querySelectorAll('[data-pose]').forEach(b=>b.addEventListener('click',()=>setPose(b.dataset.pose)));
function setSoftLight(value){lighting.setSoft(value);document.getElementById('soft-light').setAttribute('aria-pressed',String(lighting.getState().soft));cachedMask=null;redraw();requestAnimationFrame(sendMask);}
function setCompanionHints(value){activities.setCompanionHints(value);document.getElementById('companion-hints').setAttribute('aria-pressed',String(activities.companionHints()));}
document.getElementById('soft-light').addEventListener('click',()=>setSoftLight(!lighting.getState().soft));
document.getElementById('companion-hints').addEventListener('click',()=>setCompanionHints(!activities.companionHints()));

document.getElementById('zoom').addEventListener('click',()=>{zoomed=!zoomed;camera.zoom=zoomed?1.55:1;camera.updateProjectionMatrix();document.getElementById('zoom').setAttribute('aria-pressed',String(zoomed));cachedMask=null;setTimeout(sendMask,100);redraw()});
document.getElementById('reset').addEventListener('click',()=>{for(const c of Object.values(saved))Object.assign(c,{x:0,y:0,z:0,size:1.7});Object.assign(settings,{x:0,y:0,z:0,size:1.7});zoomed=false;camera.zoom=1;camera.updateProjectionMatrix();document.getElementById('zoom').setAttribute('aria-pressed','false');cachedMask=null;setTimeout(sendMask,100);document.querySelectorAll('input').forEach(input=>input.value=String(settings[input.name]));update();setPose('back',{immediate:true})});
document.querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>{settings[input.name]=Number(input.value);update()}));
const alphaSheets={};
const feedback=document.createElement('div');feedback.id='furniture-feedback';feedback.hidden=true;feedback.setAttribute('role','status');stage.append(feedback);let feedbackTimer=0,lastFurniture=null;
function hideFeedback(){clearTimeout(feedbackTimer);if(!feedback.hidden){feedback.hidden=true;sendMask();}}
function showFeedback(text){hideFeedback();feedback.textContent=text;feedback.hidden=false;sendMask();feedbackTimer=setTimeout(hideFeedback,2600);}
document.addEventListener('contextmenu',hideFeedback);document.getElementById('adjust-toggle').addEventListener('click',hideFeedback);
const focusHint=document.createElement('p');focusHint.id='room-focus-hint';focusHint.hidden=true;focusHint.style.cssText='position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:4;background:#fff9ef;color:#51475c;padding:8px 14px;border-radius:14px;font:12px sans-serif;pointer-events:none';document.body.append(focusHint);
let lifeFocusKind='unknown';
const workstation=createRoomWorkstation({onStatus:data=>{const focus=data?.focus;lifeFocusKind=focus?.kind||'unknown';focusHint.hidden=!focus||!['running','paused'].includes(focus.kind)||!Number.isInteger(focus.remaining);if(!focusHint.hidden)focusHint.textContent=(focus.kind==='running'?'小镇专注中 · ':'小镇专注已暂停 · ')+Math.floor(focus.remaining/60)+':'+String(focus.remaining%60).padStart(2,'0');requestAnimationFrame(sendMask);}});
let townPausedAt=null;
const townSurface=createTownSurface({workstation,onChange:()=>requestAnimationFrame(sendMask),onOpen:()=>{townPausedAt=performance.now();hideFeedback();activities.pause('town');clearTimeout(frameTimer);cancelAnimationFrame(rafId);queued=false},onClose:()=>{if(transition&&townPausedAt!==null)transition.start+=performance.now()-townPausedAt;townPausedAt=null;lastFrameTime=0;activities.resume('town');redraw()}});
document.getElementById('room-outdoor').onclick=()=>townSurface.open('outdoor');document.getElementById('room-alarm').onclick=()=>townSurface.open('alarm');document.getElementById('room-pat').onclick=()=>parent.postMessage({t:'room-command',action:'pat'},location.origin);
const activities=createRoomActivities({onSurfaceChanged:()=>requestAnimationFrame(sendMask),onOpen:()=>{hideFeedback();setDemo(false)},onClose:result=>{if(!result)return;showFeedback(result.gameId==='memory'?'配对完成啦，休息一下吧。':`这一局 ${result.score} 分，下次一起再玩。`);if(motionEnabled&&configs[pose].station==='desk')startHead();else if(actionController.isNapping())actionController.wake();},onWork:()=>setPose('back'),onNavigate:page=>page==='town'?Promise.resolve(townSurface.open('alarm')):workstation.open(page).then(()=>showFeedback(page==='town'?'在闹钟里开始或继续专注。':'已打开书房与放松。')).catch(e=>showFeedback(e.message))});
const autoLife=createRoomAutoLife({surface:townSurface,roomState:()=>({ready:!!window.poseRoom?.ready,pose,night:false}),setPose,setDemo,isBusy:()=>activities.active()||!document.getElementById('context-menu').hidden||!document.getElementById('adjust-panel').hidden||['running','paused'].includes(lifeFocusKind),onMask:()=>requestAnimationFrame(sendMask)});
window.addEventListener('pagehide',()=>{autoLife.dispose();townSurface.dispose();activities.dispose();lighting.dispose();workstation.dispose()},{once:true});
const raycaster=new THREE.Raycaster();
function sceneHit(e){const r=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);return raycaster.intersectObjects([sprite,model,handheld,phone,alarm,exitMat].filter(Boolean),true);}
function actorPixel(hit){
 const {pixels,width,height}=alphaSheets[configs[pose].station],uv=hit.uv.clone();sprite.material.map.transformUv(uv);const bounds=blendUniforms.poseFrameBounds.value;if(uv.x<bounds.x||uv.x>bounds.y)return false;
 const x=Math.min(width-1,Math.max(0,Math.floor(uv.x*width))),y=Math.min(height-1,Math.max(0,Math.floor(uv.y*height)));return pixels[(y*width+x)*4+3]>30;
}
function pickScene(e){
 if(!sprite)return null;
 for(const hit of sceneHit(e)){if(['alarm','outdoor'].includes(hit.object.userData.activity))return {kind:hit.object.userData.activity};if(hit.object.userData.roomLamp)return {kind:'lamp'};if(hit.object.userData.activity==='phone')return {kind:'phone'};if(hit.object.userData.activity==='snake')return {kind:'handheld'};if(hit.object===sprite){if(actorPixel(hit))return {kind:'actor'};continue;}return {kind:furnitureAt(hit.point)};}
 return null;
}
canvas.addEventListener('click',e=>{
 if(!sprite||e.button!==0||townSurface.active()||activities.active()||!roomUI.allowSceneClick())return;const hit=pickScene(e);if(!hit?.kind)return;
 if(hit.kind==='lamp'){lastFurniture='lamp';setSoftLight(!lighting.getState().soft);return;}
 if(transition)return;
 if(hit.kind==='actor'){if(pose==='relax'&&actionController.isNapping()){actionController.wake();redraw();}else setPose(configs[pose].next);return;}
 lastFurniture=hit.kind;
 if(hit.kind==='alarm'||hit.kind==='outdoor'){townSurface.open(hit.kind);return;}actionController.selectPose();
 if(hit.kind==='bookshelf'){workstation.open('reading').then(()=>showFeedback('已打开书房，取一本书吧。')).catch(e=>showFeedback(e.message));return;}
 if(hit.kind==='phone')activities.open('memory',{device:'phone'});else if(hit.kind==='handheld')activities.open('snake');else if(hit.kind==='chair')setPose('relax');else if(hit.kind==='computer')activities.open('computer');else if(hit.kind==='table')activities.open();
});
canvas.addEventListener('pointermove',e=>{if(e.buttons)return;const kind=pickScene(e)?.kind;canvas.style.cursor=kind?'pointer':'default';canvas.title=({alarm:'书桌闹钟 · 点击专注',outdoor:'门口 · 出门到小镇',bookshelf:'书架 · 点击取一本书',lamp:'落地灯 · 点击开关暖光',phone:'桌边手机 · 点击玩翻翻乐',handheld:'红蓝掌机 · 点击玩贪吃蛇',actor:'点击角色互动',chair:'扶手椅 · 点击放松',computer:'电脑 · 点击选择活动',table:'茶几 · 点击玩翻翻乐'})[kind]||'';});
function worldPoint(x,y,z){const p=new THREE.Vector3(x,y,z).project(camera),r=canvas.getBoundingClientRect();return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};}

function artworkPoint(u,v){if(!sprite)return null;const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);const point=sprite.position.clone().addScaledVector(right,(u-sprite.center.x)*sprite.scale.x).addScaledVector(up,(1-v-sprite.center.y)*sprite.scale.y).project(camera);const r=canvas.getBoundingClientRect();return {x:r.left+(point.x+1)*r.width/2,y:r.top+(1-point.y)*r.height/2}}
window.poseRoom={ready:false,townView:()=>townSurface.getView(),spatialState:()=>townSurface.getState(),openTown:view=>townSurface.open(view),alarmPoint:()=>alarm?worldPoint(alarm.position.x,alarm.position.y,alarm.position.z):null,exitPoint:()=>exitMat?worldPoint(...exitMat.position.toArray()):null,bookshelfPoint:()=>worldPoint(1.55,1.05,-.6),lampPoint:()=>{const p=lighting.getState().lampPosition;return p?worldPoint(...p):null},setSoftLight,setCompanionHints,phonePoint:()=>{if(!phone)return null;const p=phone.localToWorld(new THREE.Vector3(0,.17,.017));return worldPoint(p.x,p.y,p.z)},handheldPoint:()=>worldPoint(...handheldAnchor.map((v,i)=>i===1?v+.04:v)),setPose,setMotion,setDemo,artworkPoint,worldPoint,gameState:()=>activities.getState(),getStatus:()=>({autoLife:autoLife.state(),ready:window.poseRoom.ready,lighting:lighting.getState(),companionHints:activities.companionHints(),phone:phone?{anchor:phone.position.toArray(),depthTest:phone.children.every(o=>o.material.depthTest),meshCount:phone.children.length}:null,handheld:{anchor:[...handheldAnchor],depthTest:handheld.children.every(o=>o.material.depthTest),meshCount:handheld.children.length},actions:actionController.getState(),lastFurniture,pose,station:configs[pose].station,aspect:configs[pose].aspect,demoEnabled,demoTime,eyeOnly:blendUniforms.eyeOnly.value,motionEnabled,motionTime,transition:transition?{target:transition.target,transfer:transition.transfer}:null,opacity:sprite?.material.opacity,blend:blendUniforms.poseBlend.value,scale:sprite?.scale.toArray(),rotation:sprite?.material.rotation,renderCount,spriteId:sprite?.uuid,spriteCount:scene.children.filter(o=>o.isSprite).length,position:sprite?.position.toArray(),size:settings.size,texture:sprite?.material.map.uuid,depthTest:sprite?.material.depthTest,settings:{...settings}})};
new ResizeObserver(resize).observe(stage);document.addEventListener('visibilitychange',()=>{clearTimeout(frameTimer);if(document.hidden){cancelAnimationFrame(rafId);queued=false;}else{lastFrameTime=0;redraw();}});
(async()=>{try{
 const loaded=await new GLTFLoader().loadAsync(window.poseAssets.room);model=loaded.scene;
 const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3());model.position.set(center.x,-bounds.min.y,-center.z);model.scale.x=-1;scene.add(model);lighting.bindModel(model);phone=createRoomPhone(model);scene.add(phone);alarm=createRoomAlarm(model);scene.add(alarm);exitMat=createRoomExit(model);scene.add(exitMat);
 const maps=await Promise.all([window.poseAssets.actor,window.poseAssets.armchair].map(url=>new THREE.TextureLoader().loadAsync(url)));
 for(const [i,station] of ['desk','chair'].entries()){const map=maps[i];map.colorSpace=THREE.SRGBColorSpace;const c=document.createElement('canvas');c.width=map.image.width;c.height=map.image.height;const ctx=c.getContext('2d');ctx.drawImage(map.image,0,0);alphaSheets[station]={width:c.width,height:c.height,pixels:ctx.getImageData(0,0,c.width,c.height).data};}
 textures={back:maps[0].clone(),turn:maps[0].clone(),relax:maps[1].clone(),rest:maps[1].clone()};for(const [name,t] of Object.entries(textures)){t.repeat.set(.5,1);t.offset.set(name==='back'?20/1774:['turn','rest'].includes(name)?.5:0,0);if(name==='rest')t.offset.x-=36/1254;t.needsUpdate=true;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter}

 sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:textures.back,transparent:true,alphaTest:.12,depthTest:true,depthWrite:false,toneMapped:false}));sprite.material.onBeforeCompile=shader=>{
 Object.assign(shader.uniforms,blendUniforms);
 shader.fragmentShader='uniform sampler2D nextPoseMap;uniform vec2 poseUvDelta;uniform float poseBlend;uniform vec2 poseFrameBounds;uniform vec2 nextPoseBounds;uniform float eyeOnly;uniform vec2 sourcePoseOffset;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',THREE.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;', 'sampledDiffuseColor.a*=step(poseFrameBounds.x,vMapUv.x)*step(vMapUv.x,poseFrameBounds.y);vec2 nextUv=vMapUv+poseUvDelta;vec4 nextColor=texture2D(nextPoseMap,nextUv);nextColor.a*=step(nextPoseBounds.x,nextUv.x)*step(nextUv.x,nextPoseBounds.y);vec2 localUv=vec2((vMapUv.x-sourcePoseOffset.x)*2.0,1.0-vMapUv.y);float eyeDistance=length((localUv-vec2(.49,.326))/vec2(.235,.078));float eyeMask=1.0-smoothstep(.82,1.0,eyeDistance);float blendWeight=poseBlend*mix(1.0,eyeMask,eyeOnly);sampledDiffuseColor=mix(sampledDiffuseColor,nextColor,blendWeight); diffuseColor *= sampledDiffuseColor;'));
};
sprite.material.customProgramCacheKey=()=> 'pose-transition-v2-eye-mask';setBlend('back',0);sprite.center.set(.49,.27);scene.add(sprite);update();setPose('back',{immediate:true,automatic:true});scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);window.poseRoom.ready=true;resize();if(roomUI.native)parent.postMessage({t:'room-ready'},location.origin);
}catch(error){status.textContent='素材加载失败，请重新打开预览。';window.poseRoom.error=String(error);console.error(error)}})();




