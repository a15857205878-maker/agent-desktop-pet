import * as THREE from 'three';
// Fit the actual visible model, rather than the unused corners of its world AABB.
export function projectVisibleModel(root,camera,target=new THREE.Vector3(0,1,0)){
 root.updateWorldMatrix(true,true);camera.updateMatrixWorld(true);
 const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1),p=new THREE.Vector3();
 let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity,vertices=0;
 function visit(o){if(!o.visible)return;if(o.isMesh&&!/hotspot/i.test(o.name)&&![o.material].flat().every(m=>m?.transparent&&m.opacity<=.01)){
  const a=o.geometry?.attributes.position;if(a)for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).sub(target);const x=p.dot(right),y=p.dot(up);xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);ymin=Math.min(ymin,y);ymax=Math.max(ymax,y);vertices++;}
 }for(const child of o.children)visit(child);}
 visit(root);if(!vertices)return null;return{xmin,xmax,ymin,ymax,width:xmax-xmin,height:ymax-ymin,vertices};
}
export function fitModelFrame(camera,b,w,h,{top=24,bottom=24,padding=22,target=new THREE.Vector3(0,1,0)}={}){
 if(!b)return;w=Math.max(1,w);h=Math.max(1,h);
 const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
 const offset=right.multiplyScalar((b.xmin+b.xmax)/2).add(up.multiplyScalar((b.ymin+b.ymax)/2));camera.position.add(offset);camera.lookAt(target.clone().add(offset));
 const span=Math.max(b.height*h/Math.max(80,h-top-bottom),b.width*h/Math.max(80,w-padding*2)),shift=span*(top-bottom)/(2*h);
 camera.left=-span*w/h/2;camera.right=span*w/h/2;camera.top=span/2+shift;camera.bottom=-span/2+shift;camera.updateProjectionMatrix();
}
