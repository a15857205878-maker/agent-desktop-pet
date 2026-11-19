import {visibleSceneHits} from './room-visibility.mjs';
import * as THREE from 'three';
export function createRoomAlarm(model){
 const group=new THREE.Group();model.updateWorldMatrix(true,true);
 const candidates=[[-.94,-1.52],[-.85,-1.45],[-1.12,-1.4]].map(([x,z])=>({x,z,y:visibleSceneHits(new THREE.Raycaster(new THREE.Vector3(x,3,z),new THREE.Vector3(0,-1,0)).intersectObject(model,true))[0]?.point.y}));
 const p=candidates.find(p=>p.y>.65&&p.y<1.3);if(!p)return group;
 group.position.set(p.x,p.y+.14,p.z);group.rotation.y=-.45;
 const cream=new THREE.MeshStandardMaterial({color:'#e1b98f',roughness:.7});
 const body=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.075,32),cream);body.rotation.x=Math.PI/2;group.add(body);
 const c=document.createElement('canvas');c.width=c.height=160;const ctx=c.getContext('2d');ctx.fillStyle='#fff9ed';ctx.fillRect(0,0,160,160);ctx.strokeStyle='#64536c';ctx.lineWidth=4;ctx.beginPath();ctx.arc(80,80,70,0,Math.PI*2);ctx.stroke();for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.moveTo(80+Math.sin(a)*57,80-Math.cos(a)*57);ctx.lineTo(80+Math.sin(a)*63,80-Math.cos(a)*63);ctx.stroke();}ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(80,37);ctx.lineTo(80,80);ctx.lineTo(109,94);ctx.stroke();
 const face=new THREE.Mesh(new THREE.CircleGeometry(.118,32),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),toneMapped:false}));face.position.z=.039;group.add(face);
 for(const x of [-.09,.09]){const bell=new THREE.Mesh(new THREE.SphereGeometry(.065,16,12),cream);bell.position.set(x,.115,0);bell.scale.y=.65;group.add(bell);const foot=new THREE.Mesh(new THREE.SphereGeometry(.025,10,8),cream);foot.position.set(x,-.12,0);group.add(foot);}
 group.traverse(o=>o.userData.activity='alarm');return group;
}
export function createRoomExit(model){
 const c=document.createElement('canvas');c.width=256;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#b8a0bb';ctx.fillRect(0,0,256,128);ctx.strokeStyle='#eadce8';ctx.lineWidth=8;ctx.strokeRect(10,10,236,108);ctx.fillStyle='#fff8ee';ctx.font='bold 36px sans-serif';ctx.textAlign='center';ctx.fillText('出门 →',128,78);
 const surface=visibleSceneHits(new THREE.Raycaster(new THREE.Vector3(-.6,3,1.92),new THREE.Vector3(0,-1,0)).intersectObject(model,true))[0]?.point.y??.1;
 const m=new THREE.Mesh(new THREE.PlaneGeometry(.72,.36),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),side:THREE.DoubleSide,toneMapped:false}));m.rotation.x=-Math.PI/2;m.position.set(-.6,surface+.012,1.92);m.userData.activity='outdoor';return m;
}
