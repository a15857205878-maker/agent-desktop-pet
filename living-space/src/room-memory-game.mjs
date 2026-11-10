// Adapted from little-home/assets/games.js: six pairs, Fisher–Yates shuffle,
// 700ms mismatch lock. Explicit lifecycle added for the desktop-room host.
const PAIRS=[['leaf','绿叶','🌿'],['fish','小鱼','🐟'],['cloud','云朵','☁️'],['sunflower','向日葵','🌻'],['mushroom','蘑菇','🍄'],['cactus','仙人掌','🌵']];
export function createMemoryGame({clock={now:()=>performance.now(),setTimeout:(f,t)=>setTimeout(f,t),clearTimeout:id=>clearTimeout(id)},random=Math.random,onChange=()=>{},onFinish=()=>{}}={}){
 let phase='idle',cards=[],open=[],moves=0,matchedPairs=0,timer=null,due=0,remaining=0,elapsed=0,startedAt=0,round=0;
 const reasons=new Set();
 const running=()=>phase==='running'&&reasons.size===0;
 const clear=()=>{if(timer!==null)clock.clearTimeout(timer);timer=null;};
 const state=()=>({phase:phase==='running'&&reasons.size?'paused':phase,cards:cards.map(c=>({...c})),openCards:[...open],moves,matchedPairs,elapsedMs:Math.round(elapsed+(running()?clock.now()-startedAt:0)),remainingMismatchMs:timer!==null?Math.max(0,due-clock.now()):remaining,pauseReasons:[...reasons]});
 const notify=()=>{if(phase!=='disposed')onChange(state());};
 function resolve(){timer=null;for(const i of open)cards[i].revealed=false;open=[];remaining=0;notify();}
 function schedule(){if(remaining<=0||!running())return;const token=round;due=clock.now()+remaining;timer=clock.setTimeout(()=>{if(token===round&&running())resolve()},remaining);}
 function start(){if(phase==='disposed')return;clear();round++;reasons.delete('user');cards=PAIRS.flatMap(([key,label,glyph])=>[0,1].map(()=>({key,label,glyph,matched:false,revealed:false})));for(let i=cards.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}open=[];moves=0;matchedPairs=0;remaining=0;elapsed=0;startedAt=clock.now();phase='running';notify();}
 function flip(i){if(!running()||open.length===2||!Number.isInteger(i)||!cards[i]||cards[i].matched||cards[i].revealed)return;cards[i].revealed=true;open.push(i);if(open.length===2){moves++;const [a,b]=open;if(cards[a].key===cards[b].key){cards[a].matched=cards[b].matched=true;matchedPairs++;open=[];if(matchedPairs===6){elapsed+=clock.now()-startedAt;phase='won';notify();onFinish({gameId:'memory',moves,elapsedMs:Math.round(elapsed)});return;}}else{remaining=700;schedule();}}notify();}
 function pause(reason){if(phase==='disposed'||reasons.has(reason))return;const active=running();if(active){elapsed+=clock.now()-startedAt;if(timer!==null){remaining=Math.max(.01,due-clock.now());clear();}}reasons.add(reason);notify();}
 function resume(reason){if(phase==='disposed'||!reasons.delete(reason))return;if(running()){startedAt=clock.now();schedule();}notify();}
 function dispose(){if(phase==='disposed')return;clear();round++;phase='disposed';reasons.clear();}
 return {start,flip,pause,resume,getState:state,dispose};
}
