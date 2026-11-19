import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
const root=dirname(fileURLToPath(import.meta.url));
const read=name=>readFileSync(root+'/'+name,'utf8');

function scheduler(){
 let elapsed=0,seq=0;
 const scheduled=new Map();
 return {
   globals:{
     performance:{now:()=>elapsed},
     requestAnimationFrame:()=>0,cancelAnimationFrame(){},
     setTimeout(fn,delay){const id=++seq;scheduled.set(id,{fn,at:elapsed+delay});return id;},
     clearTimeout(id){scheduled.delete(id);},
   },
   advance(ms){
     const end=elapsed+ms;
     for(;;){
       const next=[...scheduled.entries()].sort((a,b)=>a[1].at-b[1].at)[0];
       if(!next||next[1].at>end)break;
       elapsed=next[1].at;scheduled.delete(next[0]);next[1].fn();
     }
     elapsed=end;
   }
 };
}

function fadeHarness(){
 const clock=scheduler();
 const create=vm.runInNewContext(read('town-route-fade.mjs').replace('export function','function')+'\ncreateTownRouteFade;',clock.globals);
 const canvas={style:{opacity:'.9',transition:'original'}};
 let hidden=false;
 return {clock,canvas,controller:create(canvas,{isHidden:()=>hidden,reduceMotion:()=>false}),
   hide(value){hidden=value;}};
}

test('visible fade settles if animation frames stop',async()=>{
 const h=fadeHarness();
 assert.ok(h.controller.begin('home','plaza'));
 let settled=false;
 const done=h.controller.fade('out',0,140).then(value=>{settled=value});
 h.clock.advance(550);
 await Promise.resolve();
 assert.equal(settled,true);
 assert.equal(h.canvas.style.opacity,'0');
 h.controller.finish();
 await done;
 assert.deepEqual(h.canvas.style,{opacity:'.9',transition:'original'});
});

test('hidden fade stays paused and resumes within a bound',async()=>{
 const h=fadeHarness();
 h.controller.begin('home','plaza');
 let settled;
 const done=h.controller.fade('in',1,175).then(value=>{settled=value});
 h.clock.advance(15);
 h.hide(true);h.controller.pause();
 h.clock.advance(120000);
 await Promise.resolve();
 assert.equal(settled,undefined);
 h.hide(false);h.controller.resume();
 h.clock.advance(550);
 await Promise.resolve();
 assert.equal(settled,true);
 h.controller.finish();
 await done;
});

test('desktop room readiness cannot overwrite the native hidden state',()=>{
 const messages=[],registered={},props=new Map();
 const child={postMessage(packet){messages.push(packet.hidden)}};
 const frame={contentWindow:child,addEventListener(){},hasAttribute:k=>props.has(k),removeAttribute:k=>props.delete(k)};
 const section={setAttribute(){},append(){}};
 const win={addEventListener:(event,fn)=>registered[event]=fn};
 const doc={hidden:false,createElement:n=>n==='iframe'?frame:section,addEventListener:(event,fn)=>registered[event]=fn,
   body:{append(){},classList:{toggle(){}}}};
 vm.runInNewContext(read('../../web/pure-home-wrapper.js'),{window:win,document:doc,location:{origin:'test'}});
 win.PetDesktopHome.set({enabled:true});
 win.PetDesktopHome.visibility(true);
 registered.message({source:child,origin:'test',data:{t:'room-ready'}});
 assert.deepEqual(messages.slice(-2),[true,true]);
 win.PetDesktopHome.visibility(false);
 assert.equal(messages.at(-1),false);
});


test('a visible orchard refreshes at midnight in the town timezone',async()=>{
 const clock=scheduler();
 const base=Date.parse('2026-11-18T14:59:59.650Z');
 class TownDate extends Date {static now(){return base+clock.globals.performance.now();}}
 const code=read('yard-scene.mjs');
 const begin=code.indexOf('function scheduleOrchardRefresh(){');
 const end=code.indexOf("window.addEventListener('focus',refreshOrchard);",begin);
 assert.ok(begin>=0&&end>begin);
 const context=vm.createContext({...clock.globals,Date:TownDate,orchardRefreshTimer:null,
  orchardState:{today:'2026-11-18'},orchardIsVisible:()=>true,reads:0});
 vm.runInContext('function refreshOrchard(){reads++;orchardState.today="2026-11-19"}\n'+code.slice(begin,end)+'\nscheduleOrchardRefresh();',context);
 clock.advance(599);
 assert.equal(context.reads,0);
 clock.advance(1);
 await Promise.resolve();
 assert.equal(context.reads,1);
 assert.equal(context.orchardState.today,'2026-11-19');
 clock.advance(300000);
 assert.equal(context.reads,1);
});

