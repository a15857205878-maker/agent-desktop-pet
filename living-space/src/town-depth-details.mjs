import * as THREE from 'three';

function makeShadowMap() {
  const size = 48;
  const pixels = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const x = (i % size + .5) * 2 / size - 1;
    const y = (Math.floor(i / size) + .5) * 2 / size - 1;
    pixels.set([255,255,255,Math.round(255 * Math.max(0, 1 - x*x - y*y) ** 2.5)],i*4);
  }
  const map = new THREE.DataTexture(pixels,size,size);
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  return map;
}

function basinSurface() {
  const profile = [
    new THREE.Vector2(0, .1785),
    new THREE.Vector2(.16, .179),
    new THREE.Vector2(.34, .179),
    new THREE.Vector2(.49, .179),
    new THREE.Vector2(.621, .1785)
  ];
  const geometry = new THREE.LatheGeometry(profile,64);
  const colors = ['#83abaa','#8fb5b3','#a0c1bc','#acc8bf','#799f98'].map(value=>new THREE.Color(value));
  const position = geometry.getAttribute('position');
  const values = new Float32Array(position.count*3);
  const shade = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i);
    shade.copy(colors[i % profile.length]).multiplyScalar(1-.09*x+.07*z);
    shade.toArray(values,i*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(values,3));
  return geometry;
}

export function createTownDepthDetails({plaza,orchard}) {
  const shadowMap = makeShadowMap();
  const shadowGeometry = new THREE.PlaneGeometry(1,1);
  const roots = [];
  const materials = new Set();
  const geometries = new Set([shadowGeometry]);
  const shadow = (opacity) => {
    const material = new THREE.MeshBasicMaterial({
      map:shadowMap,color:'#594333',transparent:true,opacity,depthWrite:false,toneMapped:false
    });
    materials.add(material);
    return material;
  };
  const broadShadow = shadow(.23);
  const footShadow = shadow(.32);
  const ripples = [];
  let elapsed = 0, lastTime = null, night = false;

  function layer(parent,name) {
    const group = new THREE.Group();
    group.name = name;
    parent.add(group);
    roots.push(group);
    return group;
  }
  function detail(parent,name,geometry,material) {
    const mesh = new THREE.Mesh(geometry,material);
    mesh.name = name;
    mesh.raycast = () => {};
    parent.add(mesh);
    geometries.add(geometry);
    materials.add(material);
    return mesh;
  }
  function pad(parent,x,y,z,width,length,material) {
    const mesh = detail(parent,'town-ground-contact',shadowGeometry,material);
    mesh.position.set(x,y,z);
    mesh.rotation.x = -Math.PI/2;
    mesh.scale.set(width,length,1);
  }
  function benchPads(parent,group) {
    for (const child of parent.children) {
      const seat = child.userData.benchAnchor;
      if (!seat) continue;
      const [x,,z] = seat;
      pad(group,x,.028,z-.09,1.13,.57,broadShadow);
      for (const dx of [-.38,.38]) {
        pad(group,x+dx,.030,z-.23,.22,.22,footShadow);
        pad(group,x+dx,.030,z+.05,.22,.22,footShadow);
      }
    }
  }

  const plazaGround = layer(plaza,'plaza-contact-shadows');
  const orchardGround = layer(orchard,'orchard-contact-shadows');
  benchPads(plaza,plazaGround);
  benchPads(orchard,orchardGround);
  pad(plazaGround,0,.071,-.2,1.93,1.8,broadShadow);
  for (const x of [-.76,.76]) pad(plazaGround,x,.04,-1.65,.64,.48,footShadow);
  for (const tree of orchard.children.filter(node=>node.name==='town-tree')) {
    const {x,z} = tree.position;
    pad(orchardGround,x,.043,z,.85,.69,broadShadow);
    pad(orchardGround,x,.047,z,.45,.40,footShadow);
  }
  pad(orchardGround,1.45,.04,.15,.57,.43,footShadow);

  const fountain = plaza.getObjectByName('town-stone-fountain');
  const basin = layer(fountain,'fountain-depth-details');
  const lipProfile = [
    [.744,.125],[.748,.16],[.742,.194],[.725,.211],[.643,.211],
    [.625,.202],[.616,.185],[.617,.149]
  ].map(point=>new THREE.Vector2(...point));
  const lip = detail(basin,'fountain-beveled-stone-lip',new THREE.LatheGeometry(lipProfile,64),
    new THREE.MeshStandardMaterial({color:'#ded1b9',roughness:.74,side:THREE.DoubleSide}));
  lip.receiveShadow = true;
  lip.castShadow = true;
  const sheet = detail(basin,'fountain-inner-water',basinSurface(),
    new THREE.MeshStandardMaterial({vertexColors:true,roughness:.27,side:THREE.DoubleSide}));
  sheet.receiveShadow = true;

  const ring = new THREE.RingGeometry(.962,1,64);
  for (const [y,x,z,extent,offset] of [
    [.18,0,0,.535,0],[.1805,0,0,.535,.53],[.61,0,0,.205,.26]
  ]) {
    const material = new THREE.MeshBasicMaterial({
      color:'#d9eeeb',transparent:true,opacity:0,depthWrite:false,toneMapped:false
    });
    const mesh = detail(basin,'fountain-water-ripple',ring,material);
    mesh.rotation.x = -Math.PI/2;
    mesh.position.set(x,y,z);
    ripples.push({mesh,extent,offset});
  }

  return {
    setNight(value) {
      night = Boolean(value);
      broadShadow.opacity = night ? .31 : .23;
      footShadow.opacity = night ? .37 : .32;
      lip.material.color.set(night?'#c8c7bb':'#ded1b9');
    },
    step(now,animate) {
      if (animate&&lastTime!==null) elapsed += Math.min(65,Math.max(0,now-lastTime));
      lastTime = animate ? now : null;
      for (const {mesh,extent,offset} of ripples) {
        const p = (elapsed/2600+offset)%1;
        const radius = extent*(.13+.87*p);
        mesh.scale.set(radius,radius,1);
        mesh.material.opacity = (night?.28:.48)*Math.sin(Math.PI*p)**1.4;
      }
    },
    state: () => ({waterTime:elapsed,ripples:ripples.length}),
    dispose() {
      roots.forEach(root=>root.removeFromParent());
      geometries.forEach(geometry=>geometry.dispose());
      materials.forEach(material=>material.dispose());
      shadowMap.dispose();
    }
  };
}
