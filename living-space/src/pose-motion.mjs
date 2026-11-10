const clamp=p=>Math.max(0,Math.min(1,p));
const smooth=p=>p*p*(3-2*p);
export function motionFrame(seconds,pose,restWeight=pose==='rest'?1:0){
 const phase=seconds*2*Math.PI/5.2,weight=clamp(restWeight);
 return {y:0,stretch:1+Math.sin(phase)*(.0042-.0015*weight),rotation:Math.sin(phase*.5)*.0013};
}
export function transitionFrame(progress,transfer){
 const p=clamp(progress);
 return {progress:p,opacity:transfer?Math.abs(2*smooth(p)-1):1,swap:transfer&&p>=.5,blend:transfer?0:smooth(p)};
}
export function blinkFrame(seconds){
 const p=((seconds%7.3)+7.3)%7.3;
 if(p<6.8)return 0;
 if(p<6.94)return smooth((p-6.8)/.14);
 if(p<7.04)return 1;
 return 1-smooth((p-7.04)/.26);
}
export function chairFrame(seconds){
 const t=((seconds%18)+18)%18;
 if(t>=11.1&&t<11.65)return smooth((t-11.1)/.55);
 if(t>=11.65&&t<13.9)return 1;
 if(t>=13.9&&t<14.55)return 1-smooth((t-13.9)/.65);
 return t<8?blinkFrame(t):0;
}
export function demoPose(seconds){
 const t=((seconds%32)+32)%32;
 if(t<8)return 'back';if(t<11)return 'turn';if(t<15)return 'back';
 if(t<23)return 'relax';if(t<27)return 'rest';return 'relax';
}
