import {STUDY_LAYOUT} from './reference-room-layout.mjs';
// World-space bounds of furniture surfaces in the mirrored room.
const box=b=>[b.min[0],b.max[0],b.min[1],b.max[1],b.min[2],b.max[2]];
const bounds=[['bookshelf',box(STUDY_LAYOUT.bookshelf.bounds)],['table',box(STUDY_LAYOUT.sideTable.bounds)],['chair',box(STUDY_LAYOUT.chairBounds)],['computer',[-1.3,.55,.86,2.15,-1.95,-.8]]];
export function furnitureAt(p){return bounds.find(([,b])=>p.x>=b[0]&&p.x<=b[1]&&p.y>=b[2]&&p.y<=b[3]&&p.z>=b[4]&&p.z<=b[5])?.[0]??null;}
export function furnitureForHit(hit){
 const tag=hit.object?.userData?.roomSpot;
 return bounds.some(([kind])=>kind===tag)?tag:furnitureAt(hit.point);
}
export function createClickGesture(){
 let start=null,blocked=false;
 return {down(x,y){start={x,y};blocked=false},move(x,y){const crossed=!!start&&!blocked&&Math.hypot(x-start.x,y-start.y)>6;if(crossed)blocked=true;return crossed},up(){start=null},cancel(){start=null;blocked=true},block(){blocked=true},allowClick(){return !blocked}};
}
