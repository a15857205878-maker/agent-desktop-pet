import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {outdoorPalette as palette} from './outdoor-style.mjs';

// Static, locally generated scenery. No saved state or interactive hit targets.
export function addTownMapDetails({plaza,orchard,home}){
 const colors={stone:palette.stone,rim:palette.rim,wood:palette.wood,fence:palette.wood,soil:palette.soil,leaf:palette.leaf,sage:palette.leafLight,flower:palette.flower,gold:palette.gold,water:palette.water};
 const materials=Object.fromEntries(Object.entries(colors).map(([k,color])=>[k,new THREE.MeshStandardMaterial({color,roughness:k==='water'?.45:.94})]));
 const sources=new Map();
 function add(group,geometry,kind,x,y,z,rx=0,ry=0,rz=0){geometry.rotateX(rx);geometry.rotateY(ry);geometry.rotateZ(rz);geometry.translate(x,y,z);const key=group.name+':'+kind;if(!sources.has(key))sources.set(key,{group,kind,geometries:[]});sources.get(key).geometries.push((geometry.index?geometry.toNonIndexed():geometry.clone()).deleteAttribute('uv'));geometry.dispose();}
 const box=(g,w,h,d,x,y,z,k,ry=0)=>add(g,new THREE.BoxGeometry(w,h,d),k,x,y,z,0,ry);
 const ball=(g,r,x,y,z,k)=>add(g,new THREE.IcosahedronGeometry(r,0),k,x,y,z);
 const ring=(g,r,t,x,y,z,k)=>add(g,new THREE.TorusGeometry(r,t,4,32),k,x,y,z,-Math.PI/2);
 function link(g,points){for(let i=0;i<points.length-1;i++){const [ax,az]=points[i],[bx,bz]=points[i+1],dx=bx-ax,dz=bz-az;box(g,.42,.014,Math.hypot(dx,dz)+.035,(ax+bx)/2,.057,(az+bz)/2,'stone',Math.atan2(dx,dz));}}
 function edge(g){for(const x of [-1.965,1.965])box(g,.045,.035,3.88,x,-.028,0,'rim');for(const z of [-1.965,1.965])box(g,3.88,.035,.045,0,-.028,z,'rim');}
 function tuft(g,x,z,i){for(let j=0;j<3;j++)add(g,new THREE.ConeGeometry(.018,.075+(i%3)*.012,3),'sage',x+(j-1)*.025,.065,z+(j%2)*.018,0,j*1.4,(j-1)*.22);}
 function flowers(g,x,z){box(g,.42,.08,.30,x,.06,z,'soil');for(let i=0;i<5;i++){const xx=x-.15+i*.075,zz=z+(i%2?-.06:.06);ball(g,.075,xx,.14,zz,'leaf');ball(g,.037,xx,.225,zz,i%2?'gold':'flower');}}
 function paving(g,x,z,w,d){const cols=Math.max(1,Math.round(w/.26)),rows=Math.max(1,Math.round(d/.27));for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const xx=x-w/2+(i+.5)*w/cols,zz=z-d/2+(j+.5)*d/rows;box(g,w/cols-.013,.014,d/rows-.013,xx,.061,zz,(i+j)%4?'stone':'rim');}}
 const p=new THREE.Group();p.name='plaza-detail';plaza.add(p);
 edge(p);link(p,[[0,1.05],[-.45,1.15],[-.9,1.38],[-1.35,1.58],[-1.75,1.7]]);link(p,[[0,1.05],[.45,1.15],[.9,1.38],[1.35,1.58],[1.75,1.7]]);
 paving(p,0,1.0,.65,1.7);paving(p,-1.12,-.35,1.05,.7);paving(p,1.12,-.35,1.05,.7);
 ring(p,.68,.058,0,.20,-.2,'rim');ring(p,.48,.007,0,.185,-.2,'water');ring(p,.33,.006,0,.184,-.2,'water');
 // A low masonry apron around the fountain, laid as individual radial stones.
 for(let i=0;i<20;i++){const a=i*Math.PI/10;box(p,.235,.028,.14,Math.sin(a)*.84,.052,-.2+Math.cos(a)*.84,'stone',a);}
 for(const x of [-1.33,1.33]){flowers(p,x,-1.70);flowers(p,x,.45);for(let i=0;i<4;i++)tuft(p,x+(i-1.5)*.13,.72,i);}
 for(let i=0;i<10;i++)tuft(p,-1.65+(i%5)*.13,1.05+Math.floor(i/5)*.13,i);
 const o=new THREE.Group();o.name='orchard-detail';orchard.add(o);
 edge(o);link(o,[[0,1.2],[-.4,1.35],[-.85,1.5],[-1.3,1.6],[-1.75,1.7]]);link(o,[[0,.85],[.35,1],[.65,1.05]]);
 // Separate flagstones break up the straight original path without changing its route.
 for(let i=0;i<12;i++)box(o,.52,.018,.245,(i%2?-.018:.018),.062,-1.56+i*.285,i%3?'stone':'rim',(i%3-1)*.045);
 for(const [x,z] of [[-1.05,-1.05],[1.02,-.92],[-1.02,.42]]){
  add(o,new THREE.CylinderGeometry(.36,.37,.018,12),'soil',x,.04,z);
  // Individual low stones keep the soil bed handmade without widening its edge.
  for(let i=0;i<12;i++){const a=i*Math.PI/6;box(o,.13,.035,.045,x+Math.sin(a)*.355,.054,z+Math.cos(a)*.355,i%4?'stone':'rim',a);}
  for(let i=0;i<6;i++){const a=i*Math.PI/3;tuft(o,x+Math.sin(a)*.44,z+Math.cos(a)*.44,i);}
 }
 for(const x of [-1.85,1.85]){box(o,.045,.045,3.4,x,.19,0,'fence');for(const z of [-1.7,-.8,.1,1,1.7])box(o,.1,.04,.10,x,.52,z,'wood');}
 flowers(o,1.35,1.63);for(let i=0;i<9;i++)tuft(o,-.50-(i%3)*.13,-1.55+Math.floor(i/3)*.13,i);
 const h=new THREE.Group();h.name='home-detail';home.add(h);
 edge(h);link(h,[[.25,1.83],[.65,1.81],[1.05,1.76],[1.45,1.72],[1.76,1.7]]);
 // Keep the front gate, door landing and saved furniture coordinates clear.
 for(let i=0;i<8;i++){tuft(h,-1.65+i*.14,1.66,i);tuft(h,1.50+(i%2)*.12,.50+Math.floor(i/2)*.19,i);}
 for(let i=0;i<5;i++){const geo=new THREE.IcosahedronGeometry(.035+(i%2)*.015,0);geo.scale(1,.5,.7);add(h,geo,'stone',-.65+i*.15,.032,1.77+(i%2)*.03);}
 let triangles=0;
 for(const {group,kind,geometries} of sources.values()){
  const geometry=mergeGeometries(geometries,false);for(const geo of geometries)geo.dispose();
  const mesh=new THREE.Mesh(geometry,materials[kind]);mesh.name='detail-'+kind;mesh.castShadow=kind!=='water';mesh.receiveShadow=true;group.add(mesh);triangles+=geometry.attributes.position.count/3;
 }
 return {triangles,meshes:sources.size};
}
