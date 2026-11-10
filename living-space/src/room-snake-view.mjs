export function snakeGridLayout(width,height,s){
 const columns=s.columns||s.boardSize,rows=s.rows||s.boardSize,unit=Math.min(width/columns,height/rows);
 return {columns,rows,unit,x:(width-columns*unit)/2,y:(height-rows*unit)/2};
}
export function renderSnake(canvas,s){
 const rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2),width=Math.max(1,Math.round(rect.width*ratio)),height=Math.max(1,Math.round(rect.height*ratio));if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
 const c=canvas.getContext('2d'),grid=snakeGridLayout(width,height,s),ux=grid.unit,uy=grid.unit,unit=grid.unit;c.clearRect(0,0,width,height);c.fillStyle='#edf0f5';c.fillRect(0,0,width,height);c.save();c.translate(grid.x,grid.y);c.strokeStyle='#d5dbe5';c.lineWidth=ratio;c.beginPath();for(let i=1;i<grid.columns;i++){c.moveTo(i*unit,0);c.lineTo(i*unit,grid.rows*unit)}for(let i=1;i<grid.rows;i++){c.moveTo(0,i*unit);c.lineTo(grid.columns*unit,i*unit)}c.stroke();
 if(s.food){c.fillStyle='#df9250';c.beginPath();c.arc((s.food.x+.5)*ux,(s.food.y+.5)*uy,unit*.32,0,Math.PI*2);c.fill();}
 s.snake.forEach((p,i)=>{c.fillStyle=i?'#7c89c2':'#485990';c.beginPath();c.roundRect((p.x+.08)*ux,(p.y+.08)*uy,ux*.84,uy*.84,unit*.2);c.fill();});
 if(s.snake.length){const h=s.snake[0],d={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[s.direction];for(const side of [-1,1]){const x=(h.x+.5+d[0]*.18-d[1]*side*.2)*ux,y=(h.y+.5+d[1]*.18+d[0]*side*.2)*uy;c.fillStyle='#fffdfb';c.beginPath();c.arc(x,y,unit*.11,0,Math.PI*2);c.fill();c.fillStyle='#252c46';c.beginPath();c.arc(x+d[0]*ratio,y+d[1]*ratio,unit*.045,0,Math.PI*2);c.fill();}}
 c.restore();
 canvas.setAttribute('aria-label',`贪吃蛇棋盘，得分${s.score}，${s.phase==='paused'?'已暂停':s.phase==='ended'?'已结束':s.phase==='idle'?'待开始':'进行中'}`);
}
