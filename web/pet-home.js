window.PetDesktopHome=(()=>{
 let enabled=false,root=null,frame=null;
 const send=action=>window.chrome?.webview?.postMessage({t:'home-action',action});
 function make(){if(root)return;root=document.createElement('section');root.id='desktop-home';root.hidden=true;root.setAttribute('aria-label','龙娘的桌面小屋');frame=document.createElement('iframe');frame.title='龙娘的三维小屋';root.append(frame);document.body.append(root);
  window.addEventListener('message',e=>{if(!enabled||e.source!==frame.contentWindow||e.origin!==location.origin||!e.data)return;const d=e.data;if(d.t==='room-command'&&['close','drag','menu','pat','quit'].includes(d.action))send(d.action);else if(d.t==='room-workstation-request')window.chrome?.webview?.postMessage({...d,t:'home-workstation'});else if(d.t==='room-game-request')window.chrome?.webview?.postMessage({...d,t:'home-game'});else if(d.t==='room-mask')window.chrome?.webview?.postMessage({...d,t:'home-mask'});else if(d.t==='room-life-report')window.chrome?.webview?.postMessage({...d,t:'home-life-report'});else if(d.t==='room-life-config')window.chrome?.webview?.postMessage({...d,t:'home-life-config'});else if(d.t==='room-ready')visibility(document.hidden);});
  frame.addEventListener('error',()=>{if(enabled)send('asset-error')});
 }
 function visibility(hidden){if(enabled&&frame?.contentWindow)frame.contentWindow.postMessage({t:'room-visibility',hidden:!!hidden},location.origin)}
 function set(value){make();const next=!!value?.enabled;enabled=next;root.hidden=!enabled;document.body.classList.toggle('desktop-home-mode',enabled);if(enabled){if(!frame.hasAttribute('src'))frame.src='home/room3d.html';}else frame.removeAttribute('src');}
 function gameRecords(value){if(enabled&&frame?.contentWindow)frame.contentWindow.postMessage({...value,t:'room-game-response'},location.origin)}
 function workstationResponse(value){if(enabled&&frame?.contentWindow)frame.contentWindow.postMessage({...value,t:'room-workstation-response'},location.origin)}
 function lifeState(value){if(enabled&&frame?.contentWindow)frame.contentWindow.postMessage({...value,t:'room-life-state'},location.origin)}
 return {lifeState,workstationResponse,active:()=>enabled,position:()=>null,set,visibility,gameRecords};
})();
