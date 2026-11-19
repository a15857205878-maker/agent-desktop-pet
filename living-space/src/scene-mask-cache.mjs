// Keep one scene raster. DOM overlay motion must not force another GPU readback.
export function createSceneMaskCache(capture){
 let key=null,value=null,captures=0;
 return{read(next){if(value&&next===key)return value;const fresh=capture();if(!fresh)return null;value=fresh;key=next;captures++;return value},clear(){key=null;value=null},getState:()=>({captures,cached:!!value})};
}
