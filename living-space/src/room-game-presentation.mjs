export function gamePresentation(s){
 const done=['won','ended'].includes(s.phase),paused=s.phase==='paused';
 const reasons=s.pauseReasons||[];
 const pauseMessage=reasons.includes('user')?'已暂停，点击「继续」接着玩。':reasons.includes('menu')?'菜单打开时暂停，关闭菜单后继续。':'窗口暂时离开，返回后自动继续。';
 return {done,phase:s.phase,badge:done?'本局完成':paused?'已暂停':s.phase==='idle'?'准备开始':'游玩中',start:s.phase==='idle'?'开始一局':done?'再玩一局':'重新开始',pauseMessage};
}
