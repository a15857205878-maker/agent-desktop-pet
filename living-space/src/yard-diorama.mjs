import {createFloatingScenePanel} from './floating-scene-panel.mjs';
import {createSceneMaskCache} from './scene-mask-cache.mjs';
import {buildRoomCutout} from './room-cutout.mjs';
const liveVisuals=new Set([
 'outdoor-dragon','town-dragon-contact','town-dragon-seat-contact',
 'town-move-marker','orchard-confirmed-fruit','town-hotspot-tint'
]);
export function installYardDiorama({enabled,canvas,renderer,scene,camera,onCommand,isModalOpen=()=>false}){
 if(!enabled)return{active:()=>false,rendered(){},dispose(){}};
 const style=document.createElement('style');style.textContent=`html.yard-model-transparent,html.yard-model-transparent body{background:transparent!important}html.yard-model-transparent body:not(.yard-controls-open)>:is(header,nav,#message:not([data-kind=pending],[data-kind=complete],[data-kind=blocked])){visibility:hidden;pointer-events:none}html.yard-model-transparent canvas{cursor:grab;outline:none}html.yard-model-transparent body.yard-controls-open canvas{cursor:default}`;document.head.append(style);
 let active=false,controls=false,disposed=false,hostHidden=false,timer=null,lastKey='',wantedKey='',sceneKey='',fringeKey='',down=null,dragged=false,captures=0;
 const post=m=>parent.postMessage(m,location.origin);
 const panel=createFloatingScenePanel({id:'yard-floating-tools',title:'小镇工具',contents:[document.querySelector('body>header'),document.getElementById('district-nav'),document.getElementById('town-tool-tray')].filter(Boolean),storageKey:'dragon-yard-floating-tools-v1',onChange:()=>request(true),onClose:()=>show(false)});
 panel.root.dataset.sceneFloatingSurface='true';panel.root.style.zIndex='3';document.body.append(panel.root);
 const surface=document.createElement('canvas');
 const rasterContext=surface.getContext('2d',{willReadFrequently:true});
 function raster(){
  const ratio=Math.min(devicePixelRatio||1,1.25);
  const w=Math.max(1,Math.round(innerWidth*ratio)),h=Math.max(1,Math.round(innerHeight*ratio));
  if(surface.width!==w)surface.width=w;
  if(surface.height!==h)surface.height=h;
  renderer.render(scene,camera);
  rasterContext.clearRect(0,0,w,h);
  rasterContext.drawImage(canvas,0,0,w,h);
  return buildRoomCutout(rasterContext.getImageData(0,0,w,h));
 }
 const maskCache=createSceneMaskCache(()=>{
  const {width,height,runs}=raster();
  return runs.length?{width,height,runs}:null;
 });
 const fringeCache=createSceneMaskCache(()=>{
  const hidden=[];
  scene.traverseVisible(node=>{
   if(liveVisuals.has(node.name)){hidden.push(node);node.visible=false;}
  });
  try{
   const {width,height,fringe}=raster();
   rasterContext.putImageData(new ImageData(fringe,width,height),0,0);
   return {edgePng:surface.toDataURL('image/png')};
  }finally{
   for(const node of hidden)node.visible=true;
  }
 });

 function request(force=false){if(disposed||document.hidden||hostHidden)return;if(force)lastKey='';if(!timer)timer=setTimeout(capture,45);}
 function show(value){controls=!!value;document.body.classList.toggle('yard-controls-open',controls);panel.setOpen(controls);if(!controls&&!isModalOpen())canvas.focus({preventScroll:true});request(true);}
 function capture(){timer=null;if(disposed||document.hidden||hostHidden||lastKey===wantedKey)return;
  // The native window displays this PNG underneath WebView. Only the map
  // belongs in it. Afterwards rasterize the live geometry for the input region.
  const fringe=fringeCache.read(fringeKey),base=maskCache.read(sceneKey);
  if(!base)return;const w=base.width,h=base.height,sx=w/innerWidth,sy=h/innerHeight;
  const nodes=[...document.querySelectorAll('header>strong,header>button,#district-nav,#town-tool-tray,#message,#town-sheet,#town-placement,#orchard-gate,#error,#placement-pin,[data-scene-floating-surface]')].filter(e=>e===panel.root||!panel.root.contains(e));
  let overlays=nodes.filter(e=>!e.hidden&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect(),a=Math.max(0,r.left),b=Math.max(0,r.top),c=Math.min(innerWidth,r.right),d=Math.min(innerHeight,r.bottom);return[a*sx,b*sy,c*sx,d*sy,Math.min(parseFloat(getComputedStyle(e).borderTopLeftRadius)||0,(c-a)/2,(d-b)/2)*Math.min(sx,sy)]}).filter(r=>r[0]<r[2]&&r[1]<r[3]);
  if(overlays.length>8)overlays=[[0,0,w,h]];
  post({t:'room-yard-mask',...base,...fringe,overlays});lastKey=wantedKey;captures++;
 }
 function context(e){e.preventDefault();show(!controls);}
 function key(e){if(e.key==='ContextMenu'||e.key==='F10'&&e.shiftKey){e.preventDefault();show(!controls)}else if(e.key==='Escape'&&controls&&!isModalOpen()){e.preventDefault();e.stopImmediatePropagation();show(false)}}
 function pointerDown(e){if(active&&!controls&&e.button===0){down={x:e.clientX,y:e.clientY};dragged=false}}
 function pointerMove(e){if(down&&e.buttons===1&&!dragged&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>6){dragged=true;down=null;onCommand('drag')}}
 function pointerEnd(){down=null;}
 const observer=new MutationObserver(records=>{if(records.some(r=>r.type!=='attributes'||r.oldValue!==r.target.getAttribute(r.attributeName)))request(true)});observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeOldValue:true,attributeFilter:['hidden','aria-expanded','data-phase','data-kind']});
 canvas.addEventListener('contextmenu',context);document.addEventListener('keydown',key,true);canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerEnd);canvas.addEventListener('pointercancel',pointerEnd);
 return{active:()=>active,rendered({area,night,pose,transition,hidden,modelRevision='',actorRevision=null}){
  if(disposed)return;const next=['home','plaza','orchard'].includes(area);if(next!==active){active=next;document.documentElement.classList.toggle('yard-model-transparent',active);show(!active);}
  if(hidden){clearTimeout(timer);timer=null;return;}
  fringeKey=JSON.stringify([innerWidth,innerHeight,Math.min(devicePixelRatio||1,1.25),area,night,modelRevision]);
  sceneKey=JSON.stringify([fringeKey,pose,transition,actorRevision]);wantedKey=sceneKey+String(controls);if(wantedKey!==lastKey)request();
 },setHidden(value){hostHidden=!!value;if(hostHidden){clearTimeout(timer);timer=null;down=null}else request(true)},getState:()=>({active,controls,captures,rasterCaptures:maskCache.getState().captures,fringeCaptures:fringeCache.getState().captures,panel:panel.getState()}),dispose(){if(disposed)return;disposed=true;clearTimeout(timer);observer.disconnect();panel.dispose();maskCache.clear();fringeCache.clear();style.remove();document.documentElement.classList.remove('yard-model-transparent');document.body.classList.remove('yard-controls-open');canvas.removeEventListener('contextmenu',context);document.removeEventListener('keydown',key,true);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerEnd);canvas.removeEventListener('pointercancel',pointerEnd)}};
}
