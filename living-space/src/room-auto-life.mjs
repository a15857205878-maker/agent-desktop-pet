import {createLifeSchedule} from './auto-life-core.mjs';
export function createRoomAutoLife({surface,roomState,setPose,setDemo,isBusy=()=>false,onMask=()=>{}}){
 const schedule=createLifeSchedule();let native=null,lastNative=0,child=null,childFrame=null,childAt=0,pending=null,seq=0,hidden=document.hidden,disposed=false,changedAt=0,lastSignature='';
 const post=d=>{if(parent!==window)parent.postMessage(d,location.origin)};
 const frame=()=>surface.getFrame();
 const toYard=d=>frame()?.contentWindow?.postMessage(d,location.origin);
 const ownState=()=>surface.active()&&surface.getView()==='outdoor'&&child&&childFrame===frame()?child:{scene:'room',pose:roomState().pose,night:!!roomState().night,busy:false,phase:surface.active()?'switching':'stable',orchard:false};
 const childFresh=()=>!!child&&childFrame===frame()&&Date.now()-childAt<=4000;
 const permitted=()=>native?.enabled===true&&!native.held&&Number.isFinite(native.idle_seconds)&&native.idle_seconds>=600&&Date.now()-lastNative<=8000&&!hidden&&!document.hidden&&!isBusy()&&(!surface.active()||surface.getView()!=='outdoor'||surface.getState().phase!=='ready'||childFresh());
 const yardOptions=()=>({t:'yard-life-options',enabled:native?.enabled===true,held:native?.held===true,permitted:permitted()});
 function blocked(){return isBusy()||surface.active()&&(surface.getView()!=='outdoor'||surface.getState().phase!=='ready'||!childFresh()||child.busy)||!!pending}
 function touch(){schedule.touch();pending=null}
 function cancel(){schedule.cancel();pending=null}
 function configure(value){native={...(native||{}),...value};schedule.configure(native);touch();post({t:'room-life-config',enabled:native.enabled===true,held:native.held===true});buttons();toYard(yardOptions())}
 function buttons(){for(const [id,text,key] of [['room-life-toggle','自动生活','enabled'],['room-life-hold','固定当前场景','held']]){const b=document.getElementById(id);if(b){b.disabled=!native;b.textContent=text+(native?.[key]?' · 开':' · 关');b.setAttribute('aria-pressed',String(!!native?.[key]))}}}
 function receive(e){
  if(e.origin!==location.origin)return;
  if(e.source===parent){
   if(e.data?.t==='room-life-state'){native=e.data;lastNative=Date.now();schedule.configure(native);if(!permitted())cancel();buttons();toYard(yardOptions());return}
   if(e.data?.t==='room-visibility'){hidden=!!e.data.hidden;if(hidden)touch();toYard(yardOptions());return}
  }
  if(!frame()||e.source!==frame().contentWindow)return;
  const d=e.data;
  if(d?.t==='yard-life-state'&&['home','plaza','orchard'].includes(d.scene)&&['front','back','sit'].includes(d.pose)){childAt=Date.now();childFrame=frame();child={scene:d.scene,pose:d.pose,night:d.night===true,busy:d.busy===true,phase:d.phase==='switching'?'switching':'stable',orchard:d.orchard===true};return}
  if(d?.t==='yard-life-user'){touch();return}
  if(d?.t==='yard-life-config'&&typeof d.enabled==='boolean'&&typeof d.held==='boolean')configure(d);
 }
 function begin(target){
  setDemo(false);pending={...target,id:'life_'+(++seq),at:Date.now(),sent:false};
  if(target.scene==='room'){
   if(surface.active())surface.close();
  }else if(!surface.active()){child=null;surface.open('outdoor')}
 }
 function advance(){
  if(!pending)return;
  if(!permitted()){cancel();toYard(yardOptions());return}
  if(Date.now()-pending.at>15000){touch();return}
  if(pending.scene==='room'){
   if(!surface.active()){setPose(pending.pose,{automatic:true});pending=null}return;
  }
  if(surface.getState().phase!=='ready'||!childFresh()||child.busy)return;
  if(!pending.sent){toYard({t:'yard-life-command',id:pending.id,scene:pending.scene,pose:pending.pose});pending.sent=true;return}
  if(child.scene===pending.scene&&child.pose===pending.pose&&child.phase==='stable')pending=null;
 }
 function tick(){
  if(disposed)return;advance();
  const s=ownState(),stale=!native||Date.now()-lastNative>8000,paused=hidden||document.hidden||stale||blocked();
  if(!pending){const target=schedule.step({idleSeconds:stale?null:native.idle_seconds,ready:roomState().ready,busy:blocked(),hidden:hidden||document.hidden,scene:s.scene,orchard:s.orchard});if(target)begin(target)}
  const actual=ownState(),phase=pending?'switching':paused?'paused':actual.phase;
  const signature=JSON.stringify([actual.scene,actual.pose,actual.night,phase]);if(signature!==lastSignature){lastSignature=signature;changedAt=Date.now()}
  if(!surface.active()||surface.getView()!=='outdoor'||childFresh())post({t:'room-life-report',scene:actual.scene,pose:actual.pose,night:actual.night===true,automatic:schedule.state().active,phase});
  buttons();if(native)toYard(yardOptions());
 }
 const input=e=>{if(!e.target?.closest?.('[data-life-control]'))touch()};
 const toggle=document.getElementById('room-life-toggle'),hold=document.getElementById('room-life-hold');
 toggle?.setAttribute('data-life-control','');hold?.setAttribute('data-life-control','');
 if(toggle)toggle.onclick=()=>configure({enabled:!native?.enabled,held:native?.held===true});if(hold)hold.onclick=()=>configure({enabled:native?.enabled!==false,held:!native?.held});
 window.addEventListener('message',receive);document.addEventListener('pointerdown',input,true);document.addEventListener('keydown',input,true);
 const timer=setInterval(tick,1000);buttons();
 return {state:()=>({native,child,pending,schedule:schedule.state(),changedAt}),tick,touch,dispose(){disposed=true;clearInterval(timer);window.removeEventListener('message',receive);document.removeEventListener('pointerdown',input,true);document.removeEventListener('keydown',input,true)}};
}
