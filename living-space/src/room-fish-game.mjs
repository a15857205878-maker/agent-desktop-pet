// Reuses little-home's 9 cells, one moving target and 15s active-time rounds.
export function createFishGame({clock={now:()=>performance.now(),setTimeout:(f,t)=>setTimeout(f,t),clearTimeout:id=>clearTimeout(id)},random=Math.random,onChange=()=>{},onFinish=()=>{}}={}){
 let phase='idle',remaining=15000,deadline=0,score=0,target=-1,timer=null,round=0,lastHit=null;const reasons=new Set();
 const active=()=>phase==='running'&&!reasons.size,clear=()=>{if(timer!==null)clock.clearTimeout(timer);timer=null;};
 const state=()=>({phase:phase==='running'&&reasons.size?'paused':phase,score,targetIndex:target,remainingMs:active()?Math.max(0,deadline-clock.now()):remaining,pauseReasons:[...reasons],lastHit});
 const notify=()=>{if(phase!=='disposed')onChange(state());};
 function place(){const choices=Array.from({length:9},(_,i)=>i).filter(i=>i!==target);target=choices[Math.floor(random()*choices.length)];}
 function finish(){if(phase!=='running')return;clear();phase='ended';remaining=0;target=-1;notify();onFinish({gameId:'fish',score,elapsedMs:15000});}
 function schedule(){if(!active())return;const token=round;timer=clock.setTimeout(()=>{timer=null;if(token!==round||!active())return;remaining=Math.max(0,deadline-clock.now());if(!remaining){finish();return;}notify();schedule();},Math.min(100,remaining));}
 function start(){if(phase==='disposed')return;clear();round++;reasons.delete('user');score=0;remaining=15000;deadline=clock.now()+remaining;phase='running';target=-1;lastHit=null;place();notify();schedule();}
 function hit(index){if(!active())return;remaining=Math.max(0,deadline-clock.now());if(!remaining){finish();return;}if(!Number.isInteger(index)||index<0||index>8)return;if(index===target){score++;lastHit='hit';place();}else lastHit='miss';notify();}
 function pause(reason){if(phase==='disposed'||reasons.has(reason))return;if(active()){remaining=Math.max(0,deadline-clock.now());if(!remaining){finish();return;}clear();}reasons.add(reason);notify();}
 function resume(reason){if(phase==='disposed'||!reasons.delete(reason))return;if(active()){deadline=clock.now()+remaining;schedule();}notify();}
 function dispose(){if(phase==='disposed')return;clear();round++;phase='disposed';reasons.clear();}
 return {start,hit,pause,resume,getState:state,dispose};
}
