// Raycaster also returns invisible meshes; replaced room geometry stays loaded
// for restoration, but must not intercept device or furniture input.
export function visibleSceneHits(hits){return hits.filter(hit=>{for(let o=hit.object;o;o=o.parent)if(o.visible===false)return false;return true;});}
