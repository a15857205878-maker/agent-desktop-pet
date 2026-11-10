export function createTownSurface({workstation,onChange=()=>{},onOpen=()=>{},onClose=()=>{}}){
 const panel=document.createElement('section');panel.id='room-town-surface';panel.hidden=true;panel.tabIndex=-1;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','小屋与小镇');
 const loading=document.createElement('div');loading.className='town-loading';loading.innerHTML='<div class="town-loading-card"><span class="town-loading-mark" aria-hidden="true">⌂</span><p class="town-loading-text" role="status" aria-live="polite"></p><div><button class="town-loading-return">返回房间</button><button class="town-loading-retry" hidden>重新打开</button></div></div>';
 panel.append(loading);document.body.append(panel);
 const text=loading.querySelector('.town-loading-text'),back=loading.querySelector('.town-loading-return'),retry=loading.querySelector('.town-loading-retry'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let frame=null,view=null,phase='closed',hostHidden=document.hidden,generation=0,timeout=null,closingTimer=null,disposed=false;
 function clearTimers(){clearTimeout(timeout);clearTimeout(closingTimer);timeout=closingTimer=null}
 function finishClose(){if(!frame)return;clearTimers();generation++;frame.remove();frame=null;view=null;phase='closed';panel.dataset.phase=phase;panel.hidden=true;onClose();onChange();if(!disposed&&!hostHidden&&!document.hidden)document.querySelector('canvas')?.focus({preventScroll:true})}
 function close({immediate=false}={}){if(!frame)return;if(immediate||reduced.matches||hostHidden){finishClose();return}if(phase==='closing')return;clearTimers();frame.inert=true;frame.tabIndex=-1;phase='closing';panel.dataset.phase=phase;closingTimer=setTimeout(finishClose,160);onChange()}
 function showFailure(message){if(!frame||phase==='closing')return;clearTimeout(timeout);frame.inert=true;frame.tabIndex=-1;phase='failed';panel.dataset.phase=phase;panel.setAttribute('aria-busy','false');text.textContent=message;retry.hidden=false;loading.hidden=false;back.focus({preventScroll:true});onChange()}
 function ready(){if(!frame||phase==='closing'||phase==='ready')return;clearTimeout(timeout);frame.inert=false;frame.tabIndex=0;phase='ready';panel.dataset.phase=phase;panel.setAttribute('aria-busy','false');loading.hidden=true;frame.focus({preventScroll:true});onChange()}
 function open(next){
  if(disposed||!['outdoor','alarm'].includes(next))return;
  if(frame&&next===view&&phase!=='closing')return;
  if(frame)close({immediate:true});
  generation++;view=next;phase='loading';panel.dataset.phase=phase;panel.hidden=false;panel.setAttribute('aria-busy','true');panel.style.inset=next==='alarm'?'max(12px, calc((100vh - 560px)/2)) max(12px, calc((100vw - 600px)/2))':'12px';
  text.textContent=next==='outdoor'?'正在打开院落…':'正在打开专注闹钟…';loading.hidden=false;retry.hidden=true;
  frame=document.createElement('iframe');frame.inert=true;frame.tabIndex=-1;frame.title=next==='alarm'?'专注闹钟':'室外小镇';frame.className='room-town-frame';frame.src=next==='outdoor'?'./yard/index.html?room=outdoor':'./town/index.html?room='+next;
  const opened=frame,version=generation;
  frame.addEventListener('load',()=>{if(frame===opened)opened.contentWindow.postMessage({t:'room-town-visibility',hidden:hostHidden},location.origin)},{once:true});
  frame.addEventListener('error',()=>{if(frame===opened)showFailure('暂时没有打开，可以返回房间或重试。')},{once:true});
  panel.append(frame);onOpen();onChange();back.focus({preventScroll:true});
  timeout=setTimeout(()=>{if(version!==generation||!frame||phase==='ready'||phase==='closing')return;text.textContent='打开得有些慢，可以继续等待、返回或重新打开。';retry.hidden=false;onChange()},12000);
 }
 back.onclick=()=>close();retry.onclick=()=>{if(!frame||!['loading','failed'].includes(phase))return;const next=view;close({immediate:true});open(next)};
 async function receive(e){
  if(e.source===parent&&e.origin===location.origin&&e.data?.t==='room-visibility'){hostHidden=!!e.data.hidden;frame?.contentWindow?.postMessage({t:'room-town-visibility',hidden:hostHidden},location.origin);if(hostHidden&&phase==='closing')finishClose();return}
  if(!frame||e.source!==frame.contentWindow||e.origin!==location.origin)return;
  const d=e.data;
  if(d?.t==='room-yard-ready'&&view==='outdoor'||d?.t==='room-alarm-ready'&&view==='alarm'){ready();return}
  if(d?.t==='room-yard-failed'&&view==='outdoor'){showFailure('院落暂时没有打开，房间和进度都保留着。');return}
  if(d?.t==='room-town-close'||d?.t==='room-town-exit'){close();return}
  if(phase==='closing'||d?.t!=='room-town-call'||typeof d.id!=='string'||!/^[a-z0-9_]{1,64}$/i.test(d.id))return;
  if(phase!=='ready'&&!['bootstrap','focus_state'].includes(d.action)){frame.contentWindow.postMessage({t:'room-town-reply',id:d.id,result:{ok:false,error:'场景尚未准备好，请稍候再操作。'}},location.origin);return}
  const source=frame.contentWindow;let result;try{result={ok:true,data:await workstation.town(d.action,d.payload)}}catch(e){result={ok:false,error:e.message||'小镇未确认，请重试。'}}
  if(frame?.contentWindow===source)source.postMessage({t:'room-town-reply',id:d.id,result},location.origin);
 }
 function key(e){if(e.key==='Escape'&&!e.defaultPrevented&&frame){e.preventDefault();close()}}
 window.addEventListener('message',receive);window.addEventListener('keydown',key);
 return {getFrame:()=>frame,open,close,active:()=>!!frame,getView:()=>view,getState:()=>({view,phase,generation}),dispose(){disposed=true;close({immediate:true});clearTimers();panel.remove();window.removeEventListener('message',receive);window.removeEventListener('keydown',key)}};
}
