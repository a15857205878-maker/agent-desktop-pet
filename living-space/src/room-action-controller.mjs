import {sampleHeadTurn,sampleNap,NapScheduler} from './dragon-action-sampling.mjs';
export function createRoomActionController(){
 const nap=new NapScheduler();let head=null,headBack=null,waking=null,blinkMs=0;
 const resetNap=()=>{nap.update(0,[{type:'pose_select'}]);waking=null;blinkMs=0;};
 function selectPose(){head=null;headBack=null;resetNap();}
 function startHead(){selectPose();head=0;}
 function returnHead(){const from=head!==null?sampleHeadTurn(head).turnWeight:headBack?.weight??0;head=null;headBack={from,elapsed:0,weight:from};}
 function wake(){const from=nap.state==='napping'?sampleNap(nap.napElapsedMs).eyeCloseWeight:0;resetNap();if(from>0)waking={from,elapsed:0};}
 function step(dt,c){
  const frozen=!c.motionEnabled||c.gameActive||c.hidden||c.menuOpen;
  const elapsed=frozen?0:Math.max(0,dt);let headWeight=null,headFinished=false,eyeWeight=null;
  if(head!==null){head+=elapsed;const h=sampleHeadTurn(head);headWeight=h.turnWeight;if(h.done){head=null;headFinished=true;}}
  if(headBack){headBack.elapsed+=elapsed;const t=Math.min(1,headBack.elapsed/300);headBack.weight=headBack.from*(1-t*t*(3-2*t));headWeight=headBack.weight;if(t===1){headBack=null;headFinished=true;}}
  if(!frozen){
   if(c.pose!=='relax'||c.demoEnabled||c.transitioning)resetNap();
   else if(waking){waking.elapsed+=elapsed;const t=Math.min(1,waking.elapsed/300);eyeWeight=waking.from*(1-t*t*(3-2*t));if(t===1)waking=null;}
   else {nap.isGameActive=false;nap.isHidden=false;nap.update(elapsed);if(nap.state==='napping')blinkMs=0;else blinkMs+=elapsed;}
  }
  if(eyeWeight===null&&waking){const t=Math.min(1,waking.elapsed/300);eyeWeight=waking.from*(1-t*t*(3-2*t));}
  if(eyeWeight===null&&nap.state==='napping')eyeWeight=sampleNap(nap.napElapsedMs).eyeCloseWeight;
  return {headWeight,headFinished,eyeWeight};
 }
 return {selectPose,startHead,returnHead,wake,step,isHeadTurning:()=>head!==null||headBack!==null,isNapping:()=>nap.state==='napping',getState:()=>({headElapsedMs:head,returningHead:!!headBack,nap:nap.state,idleMs:nap.idleMs,napElapsedMs:nap.napElapsedMs,waking:!!waking,blinkMs})};
}
