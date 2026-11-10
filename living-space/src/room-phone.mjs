import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export function createRoomPhone(model){
 const group=new THREE.Group();group.name='room-phone';model.updateWorldMatrix(true,true);
 const locations=[[-1.03,-1.05],[-1.03,-1.2],[-.85,-1.15]].map(([x,z])=>{const hits=new THREE.Raycaster(new THREE.Vector3(x,3,z),new THREE.Vector3(0,-1,0)).intersectObject(model,true);return {x,z,y:hits[0]?.point.y}}),surface=locations.find(p=>p.y>.65&&p.y<1.3);
 if(!surface)throw Error('No desk surface for phone');group.position.set(surface.x,surface.y+.004,surface.z);group.rotation.y=-.45;
 const black=new THREE.MeshStandardMaterial({color:'#242d31',roughness:.65}),metal=new THREE.MeshStandardMaterial({color:'#c6cfca',roughness:.7,metalness:.2}),stand=new THREE.MeshStandardMaterial({color:'#8c889f',roughness:.9});
 function box(w,h,d,px,py,pz,mat,r=.008){const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,r),mat);m.position.set(px,py,pz);m.userData.activity='phone';group.add(m);return m;}
 box(.17,.014,.11,0,.007,0,stand);box(.06,.09,.035,0,.055,-.023,stand);box(.146,.285,.017,0,.169,0,metal,.014);box(.133,.268,.006,0,.169,.011,black,.012);
 const c=document.createElement('canvas');c.width=128;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#f2edf8';ctx.fillRect(0,0,128,256);ctx.fillStyle='#65517f';ctx.fillRect(20,24,64,5);ctx.fillStyle='#d8c9ec';for(let row=0;row<4;row++)for(let col=0;col<3;col++)ctx.fillRect(12+col*36,48+row*43,30,35);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const screen=new THREE.Mesh(new THREE.PlaneGeometry(.115,.235),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));screen.position.set(0,.166,.015);screen.userData.activity='phone';group.add(screen);box(.027,.006,.002,0,.289,.017,black,.002);
 return group;
}
