import * as THREE from 'three';
import {surfacePixels} from './cottage-texture-data.mjs';

// Offline material preparation preserves the approved miniature palette. Maps
// describe micro-relief only: they never displace geometry or affect hit testing.
export function createCottageSurfaceTexture(key){
 const match=/^(wood|plaster|linen)(?:-(height|roughness))?$/.exec(key);if(!match)return null;
 const [,kind,channel='color']=match,index={color:0,height:1,roughness:2}[channel];
 const bytes=Uint8Array.from(atob(surfacePixels[kind]),v=>v.charCodeAt(0)),data=new Uint8Array(128*128*4);
 for(let i=0;i<128*128;i++){const v=bytes[i*3+index];data.set([v,v,v,255],i*4);}
 const t=new THREE.DataTexture(data,128,128);t.name='ambientcg-'+kind+'-'+channel;
 t.userData={source:'ambientCG',asset:{wood:'Wood049',plaster:'Plaster001',linen:'Fabric030'}[kind],license:'CC0-1.0'};
 t.colorSpace=channel==='color'?THREE.SRGBColorSpace:THREE.NoColorSpace;
 t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;
 // Wood049 grain runs horizontally in the source; component UVs reserve V
 // for the beam/picket's long axis. Rotate all PBR channels together.
 if(kind==='wood'){t.center.set(.5,.5);t.rotation=Math.PI/2;}
 const repeat=kind==='linen'?5:kind==='plaster'?2:1;t.repeat.set(repeat,repeat);t.needsUpdate=true;return t;
}
