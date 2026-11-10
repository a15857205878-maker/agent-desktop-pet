// Rules adapted from little-home/public/assets/snake.js; room owns timers and saves.
const directions={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}},same=(a,b)=>a.x===b.x&&a.y===b.y;
export function createSnakeGame({clock={now:()=>performance.now(),setTimeout:(f,t)=>setTimeout(f,t),clearTimeout:id=>clearTimeout(id)},random=Math.random,onChange=()=>{},onFinish=()=>{},columns=20,rows=20}={}){
 if(![columns,rows].every(n=>Number.isInteger(n)&&n>=4&&n<=80))throw Error('Invalid snake grid dimensions');
 const initialSnake=()=>[0,1,2].map(i=>({x:Math.floor(columns/2)-i,y:Math.floor(rows/2)}));
 const reasons=new Set();let phase='idle',snake=initialSnake(),food={x:Math.min(columns-1,Math.floor(columns/2)+4),y:Math.floor(rows/2)},direction='right',pending=null,score=0,timer=null,token=0,remaining=150,deadline=0,elapsed=0,startedAt=0,endReason=null;
 const active=()=>phase==='running'&&!reasons.size;
 const state=()=>({phase:phase==='running'&&reasons.size?'paused':phase,boardSize:rows,columns,rows,snake:snake.map(p=>({...p})),food:food?{...food}:null,direction,score,elapsedMs:Math.round(elapsed+(active()?clock.now()-startedAt:0)),pauseReasons:[...reasons],endReason});
 const notify=()=>{if(phase!=='disposed')onChange(state())},clear=()=>{if(timer!==null)clock.clearTimeout(timer);timer=null;};
 function chooseFood(){const empty=[];for(let y=0;y<rows;y++)for(let x=0;x<columns;x++)if(!snake.some(p=>p.x===x&&p.y===y))empty.push({x,y});return empty.length?empty[Math.floor(random()*empty.length)]:null;}
 function finish(reason){if(!active())return;elapsed+=clock.now()-startedAt;phase='ended';endReason=reason;clear();notify();onFinish({gameId:'snake',score,elapsedMs:Math.round(elapsed)});}
 function schedule(){if(!active())return;deadline=clock.now()+remaining;const round=token;timer=clock.setTimeout(()=>{timer=null;if(round!==token||!active())return;step();},remaining);}
 function step(){direction=pending||direction;pending=null;const d=directions[direction],head=snake[0],next={x:head.x+d.x,y:head.y+d.y};if(next.x<0||next.x>=columns||next.y<0||next.y>=rows){finish('wall');return;}const eat=food&&same(next,food),body=eat?snake:snake.slice(0,-1);if(body.some(p=>same(next,p))){finish('self');return;}snake.unshift(next);if(eat){score++;food=chooseFood();if(!food){finish('won');return;}}else snake.pop();remaining=150;notify();schedule();}
 function start(){if(phase==='disposed')return;clear();token++;reasons.delete('user');snake=initialSnake();direction='right';pending=null;score=0;remaining=150;elapsed=0;endReason=null;phase='running';startedAt=clock.now();food=chooseFood();notify();schedule();}
 function turn(name){if(!active()||pending||!directions[name])return;const a=directions[direction],b=directions[name];if(name===direction||a.x+b.x===0&&a.y+b.y===0)return;pending=name;}
 function pause(reason){if(phase==='disposed'||reasons.has(reason))return;if(active()){remaining=Math.max(0,deadline-clock.now());elapsed+=clock.now()-startedAt;clear();}reasons.add(reason);notify();}
 function resume(reason){if(phase==='disposed'||!reasons.delete(reason))return;if(active()){startedAt=clock.now();schedule();}notify();}
 function dispose(){if(phase==='disposed')return;clear();token++;phase='disposed';reasons.clear();}
 return {start,turn,pause,resume,getState:state,dispose};
}
