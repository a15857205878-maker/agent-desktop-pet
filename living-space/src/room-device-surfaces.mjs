export function gameDevice(id,requested){return id==='snake'?'handheld':id==='computer'||id==='fish'?'monitor':id==='memory'&&requested==='phone'?'phone':'table';}
export function wrapDevice(content,device){
 if(device==='monitor')return `<div class="monitor-display" data-room-surface>${content}</div><div class="monitor-stem" data-room-surface aria-hidden="true"></div><div class="monitor-base" data-room-surface aria-hidden="true"></div>`;
 if(device==='phone')return `<div class="phone-screen"><div class="phone-camera" aria-hidden="true"></div>${content}<div class="phone-home" aria-hidden="true"></div></div>`;
 return content;
}
