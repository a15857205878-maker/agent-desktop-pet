import {createPorchCourtyard} from './porch-courtyard.mjs';
import {createYardGardenDetails} from './yard-garden-details.mjs';
import * as THREE from 'three';
export function createMicroHouseDetails(model){
 const door=model.getObjectByName('Prop_FrontDoor');const roots=[],materials=[new THREE.MeshStandardMaterial({color:'#a28bad',roughness:.88}),new THREE.MeshStandardMaterial({color:'#e4cca0',metalness:.18,roughness:.6}),new THREE.MeshStandardMaterial({color:'#f4e6d3',roughness:.94,side:THREE.DoubleSide})];let disposed=false;
 if(door){const plaque=new THREE.Group();plaque.name='micro-house-door-plaque';door.add(plaque);roots.push(plaque);const board=new THREE.Mesh(new THREE.BoxGeometry(.35,.135,.012),materials[0]);board.position.set(.36,1.12,.052);board.userData.townAction='door';plaque.add(board);for(const x of[.215,.505]){const nail=new THREE.Mesh(new THREE.SphereGeometry(.009,8,6),materials[1]);nail.position.set(x,1.12,.062);nail.userData.townAction='door';plaque.add(nail);}const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.035,0),materials[1]);gem.scale.z=.2;gem.position.set(.36,1.12,.064);gem.userData.townAction='door';plaque.add(gem);}
 const window=new THREE.Group();window.name='micro-house-window-textiles';model.add(window);roots.push(window);
 for(const x of[-.44,-.025]){const m=new THREE.Mesh(new THREE.PlaneGeometry(.065,.41,1,1),materials[2]);m.position.set(x,1.195,-.025);window.add(m);}
 for(const z of[-1.28,-.77]){const m=new THREE.Mesh(new THREE.PlaneGeometry(.065,.41,1,1),materials[2]);m.rotation.y=Math.PI/2;m.position.set(1.925,1.195,z);window.add(m);}
 const porch=createPorchCourtyard(model);
 const garden=createYardGardenDetails(model);
 return {setNight(night){porch.setNight(night);garden.setNight(night);},getState:()=>({doorPlaque:!!door,parts:[...roots.map(r=>r.name),porch.root.name,garden.root.name],garden:garden.getState()}),dispose(){if(disposed)return;disposed=true;garden.dispose();porch.dispose();const geometries=new Set();for(const root of roots){root.traverse(o=>{if(o.geometry)geometries.add(o.geometry)});root.removeFromParent();}for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}};
}
