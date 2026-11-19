/* Time-based pose handoff shared by the native dragon controller and its tests. */
((root,factory)=>{
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.PetDragonMotion=api;
})(typeof window==='object'?window:globalThis,()=>{
  'use strict';
  const finite=value=>Number.isFinite(value)?value:0;
  const smoother=x=>x*x*x*(x*(x*6-15)+10);
  class PoseTransition {
    constructor(){this.last=null;this.from=null;this.elapsed=0;this.duration=0;}
    remember(pose){this.last={...pose};}
    begin(duration=280){
      this.from=this.last?{...this.last}:null;
      this.elapsed=0;this.duration=Math.max(0,finite(duration));
    }
    reset(){this.from=null;this.elapsed=0;this.duration=0;}
    sample(target,dt){
      const result={...target};
      if(this.from&&this.duration>0){
        this.elapsed=Math.min(this.duration,this.elapsed+Math.max(0,finite(dt)));
        const weight=smoother(this.elapsed/this.duration);
        for(const id of Object.keys(target))if(Number.isFinite(this.from[id])&&Number.isFinite(target[id])){
          result[id]=this.from[id]+(target[id]-this.from[id])*weight;
        }
        if(this.elapsed>=this.duration)this.from=null;
      }
      this.remember(result);return result;
    }
  }
  const follow=(current,target,dt)=>current+(target-current)*(1-Math.exp(-Math.max(0,finite(dt))/84));
  // Per-expression accents in seconds. No SDK parameters or clocks are mutated here.
  const EMOTION_NEUTRAL=Object.freeze({headX:0,headY:0,headZ:0,headGain:1,gazeX:0,gazeY:0,browL:0,browR:0,open:0,width:0,cheek:0,corner:0,eyeLAdd:0,eyeLCap:1,eyeRCap:1,tongueHeight:0,tongueWidth:0,angryBrow:0,angryMouth:0,sadBrow:0,sadMouth:0});
  // period, head xyz, gaze xy, idle-head gain. Large deliberate actions stay native.
  const profiles={
   idle:[9,.4,.3,.25,.04,.02,1],
   thinking:[8,2.2,1.2,1.0,.2,.1,.8],
   working:[6.8,.65,1.25,.6,.04,.02,1],
   waiting:[7,1.1,.85,.6,.13,.1,.85],
   review:[8.5,1.6,.65,.4,.18,.03,.7],
   syncing:[7.5,.7,.65,.85,.1,.04,.75],
   blocked:[8,.45,.5,.5,.04,0,.55],
   error:[9,.4,.55,.6,.06,.05,.45],
   done:[6.5,.8,1.15,.8,.03,.03,1],
   interrupted:[10,.35,.4,.55,.04,.03,.35],
   blush:[8.7,1.5,.6,1.25,.15,.04,.65],
   star:[6.2,.7,1.3,.7,.04,.05,1],
   playful:[7,1.1,.7,1.5,.09,.04,.9],
   tongue:[7.8,1.05,.65,1.1,.1,.03,.85],
   heartbeat:[6.6,.7,.9,.8,.06,.04,.9],
   round:[9.2,1.4,.55,.4,.2,.04,.7],
   gloom:[11,.25,.3,.3,.025,.02,.2]
  };
  const EMOTION_IDS=Object.freeze(Object.keys(profiles));
  const unit=x=>Math.max(0,Math.min(1,x));
  const ease=x=>{x=unit(x);return x*x*(3-2*x);};
  function sampleEmotion(id,seconds){
   const p=profiles[id];if(!p)return {...EMOTION_NEUTRAL};
   const t=Math.max(0,finite(seconds))%p[0],w=2*Math.PI*t/p[0];
   const bump=(a,b)=>t<=a||t>=b?0:Math.sin(Math.PI*(t-a)/(b-a))**2;
   const q={...EMOTION_NEUTRAL,headX:p[1]*Math.sin(w),headY:p[2]*Math.sin(w*2),headZ:p[3]*Math.sin(w),headGain:p[6],gazeX:p[4]*Math.sin(w),gazeY:p[5]*Math.sin(w*2)};
   const soft=bump(.7,3.1),late=bump(3.8,5.5);
   if(['working','done','star'].includes(id)){q.open=-.1*soft-.055*late;q.cheek=.05*soft;q.corner=.025*soft;}
   if(id==='thinking'){q.browL=.065*soft;q.browR=.025*soft;q.gazeY+=.05*soft;q.gazeX=.16*bump(.6,3)-.06*bump(4.2,6.2);}
   if(['review','round'].includes(id)){q.browL=.035*soft;q.browR=.02*late;q.gazeY-=.04*soft;q.gazeX=.16*(bump(.6,2.6)-bump(4.1,6.1));}
   if(id==='waiting'){const startle=bump(.1,1.3);q.open=.17*startle-.08*soft;q.browL=.12*startle+.05*soft;q.browR=.11*startle+.055*soft;q.headY+=.65*startle;q.eyeLCap=q.eyeRCap=1-.95*(bump(3.1,3.5)+bump(3.7,4));}
   if(id==='syncing'){q.open=.035*soft;q.browL=.05*soft;q.browR=.035*soft;}
   if(id==='blocked'){q.headX+=1.1*Math.sin((t-2)*Math.PI*2)*bump(2,3.6);q.browL=q.browR=-.035*soft;q.angryBrow=.65*soft+.2*late;q.angryMouth=.5*soft+.2*late;}
   if(id==='error'){q.headX*=.75;q.open=.04*soft+.012*Math.sin(t*Math.PI*3)*late;q.browL=.045*soft;q.browR=.035*soft;q.eyeLCap=q.eyeRCap=1-.85*bump(4.2,4.65);}
   if(id==='interrupted'){q.gazeY-=.1*soft;q.headY-=.55*soft;q.sadBrow=.55*soft+.2*late;q.sadMouth=.3*soft+.07*Math.sin(t*Math.PI*3.6)*late;q.eyeLCap=q.eyeRCap=1-.9*bump(5.2,5.85);}
   if(id==='blush'){q.gazeY-=.065*soft;q.cheek=.045*soft;q.corner=.025*late;q.eyeLCap=q.eyeRCap=1-.9*bump(4.8,5.3);}
   if(id==='playful'){q.eyeLAdd=ease((t-.85)/.3)*(1-ease((t-5.6)/.3));q.corner=.035*soft;}
   if(id==='tongue'){q.tongueHeight=.07*soft;q.tongueWidth=.05*soft;q.browL=.025*soft;}
   if(id==='heartbeat'){const beat=bump(1.1,1.65)+.65*bump(1.9,2.4);q.cheek=.065*beat;q.open=-.05*beat;q.headY+=.35*beat;}
   if(id==='gloom'){q.gazeY-=.055*soft;q.eyeLCap=q.eyeRCap=1-.9*bump(6.2,7);}
   return q;
  }
  return {PoseTransition,follow,sampleEmotion,EMOTION_IDS,EMOTION_NEUTRAL};
});
