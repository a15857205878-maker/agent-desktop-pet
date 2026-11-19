import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const palette = {
  honey:'#bd9463', woodEnd:'#896646', paleWood:'#d9af7e', porcelain:'#f3e1c3',
  violet:'#9b91b7', violetShade:'#6d6688', brass:'#b48d52',
  terracotta:'#ba7861', clayInside:'#805340', soil:'#695039',
  leaf:'#83975e', leafLight:'#9eb67d', leafDark:'#596e53', bloom:'#b896c6',
  stone:'#c5b998', olive:'#858f73'
};

export function createTownLandmarks({home,plaza,orchard}) {
  const materials = new Map();
  const meshGroups = [];
  const material = key => {
    if(!materials.has(key)){
      materials.set(key,new THREE.MeshStandardMaterial({
        name:'town-landmark-'+key,color:palette[key],
        metalness:key==='brass'?.38:0,roughness:key==='brass'?.47:.79
      }));
    }
    return materials.get(key);
  };

  function kit(parent,name){
    const root=new THREE.Group();
    root.name=name;
    parent.add(root);
    meshGroups.push(root);
    const bins=new Map();
    function shape(geometry,key,x,y,z,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1){
      const flat=geometry.index?geometry.toNonIndexed():geometry;
      if(flat!==geometry)geometry.dispose();
      flat.scale(sx,sy,sz);
      flat.rotateX(rx);flat.rotateY(ry);flat.rotateZ(rz);flat.translate(x,y,z);
      if(!bins.has(key))bins.set(key,[]);
      bins.get(key).push(flat);
    }
    function box(w,h,d,key,x,y,z,yaw=0,bevel=.012){
      shape(new RoundedBoxGeometry(w,h,d,1,Math.min(bevel,w/4,h/4,d/4)),key,x,y,z,0,yaw);
    }
    function cylinder(top,bottom,h,key,x,y,z){
      shape(new THREE.CylinderGeometry(top,bottom,h,12),key,x,y,z);
    }
    function finish(){
      for(const [key,parts] of bins){
        const geometry=mergeGeometries(parts);
        parts.forEach(part=>part.dispose());
        const mesh=new THREE.Mesh(geometry,material(key));
        mesh.name=name+'-'+key;
        mesh.castShadow=true;
        mesh.receiveShadow=true;
        mesh.raycast=()=>{};
        root.add(mesh);
      }
    }
    return {shape,box,cylinder,finish};
  }

  function herb(k,x,z,y,scale,flowers){
    k.cylinder(.095*scale,.073*scale,.132*scale,'terracotta',x,y+.067*scale,z);
    k.cylinder(.103*scale,.101*scale,.029*scale,'terracotta',x,y+.132*scale,z);
    k.cylinder(.087*scale,.086*scale,.011*scale,'soil',x,y+.142*scale,z);
    for(let i=0;i<7;i++){
      const angle=i*2.39996;
      const edge=(.025+i%3*.01)*scale;
      const levels=['leafLight','leaf','leafDark'];
      k.shape(new THREE.SphereGeometry(1,9,6),levels[i%3],
        x+Math.cos(angle)*edge,y+(.183+i%3*.013)*scale,z+Math.sin(angle)*edge,
        -.51,angle,.31,.026*scale,.061*scale,.014*scale);
      if(flowers&&i<3){
        k.cylinder(.005*scale,.007*scale,.096*scale,'leafDark',x+Math.cos(angle)*edge,y+.20*scale,z+Math.sin(angle)*edge);
        k.shape(new THREE.IcosahedronGeometry(.026*scale,1),'bloom',
          x+Math.cos(angle)*edge,y+(.25+i*.01)*scale,z+Math.sin(angle)*edge);
      }
    }
  }
  function openCrate(k,x,y,z){
    k.box(.27,.023,.185,'woodEnd',x,y+.015,z);
    for(const side of [-1,1]){
      for(const h of [.040,.077]){
        k.box(.27,.026,.017,'paleWood',x,y+h,z+side*.080);
        k.box(.017,.026,.17,'honey',x+side*.122,y+h,z);
      }
      for(const corner of [-1,1]){
        k.box(.028,.095,.028,'honey',x+side*.122,y+.05,z+corner*.080);
      }
    }
  }

  const entrance=kit(home,'home-entry-details');
  entrance.box(.34,.04,.265,'stone',-.94,.049,1.45,.12);
  herb(entrance,-.99,1.45,.069,1.02,true);
  herb(entrance,-.82,1.36,.049,.63,false);
  entrance.finish();

  const square=kit(plaza,'plaza-post-and-stone');
  const mx=.59,mz=-1.44;
  square.box(.18,.046,.16,'stone',mx,.065,mz);
  square.box(.073,.47,.073,'woodEnd',mx,.286,mz);
  square.box(.275,.232,.236,'violet',mx,.572,mz);
  square.box(.291,.08,.255,'violetShade',mx,.708,mz,0,.036);
  square.box(.207,.162,.018,'violetShade',mx,.576,mz+.121);
  square.box(.188,.021,.019,'brass',mx,.617,mz+.136);
  square.box(.108,.047,.012,'porcelain',mx,.547,mz+.137);
  for (const x of [-.073,.073]) square.box(.029,.023,.016,'brass',mx+x,.504,mz+.136);
  for (let i=0;i<12;i++){
    const a=i*Math.PI/6;
    square.box(.012,.040,.029,'stone',Math.sin(a)*.743,.157,-.2+Math.cos(a)*.743,a);
  }
  square.finish();

  const harvest=kit(orchard,'orchard-sorting-corner');
  const ox=1.47,oz=-.37;
  for(const dx of [-.19,.19]) for(const dz of [-.123,.123]){
    harvest.box(.055,.272,.052,'woodEnd',ox+dx,.177,oz+dz);
  }
  harvest.box(.47,.041,.315,'paleWood',ox,.324,oz);
  harvest.box(.414,.046,.018,'honey',ox,.284,oz+.132);
  openCrate(harvest,ox-.067,.346,oz-.023);
  harvest.box(.19,.012,.126,'olive',ox+.12,.351,oz+.075,-.12);
  harvest.cylinder(.043,.038,.069,'olive',ox+.13,.391,oz+.064);
  harvest.cylinder(.025,.030,.013,'brass',ox+.13,.428,oz+.064);
  harvest.shape(new THREE.CylinderGeometry(.008,.010,.083,8),'olive',ox+.179,.412,oz+.071,0,0,-.94);
  harvest.shape(new THREE.TorusGeometry(.027,.005,6,14,Math.PI*1.28),'brass',ox+.103,.404,oz+.062,0,0,1.6);
  openCrate(harvest,1.55,.043,-.67);
  herb(harvest,1.69,-.21,.043,.67,false);
  harvest.finish();

  const colors=new Map([...materials].map(([key,m])=>[key,m.color.clone()]));
  return {
    setNight(night){
      for(const [key,m] of materials) m.color.copy(colors.get(key)).multiplyScalar(night?.94:1);
    },
    state:()=>meshGroups.map(root=>({name:root.name,batches:root.children.length})),
    dispose(){
      for(const root of meshGroups){
        root.removeFromParent();
        for(const mesh of root.children)mesh.geometry.dispose();
      }
      for(const m of materials.values())m.dispose();
    }
  };
}
