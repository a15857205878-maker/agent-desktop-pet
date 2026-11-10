export const IDLE_MS=600000;
export function createLifeSchedule({clock=()=>Date.now(),random=()=>Math.random()}={}){
 let enabled=true,held=false,lastManual=-Infinity,nextAt=0,active=false;
 const sample=()=>Math.max(0,Math.min(.999999,Number(random())||0));
 return {configure(value){if(typeof value.enabled==='boolean')enabled=value.enabled;if(typeof value.held==='boolean')held=value.held;if(!enabled||held)active=false},cancel(){nextAt=0;active=false},touch(){lastManual=clock();nextAt=0;active=false},
  step({idleSeconds,ready,busy=false,hidden=false,scene='room',orchard=false}){
   const now=clock();if(!enabled||held||!ready||busy||hidden||!Number.isFinite(idleSeconds)||idleSeconds<600||now-lastManual<IDLE_MS){active=false;return null}
   if(now<nextAt)return null;
   const scenes=['room','home','plaza',...(orchard?['orchard']:[])].filter(x=>x!==scene),target=scenes[Math.floor(sample()*scenes.length)];
   const poses=target==='room'?['back','relax','rest']:['front','sit','back'];
   const pose=poses[Math.floor(sample()*poses.length)];nextAt=now+180000+Math.floor(sample()*300001);active=true;return {scene:target,pose};
  },state:()=>({enabled,held,active,nextAt,lastManual})};
}
