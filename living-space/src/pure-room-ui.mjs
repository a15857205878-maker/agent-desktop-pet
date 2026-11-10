import {createClickGesture} from './room-hotspots.mjs';
export function installRoomUI({canvas,onMask,onMenuChange=()=>{}}){
 const gesture=createClickGesture();
 const menu=document.getElementById('context-menu'),panel=document.getElementById('adjust-panel');
 const native=window.parent!==window;
 const send=action=>{if(native)parent.postMessage({t:'room-command',action},location.origin)};
 document.querySelectorAll('[data-native]').forEach(b=>{b.disabled=!native;b.addEventListener('click',()=>send(b.dataset.native));});
 const close=()=>{menu.hidden=true;onMenuChange(false);onMask();};
 function open(x,y){menu.hidden=false;onMenuChange(true);menu.style.left=Math.max(8,Math.min(x,innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(8,Math.min(y,innerHeight-menu.offsetHeight-8))+'px';menu.querySelector('button')?.focus();onMask();}
 document.addEventListener('contextmenu',e=>{e.preventDefault();open(e.clientX,e.clientY)});
 canvas.addEventListener('keydown',e=>{if(e.key==='ContextMenu'||e.key==='F10'&&e.shiftKey){e.preventDefault();open(innerWidth/2,innerHeight/2)}});
 document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target)&&!menu.hidden){gesture.block();close()}});
 menu.addEventListener('click',e=>{if(e.target.closest('button'))close()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();panel.hidden=true;onMask();canvas.focus();}if(!menu.hidden&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const buttons=[...menu.querySelectorAll('button:not(:disabled)')],i=buttons.indexOf(document.activeElement);buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();}});
 document.getElementById('adjust-toggle').addEventListener('click',()=>{panel.hidden=!panel.hidden;onMask()});
 document.getElementById('adjust-close').addEventListener('click',()=>{panel.hidden=true;onMask()});
 canvas.addEventListener('pointerdown',e=>{if(e.button===0)gesture.down(e.clientX,e.clientY)});
 canvas.addEventListener('pointermove',e=>{if(e.buttons===1&&gesture.move(e.clientX,e.clientY)&&native)send('drag')});
 canvas.addEventListener('pointerup',()=>gesture.up());canvas.addEventListener('pointercancel',()=>gesture.cancel());
 return {send,native,allowSceneClick:()=>gesture.allowClick()};
}
