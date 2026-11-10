import {computerAppsMarkup} from './computer-apps.mjs';
import {createRoomCompanion} from './room-companion.mjs';
import {gameDevice,wrapDevice} from './room-device-surfaces.mjs';
import {createRoomScoreClient} from './room-score-client.mjs';
import {createMemoryGame} from './room-memory-game.mjs';
import {createFishGame} from './room-fish-game.mjs';
import {createSnakeGame} from './room-snake-game.mjs';
import {renderSnake} from './room-snake-view.mjs';
import {snakeHandheldMarkup} from './snake-handheld-ui.mjs';
import {gamePresentation} from './room-game-presentation.mjs';
export function createRoomActivities({onSurfaceChanged,onOpen,onClose,onWork=()=>{},onNavigate=()=>{}}){
 const panel=document.createElement('section');panel.id='room-game';panel.hidden=true;panel.setAttribute('role','dialog');document.body.append(panel);
 const scores=createRoomScoreClient(),adjust=document.getElementById('adjust-panel'),adjustToggle=document.getElementById('adjust-toggle'),reasons=new Set();let game=null,opened=false,activeId=null,scoreVersion=0,lastResult=null;const companion=createRoomCompanion();let companionHints=true;
 function showScores(promise,text){
  const version=++scoreVersion,footer=panel.querySelector('small');footer.textContent=activeId==='snake'?'读取成绩…':text;
  promise.then(r=>{if(!game||version!==scoreVersion)return;if(!r.supported){footer.textContent=activeId==='snake'?'本局成绩':'独立预览仅显示本局成绩';return;}const s=r.scores[activeId];footer.textContent=s.plays?(activeId!=='memory'?`已完成 ${s.plays} 局 · 最高 ${s.bestScore} 分`:`已完成 ${s.plays} 局 · 最佳 ${s.bestMoves} 次 · 最快 ${(s.bestTimeMs/1000).toFixed(1)} 秒`):(activeId==='snake'?'暂无纪录':'本机尚无完成记录，完成后自动保存');}).catch(()=>{if(game&&version===scoreVersion)footer.textContent='本机成绩暂不可用，本局仍可游玩';});
 }
 function key(e){
  if(activeId!=='snake'||game?.getState().phase!=='running'||e.defaultPrevented||e.isComposing||e.repeat||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||!panel.contains(document.activeElement)||e.target.closest('input,textarea,select,[contenteditable=true]'))return;
  const d={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',W:'up',a:'left',A:'left',s:'down',S:'down',d:'right',D:'right'}[e.key];if(d){e.preventDefault();game.turn(d);}
 }
 function render(s){
  const line=panel.querySelector('.game-companion'),text=companion.update(activeId,s);if(line&&line.textContent!==text)line.textContent=text;

  const presentation=gamePresentation(s);panel.dataset.phase=s.phase;panel.querySelector('.game-badge').textContent=presentation.badge;

  if(activeId==='snake'){
   renderSnake(panel.querySelector('.snake-board'),s);panel.querySelector('.game-stats').textContent=`得分 ${s.score} · 长度 ${s.snake.length||3}`;
   const start=panel.querySelector('[data-game-action=start]');start.textContent=s.phase==='idle'?'▶':'↻';start.setAttribute('aria-label',presentation.start);start.title=presentation.start;
   const b=panel.querySelector('[data-game-action=pause]'),resume=s.pauseReasons.includes('user');b.disabled=!['running','paused'].includes(s.phase);b.textContent=resume?'▶':'Ⅱ';b.setAttribute('aria-label',resume?'继续':'暂停');b.title=resume?'继续':'暂停';
   for(const b of panel.querySelectorAll('[data-snake-dir]'))b.disabled=s.phase!=='running';
   panel.querySelector('.game-message').textContent=s.phase==='idle'?'方向键 / WASD 或手柄方向按钮控制，吃果子长大。':s.phase==='paused'?presentation.pauseMessage:s.phase==='ended'?(s.endReason==='won'?'填满棋盘了！':s.endReason==='self'?'碰到自己了。':'碰到墙了。')+` 本局得分 ${s.score}。`:'不能直接反向；每一步只能转一次弯。';return;
  }
  const fish=activeId==='fish',grid=panel.querySelector('.game-grid');
  panel.querySelector('.game-stats').textContent=fish?`得分 ${s.score}　·　剩余 ${(s.remainingMs/1000).toFixed(1)} 秒`:`已配对 ${s.matchedPairs} / 6　·　翻牌 ${s.moves} 次`;
  const count=fish?9:s.phase==='idle'?12:s.cards.length;
  if(grid.children.length!==count)grid.replaceChildren(...Array.from({length:count},(_,i)=>{const b=document.createElement('button');b.dataset[fish?'cell':'card']=String(i);b.className=fish?'fish-cell':'game-card';return b;}));
  [...grid.children].forEach((b,i)=>{if(fish){const target=i===s.targetIndex;b.textContent=target?'🐟':'·';b.dataset.target=String(target);b.setAttribute('aria-label',`第${i+1}格，${target?'小鱼':'空位'}`);b.disabled=s.phase!=='running';}else{const c=s.cards[i]||{revealed:false,matched:false},up=c.revealed||c.matched;b.dataset.revealed=String(up);b.textContent=up?c.glyph:'✦';b.dataset.matched=String(c.matched);b.setAttribute('aria-label',`第${i+1}张牌，${up?c.label:'未翻开'}${c.matched?'，已配对':''}`);b.disabled=s.phase!=='running'||up||s.openCards.length===2;}});
  const start=panel.querySelector('[data-game-action=start]'),pause=panel.querySelector('[data-game-action=pause]');start.textContent=presentation.start;pause.disabled=!['running','paused'].includes(s.phase);pause.textContent=s.pauseReasons.includes('user')?'继续':'暂停';
  panel.querySelector('.game-message').textContent=s.phase==='paused'?presentation.pauseMessage:s.phase==='idle'?(fish?'15秒内点击小鱼，空位不加分。':'准备好后开始，翻开两张牌进行配对。'):fish?(s.phase==='ended'?`时间到！本局得分 ${s.score}。`:s.lastHit==='miss'?'这是空位，找到小鱼再试试。':'点击小鱼得分，小鱼会换一个位置。'):s.phase==='won'?`全部配对！用了 ${s.moves} 次，${(s.elapsedMs/1000).toFixed(1)} 秒。`:s.openCards.length===2?'这两张不同，记住后再试一次。':'慢慢来，找出相同的两张。';
 }
 function showGame(id,requested){
  companion.reset();
  panel.removeEventListener('keydown',key);activeId=id;panel.dataset.game=id;panel.dataset.device=gameDevice(id,requested);lastResult=null;scoreVersion++;game?.dispose();game=null;const fish=id==='fish';panel.setAttribute('aria-label',fish?'电脑点点乐':'茶几翻翻乐');
  panel.innerHTML=`<div class="game-heading"><strong>${fish?'电脑 · 摸鱼点点乐':'茶几 · 翻翻乐'}</strong><span>${fish?'点中小鱼，休息十五秒':'找出六对相同的图案'}</span></div><div class="game-stats"></div><div class="game-grid${fish?' fish-grid':''}" aria-label="${fish?'点点乐九宫格':'记忆卡牌'}"></div><p class="game-message" role="status"></p><div class="game-actions"><button data-game-action="start">开始一局</button><button data-game-action="pause" disabled>暂停</button><button data-game-action="close">结束本局，返回小屋</button></div><small></small>`;
  if(id==='snake'){
   panel.setAttribute('aria-label','红蓝掌机贪吃蛇');panel.innerHTML=snakeHandheldMarkup();panel.addEventListener('keydown',key);
  }
  if(panel.dataset.device==='phone'){panel.setAttribute('aria-label','手机翻翻乐');panel.querySelector('.game-heading strong').textContent='手机 · 翻翻乐';}
  panel.innerHTML=wrapDevice(panel.innerHTML,panel.dataset.device);
  panel.querySelector('.game-message').insertAdjacentHTML('afterend','<p class="game-companion" role="status" aria-live="polite"></p>');panel.querySelector('.game-companion').hidden=!companionHints;
  game=(id==='snake'?createSnakeGame:fish?createFishGame:createMemoryGame)({... (id==='snake'?{columns:32,rows:20}:{}),onChange:render,onFinish:r=>{lastResult=r;panel.removeEventListener('keydown',key);showScores(scores.recordResult(r),'本局成绩保存中…');}});
  panel.querySelector('.game-heading').insertAdjacentHTML('beforeend','<b class="game-badge"></b>');
  if(document.hidden)reasons.add('hidden');if(!document.hasFocus())reasons.add('focus');for(const reason of reasons)game.pause(reason);
  render(game.getState());showScores(scores.load(id),'正在读取本机成绩…');panel.querySelector('[data-game-action=start]').focus();onSurfaceChanged();
 }
 function open(id='memory',{device}={}){
  if(opened){panel.focus();return;}opened=true;adjust.hidden=true;adjustToggle.disabled=true;panel.hidden=false;onOpen();
  if(id==='computer'){panel.dataset.device='monitor';panel.dataset.game='computer';activeId='computer';panel.dataset.phase='choosing';panel.setAttribute('aria-label','电脑活动');panel.innerHTML=computerAppsMarkup();panel.innerHTML=wrapDevice(panel.innerHTML,'monitor');panel.querySelector('button').focus();onSurfaceChanged();}else showGame(id,device);
 }
 function close(){if(!opened)return;panel.removeEventListener('keydown',key);game?.dispose();game=null;opened=false;activeId=null;scoreVersion++;reasons.delete('user');panel.hidden=true;adjustToggle.disabled=false;const result=lastResult;lastResult=null;onClose(result);onSurfaceChanged();document.querySelector('canvas').focus();}
 function pause(reason){reasons.add(reason);game?.pause(reason)}function resume(reason){reasons.delete(reason);game?.resume(reason)}
 function click(e){const b=e.target.closest('button');if(!b||!opened)return;const a=b.dataset.gameAction;if(a==='close'){close();return;}if(a==='work'){close();onWork();return;}if(a==='focus'||a==='reading'){close();onWork();onNavigate(a==='focus'?'town':'reading');return;}if(a==='phone'){showGame('memory','phone');return;}if(a==='fish'||a==='snake'){showGame(a);return;}if(!game)return;if(b.dataset.snakeDir){game.turn(b.dataset.snakeDir);panel.querySelector('.snake-board').focus({preventScroll:true});}else if(b.dataset.card!==undefined)game.flip(Number(b.dataset.card));else if(b.dataset.cell!==undefined)game.hit(Number(b.dataset.cell));else if(a==='start'){reasons.delete('user');lastResult=null;companion.reset();game.start();if(activeId==='snake'){panel.addEventListener('keydown',key);panel.querySelector('.snake-board').focus({preventScroll:true});}}else if(a==='pause')game.getState().pauseReasons.includes('user')?resume('user'):pause('user');}
 panel.addEventListener('click',click);const visibility=()=>document.hidden?pause('hidden'):resume('hidden'),blur=()=>pause('focus'),focus=()=>resume('focus'),resize=()=>{if(opened){if(activeId==='snake'&&game)renderSnake(panel.querySelector('.snake-board'),game.getState());onSurfaceChanged()}};
 document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',blur);window.addEventListener('focus',focus);window.addEventListener('resize',resize);const observer=new ResizeObserver(resize);observer.observe(panel);
 function dispose(){close();scores.dispose();observer.disconnect();panel.removeEventListener('click',click);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',blur);window.removeEventListener('focus',focus);window.removeEventListener('resize',resize);}
 function setCompanionHints(value){companionHints=!!value;const line=panel.querySelector('.game-companion');if(line)line.hidden=!companionHints;}
 return {setCompanionHints,companionHints:()=>companionHints,open,close,pause,resume,active:()=>opened,getState:()=>game?{...game.getState(),gameId:activeId}:opened?{phase:'choosing',gameId:activeId}:null,dispose};
}
