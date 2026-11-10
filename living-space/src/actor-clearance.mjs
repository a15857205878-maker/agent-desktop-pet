export function leastCoveredStand(candidates,items){
 let best=0,score=Infinity;
 candidates.forEach((c,i)=>{let area=0;for(const r of items)area+=Math.max(0,Math.min(c.right,r.right)-Math.max(c.left,r.left))*Math.max(0,Math.min(c.bottom,r.bottom)-Math.max(c.top,r.top));if(area<score){score=area;best=i}});
 return best;
}
