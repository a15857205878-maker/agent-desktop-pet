import {createCottageSurfaceTexture} from './cottage-surface-textures.mjs';

// Scoped to the interior: derive quieter micro-relief from the existing CC0
// channels. The shared source bytes, outdoor maps and grain direction stay intact.
export function createRoomSoftSurfaceTexture(key){
 const match=/^(wood|plaster|linen)(?:-(height|roughness))?$/.exec(key);
 if(!match)return null;
 const t=createCottageSurfaceTexture(key),[,kind,channel='color']=match;
 const bytes=t.image.data;let mean=0;
 for(let i=0;i<bytes.length;i+=4)mean+=bytes[i];mean/=bytes.length/4;
 const contrast=channel==='height'?{wood:.72,plaster:.48,linen:.42}[kind]:channel==='color'?{wood:.8,plaster:.65,linen:.6}[kind]:.75;
 const center=channel==='height'?128:mean;
 for(let i=0;i<bytes.length;i+=4){const v=Math.max(0,Math.min(255,Math.round(center+(bytes[i]-mean)*contrast)));bytes[i]=bytes[i+1]=bytes[i+2]=v;}
 const repeat=kind==='linen'?2.75:kind==='plaster'?1.5:1;t.repeat.set(repeat,repeat);
 t.name='indoor-soft-'+kind+'-'+channel;t.userData={...t.userData,indoorFinish:'contrast-reduced; centered relief; scaled weave'};t.needsUpdate=true;
 return t;
}
