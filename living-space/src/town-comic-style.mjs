import * as THREE from 'three';

const LINE_SURFACES = /^(two-story-(wood|woodDeep|wallCream|roofTile(Alt)?|shutterSage)|ref-yard-(wood|fence|stone|paver)(-|$)|cozy-town-(plaza|orchard)-(wood|metalGold)|plaza-post-and-stone-(violet|violetShade|brass)|orchard-sorting-corner-(honey|paleWood)|fountain-beveled-stone-lip)$/;

function wantsInk(mesh){
  const paving = /^(plaza|orchard)-detail$/.test(mesh.parent?.name) && /^detail-(stone|rim)$/.test(mesh.name);
  return paving || LINE_SURFACES.test(mesh.name) || Boolean(mesh.parent?.userData.benchAnchor);
}

function styleSurface(material, toneAmount, originals) {
  if(originals.has(material) || !material?.isMeshStandardMaterial ||
    material.transparent || material.emissive?.getHex() ||
    /water|glass|glow|metal|gold/i.test(material.name)) return;
  const before=material.onBeforeCompile;
  const cacheKey=material.customProgramCacheKey;
  const baseKey=cacheKey.call(material);
  originals.set(material,{before,cacheKey});
  material.customProgramCacheKey=()=>baseKey+'-town-ink-and-cel';
  material.onBeforeCompile=(shader,renderer)=>{
    before.call(material,shader,renderer);
    shader.uniforms.townComicTone=toneAmount;
    shader.fragmentShader='uniform float townComicTone;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      vec3 comicLuma = vec3(.2126,.7152,.0722);
      float comicLight = dot(outgoingLight,comicLuma) / max(.045,dot(diffuseColor.rgb,comicLuma));
      float comicBand = .34
        + .24*smoothstep(.37,.48,comicLight)
        + .29*smoothstep(.64,.77,comicLight)
        + .34*smoothstep(.97,1.15,comicLight)
        + .28*smoothstep(1.38,1.58,comicLight);
      float comicShade = 1.0-smoothstep(.37,.91,comicLight);
      vec3 comicTint = mix(vec3(1.045,1.016,.975),vec3(.88,.927,1.065),comicShade);
      vec3 comicPigment = max(vec3(0.0),mix(vec3(dot(diffuseColor.rgb,comicLuma)),diffuseColor.rgb,1.10));
      outgoingLight = mix(outgoingLight,comicPigment*comicBand*comicTint,townComicTone);
      #include <opaque_fragment>
    `);
  };
  material.needsUpdate=true;
}

export function createTownComicStyle({home,plaza,orchard}){
  const toneAmount={value:.62};
  const originals=new Map();
  const inkLayers=[];
  const inkMaterial=new THREE.LineBasicMaterial({
    color:'#5b4353',transparent:true,opacity:.53,depthWrite:false,toneMapped:false
  });
  inkMaterial.customProgramCacheKey=()=> 'town-superimposed-ink';
  inkMaterial.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n gl_Position.z -= .000045 * gl_Position.w;'
    );
  };
  const localTransform=new THREE.Matrix4();
  const point=new THREE.Vector3();
  for(const [area,root] of Object.entries({home,plaza,orchard})){
    root.updateWorldMatrix(true,true);
    const fromWorld=root.matrixWorld.clone().invert();
    const positions=[];
    root.traverseVisible(mesh=>{
      if(!mesh.isMesh)return;
      [mesh.material].flat().forEach(m=>styleSurface(m,toneAmount,originals));
      if(!wantsInk(mesh))return;
      const edges=new THREE.EdgesGeometry(mesh.geometry,36);
      const vertices=edges.getAttribute('position');
      localTransform.multiplyMatrices(fromWorld,mesh.matrixWorld);
      for(let i=0;i<vertices.count;i++){
        point.fromBufferAttribute(vertices,i).applyMatrix4(localTransform);
        positions.push(point.x,point.y,point.z);
      }
      edges.dispose();
    });
    if(!positions.length)continue;
    const strokeGeometry=new THREE.BufferGeometry();
    strokeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    const strokes=new THREE.LineSegments(strokeGeometry,inkMaterial);
    strokes.name=area+'-comic-ink';
    strokes.raycast=()=>{};
    root.add(strokes);
    inkLayers.push(strokes);
  }
  return {
    setNight(night){
      toneAmount.value=night?.48:.62;
      inkMaterial.color.set(night?'#353b59':'#5b4353');
      inkMaterial.opacity=night?.49:.53;
    },
    state:()=>({inkLayers:inkLayers.length,gradedMaterials:originals.size}),
    dispose(){
      for(const strokes of inkLayers){
        strokes.removeFromParent();
        strokes.geometry.dispose();
      }
      inkMaterial.dispose();
      for(const [m,{before,cacheKey}] of originals){
        m.onBeforeCompile=before;
        m.customProgramCacheKey=cacheKey;
        m.needsUpdate=true;
      }
    }
  };
}
