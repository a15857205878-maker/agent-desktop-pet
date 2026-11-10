export function createRoomScoreClient({host=window,timeoutMs=8000}={}){
 const native=host.parent!==host,pending=new Map();let closed=false,counter=0;
 function onMessage(e){
  if(e.source!==host.parent||e.origin!==host.location.origin||e.data?.t!=='room-game-response')return;
  const d=e.data,p=pending.get(d.requestId);if(!p)return;clearTimeout(p.timer);pending.delete(d.requestId);
  if(d.ok&&[1,2,3].includes(d.scores?.version)&&d.scores.memory)p.resolve({supported:true,scores:d.scores});else p.reject(Error(d.error||'本机成绩暂不可用'));
 }
 if(native)host.addEventListener('message',onMessage);
 function request(op,gameId,extra={}){
  if(closed)return Promise.reject(Error('Score client closed'));
  if(!native)return Promise.resolve({supported:false,scores:null});
  const requestId=`score_${Date.now().toString(36)}_${++counter}_${Math.random().toString(36).slice(2,10)}`;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('本机成绩服务暂未响应'))},timeoutMs);pending.set(requestId,{resolve,reject,timer});host.parent.postMessage({t:'room-game-request',requestId,op,gameId,...extra},host.location.origin);});
 }
 function dispose(){if(closed)return;closed=true;if(native)host.removeEventListener('message',onMessage);for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Score client closed'));}pending.clear();}
 return {load:(id='memory')=>request('load',id),recordResult:r=>request('record',r.gameId||'memory',{[['fish','snake'].includes(r.gameId)?'score':'moves']:['fish','snake'].includes(r.gameId)?r.score:r.moves,elapsedMs:r.elapsedMs}),pendingCount:()=>pending.size,dispose};
}
