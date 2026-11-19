import * as THREE from 'three';
import {makerPixels} from './maker-district-pixels.mjs';
export function createMakerDistrictSurfaceTexture(key){
 const match=/^(wood|plaster|leaf)(?:-(height|roughness))?$/.exec(key);if(!match)return null;
 const [,kind,channel='albedo']=match,name=kind==='plaster'?'stone':kind,index={albedo:0,height:1,roughness:2}[channel];
 const bytes=Uint8Array.from(atob(makerPixels[name]),v=>v.charCodeAt(0)),data=new Uint8Array(256*256*4);
 for(let i=0;i<256*256;i++){const v=bytes[i*3+index];data.set([v,v,v,255],i*4);}
 const t=new THREE.DataTexture(data,256,256);t.name='maker-cottage-'+name+'-'+channel;t.userData={source:'Material Maker',version:'1.8',graph:'cottage_'+name+'.ptex',channel};
 t.colorSpace=channel==='albedo'?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;
 t.repeat.set(kind==='wood'?1:2,kind==='wood'?1:2);if(kind==='wood'){t.center.set(.5,.5);t.rotation=Math.PI/2;}t.needsUpdate=true;return t;
}
