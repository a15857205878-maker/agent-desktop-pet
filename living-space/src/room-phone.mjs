import {visibleSceneHits} from './room-visibility.mjs';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export function createRoomPhone(model){
 const group=new THREE.Group();group.name='room-phone';model.updateWorldMatrix(true,true);
 const locations=[[-1.03,-1.05],[-1.03,-1.2],[-.85,-1.15]].map(([x,z])=>{const hits=visibleSceneHits(new THREE.Raycaster(new THREE.Vector3(x,3,z),new THREE.Vector3(0,-1,0)).intersectObject(model,true));return {x,z,y:hits[0]?.point.y}}),surface=locations.find(p=>p.y>.65&&p.y<1.3);
 if(!surface)throw Error('No desk surface for phone');group.position.set(surface.x,surface.y+.004,surface.z);group.rotation.y=-.45;
 const black=new THREE.MeshStandardMaterial({color:'#40394c',roughness:.74}),metal=new THREE.MeshStandardMaterial({color:'#b7a2cb',roughness:.68,metalness:.08}),stand=new THREE.MeshStandardMaterial({color:'#bd9a73',roughness:.86}),brass=new THREE.MeshStandardMaterial({color:'#c5a570',roughness:.63,metalness:.22});
 function box(w,h,d,px,py,pz,mat,r=.008){const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,r),mat);m.position.set(px,py,pz);m.userData.activity='phone';group.add(m);return m;}
 box(.19,.016,.13,0,.008,0,stand);box(.06,.09,.035,0,.055,-.023,stand);box(.165,.016,.023,0,.034,.026,stand);box(.16,.003,.003,0,.009,.066,brass,.001);box(.146,.285,.017,0,.169,0,metal,.014);box(.133,.268,.006,0,.169,.011,black,.012);
 // Static 3 x 4 preview matches the phone memory game's actual layout.
 const c=document.createElement('canvas');c.width=128;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#eee7f1';ctx.fillRect(0,0,128,256);ctx.fillStyle='#796487';ctx.beginPath();ctx.roundRect(16,22,65,6,3);ctx.fill();ctx.fillStyle='#c2afcb';ctx.beginPath();ctx.roundRect(16,34,43,3,1);ctx.fill();
 for(let row=0;row<4;row++)for(let col=0;col<3;col++){const x=12+col*36,y=51+row*43;ctx.fillStyle='#cebedb';ctx.beginPath();ctx.roundRect(x,y,30,35,4);ctx.fill();ctx.fillStyle='#9c83b0';ctx.beginPath();ctx.moveTo(x+15,y+12);ctx.lineTo(x+20,y+18);ctx.lineTo(x+15,y+24);ctx.lineTo(x+10,y+18);ctx.closePath();ctx.fill();}
 ctx.fillStyle='#b6a2c4';ctx.beginPath();ctx.roundRect(45,237,38,3,1.5);ctx.fill();
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const screen=new THREE.Mesh(new THREE.PlaneGeometry(.115,.235),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));screen.position.set(0,.166,.015);screen.userData.activity='phone';group.add(screen);box(.027,.006,.002,0,.289,.017,black,.002);
 return group;
}
