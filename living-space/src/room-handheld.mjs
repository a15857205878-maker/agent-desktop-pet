import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export const handheldAnchor=[.22,.795,1.82];
export function createRoomHandheld(){
 const group=new THREE.Group();group.name='room-handheld';group.position.set(...handheldAnchor);group.rotation.y=-.18;
 const material=color=>new THREE.MeshStandardMaterial({color,roughness:.7,metalness:.04}),black=material('#252a30'),blue=material('#19b5e5'),red=material('#fa4e57'),button=material('#33383e');
 function box(w,h,d,x,y,z,mat,r=.008){const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,r),mat);mesh.position.set(x,y,z);mesh.userData.activity='snake';group.add(mesh);return mesh;}
 box(.24,.035,.18,0,.018,0,black);box(.061,.039,.184,-.15,.019,0,blue,.016);box(.061,.039,.184,.15,.019,0,red,.016);
 function circle(radius,x,z){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,.008,16),button);mesh.position.set(x,.044,z);mesh.userData.activity='snake';group.add(mesh);}
 circle(.017,-.15,-.041);circle(.017,.15,.045);
 for(const [x,z] of [[-.15,.025],[-.15,.055],[-.165,.04],[-.135,.04],[.15,-.06],[.15,-.03],[.135,-.045],[.165,-.045]])circle(.0055,x,z);
 const c=document.createElement('canvas');c.width=200;c.height=140;const ctx=c.getContext('2d');ctx.fillStyle='#edf0f5';ctx.fillRect(0,0,200,140);ctx.fillStyle='#6477b0';for(const [x,y] of [[8,6],[9,6],[10,6],[11,6],[11,5]])ctx.fillRect(x*10,y*10,9,9);ctx.fillStyle='#c98645';ctx.fillRect(150,30,8,8);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const screen=new THREE.Mesh(new THREE.PlaneGeometry(.21,.144),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));screen.rotation.x=-Math.PI/2;screen.position.y=.038;screen.userData.activity='snake';group.add(screen);
 return group;
}
