// World-space bounds of furniture surfaces in the mirrored room.
const bounds=[['bookshelf',[1.2,1.97,.25,1.72,-1.6,.4]],['table',[-.11,.61,.35,1.04,1.26,1.98]],['chair',[.42,1.5,.3,1.05,.78,1.88]],['computer',[-1.3,.48,.86,2.15,-1.95,-.45]]];
export function furnitureAt(p){return bounds.find(([,b])=>p.x>=b[0]&&p.x<=b[1]&&p.y>=b[2]&&p.y<=b[3]&&p.z>=b[4]&&p.z<=b[5])?.[0]??null;}
export function createClickGesture(){
 let start=null,blocked=false;
 return {down(x,y){start={x,y};blocked=false},move(x,y){const crossed=!!start&&!blocked&&Math.hypot(x-start.x,y-start.y)>6;if(crossed)blocked=true;return crossed},up(){start=null},cancel(){start=null;blocked=true},block(){blocked=true},allowClick(){return !blocked}};
}
