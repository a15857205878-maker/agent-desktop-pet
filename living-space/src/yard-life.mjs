export function installYardLife({getState,goArea,sit,turn}){
 let disposed=false,working=false,seen=null,options=null,optionsAt=0,generation=0;
 const post=d=>{if(parent!==window)parent.postMessage(d,location.origin)};
 const menu=document.createElement('div');menu.id='yard-life-options';menu.hidden=true;menu.setAttribute('role','menu');menu.style.cssText='position:fixed;z-index:8;padding:8px;border:1px solid #e5c77c;border-radius:18px;background:#252b3c;box-shadow:0 8px 24px #0003;display:grid;gap:5px;max-width:calc(100% - 16px)';document.body.append(menu);
 const toggle=document.createElement('button'),hold=document.createElement('button');menu.append(toggle,hold);
 const transitionStyle=document.createElement('style');transitionStyle.textContent='body.life-switching>canvas{opacity:0}body>canvas{transition:opacity .18s ease}@media(prefers-reduced-motion:reduce){body>canvas{transition:none}}';document.head?.append(transitionStyle);
 const fade=value=>document.body.classList?.toggle('life-switching',value);
 const permitted=()=>options?.permitted===true&&Date.now()-optionsAt<5000;
 function labels(){toggle.textContent='自动生活 · '+(options?.enabled?'开':'关');hold.textContent='固定当前场景 · '+(options?.held?'开':'关')}
 function set(key){if(!options)return;const next={...options,[key]:!options[key]};post({t:'yard-life-config',enabled:next.enabled,held:next.held});menu.hidden=true}
 toggle.onclick=()=>set('enabled');hold.onclick=()=>set('held');
 function user(){generation++;working=false;fade(false);post({t:'yard-life-user'})}
 function hide(e){if(!menu.contains(e.target))menu.hidden=true}
 function context(e){if(!options)return;e.preventDefault();labels();menu.hidden=false;menu.style.left=Math.max(8,Math.min(e.clientX,innerWidth-230))+'px';menu.style.top=Math.max(8,Math.min(e.clientY,innerHeight-120))+'px';toggle.focus()}
 async function receive(e){
  if(e.origin!==location.origin||e.source!==parent)return;const d=e.data;
  if(d?.t==='yard-life-options'&&typeof d.enabled==='boolean'&&typeof d.held==='boolean'){optionsAt=Date.now();options={enabled:d.enabled,held:d.held,permitted:d.permitted===true&&d.enabled&&!d.held};if(!options.permitted){generation++;working=false;fade(false)}labels();return}
  if(d?.t!=='yard-life-command'||typeof d.id!=='string'||!/^life_\d+$/.test(d.id)||d.id===seen||!['home','plaza','orchard'].includes(d.scene)||!['front','back','sit'].includes(d.pose))return;
  seen=d.id;const initial=getState();if(!permitted()||initial.busy||initial.hidden||d.scene==='orchard'&&!initial.orchard)return;
  const version=++generation;working=true;
  const allowed=()=>!disposed&&generation===version&&!getState().hidden&&permitted();
  try{fade(true);await new Promise(r=>setTimeout(r,globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:180));if(!allowed())return;await goArea(d.scene,allowed);if(!allowed())return;const state=getState();if(state.scene!==d.scene||state.busy||state.hidden)return;if(d.pose==='sit')sit();else if(d.pose==='back')turn();}
  finally{if(generation===version)working=false;fade(false);publish()}
 }
 function publish(){if(disposed)return;const s=getState();post({t:'yard-life-state',scene:s.scene,pose:s.pose,night:s.night,busy:s.busy||!menu.hidden,orchard:s.orchard,phase:working||s.transition?'switching':'stable'})}
 document.addEventListener('pointerdown',user,true);document.addEventListener('keydown',user,true);document.addEventListener('pointerdown',hide);document.addEventListener('contextmenu',context);window.addEventListener('message',receive);const timer=setInterval(publish,700);
 return {publish,dispose(){disposed=true;clearInterval(timer);fade(false);transitionStyle.remove();menu.remove();document.removeEventListener('pointerdown',user,true);document.removeEventListener('keydown',user,true);document.removeEventListener('pointerdown',hide);document.removeEventListener('contextmenu',context);window.removeEventListener('message',receive)}};
}
