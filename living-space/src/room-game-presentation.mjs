export function gamePresentation(s){
 const done=['won','ended'].includes(s.phase),paused=s.phase==='paused';
 const reasons=s.pauseReasons||[];
 const pauseMessage=reasons.includes('user')?'已暂停，点击「继续」接着玩。':reasons.includes('menu')?'菜单打开时暂停，关闭菜单后继续。':'窗口暂时离开，返回后自动继续。';
 return {done,phase:s.phase,badge:done?'本局完成':paused?'已暂停':s.phase==='idle'?'准备开始':'游玩中',start:s.phase==='idle'?'开始一局':done?'再玩一局':'重新开始',pauseMessage};
}

export function roundSummary(result, state) {
 if (result.gameId === 'memory') {
  return {title:'六对全部找齐', detail:`翻牌 ${result.moves} 次 · 用时 ${(result.elapsedMs / 1000).toFixed(1)} 秒`};
 }
 if (result.gameId === 'fish') {
  return {title:'时间到', detail:`本局捞到 ${result.score} 条小鱼`};
 }
 const titles = {won:'填满棋盘了', self:'碰到自己了', wall:'碰到墙了'};
 return {title:titles[state.endReason] || '本局结束', detail:`本局得分 ${result.score} · 长度 ${state.snake.length}`};
}
