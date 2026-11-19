import * as THREE from 'three';

// The atlas is rendered on the existing billboard. Match landmarks in the
// billboard's local plane before handing the outline over to the new drawing.
export function bindTownPoseBlend(sprite) {
  const material = sprite.material;
  const uniforms = {
    poseMap: { value: material.map },
    poseBlend: { value: 0 },
    fromRegistration: { value: new THREE.Vector4() },
    toRegistration: { value: new THREE.Vector4() },
    blendedFace: { value: new THREE.Vector2() },
    townRelief: { value: 0 },
    seatSway: { value: new THREE.Vector2() }
  };
  material.customProgramCacheKey = () => 'town-landmark-pose-mix';
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = `
      uniform sampler2D poseMap;
      uniform float poseBlend;
      uniform vec4 fromRegistration;
      uniform vec4 toRegistration;
      uniform vec2 blendedFace;
      uniform float townRelief;
      uniform vec2 seatSway;
      vec2 registeredUv(vec2 uv, vec4 registration) {
        return (uv - blendedFace) * registration.zw + registration.xy;
      }
      float insideFrame(vec2 uv) {
        return step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
      }
      vec2 seatedUv(vec2 uv) {
        // Fade the displacement out toward the face, torso and tail root.
        float hair = smoothstep(.57,.70,uv.x) * smoothstep(.42,.54,uv.y) * (1.0-smoothstep(.66,.78,uv.y));
        float tail = smoothstep(.61,.76,uv.x) * (1.0-smoothstep(.27,.43,uv.y));
        return uv - vec2(seatSway.x * hair + seatSway.y * tail, seatSway.y * tail * .32);
      }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace(
      'diffuseColor *= sampledDiffuseColor;',
      `
        if (abs(seatSway.x) + abs(seatSway.y) > 0.0) {
          vec2 uv = seatedUv(vMapUv);
          sampledDiffuseColor = texture2D(map, clamp(uv, 0.0, 1.0));
          sampledDiffuseColor.a *= insideFrame(uv);
        }
        if (poseBlend > 0.0) {
          vec2 fromUv = registeredUv(vMapUv, fromRegistration);
          vec2 toUv = registeredUv(vMapUv, toRegistration);
          vec4 fromColor = texture2D(map, clamp(fromUv, 0.0, 1.0));
          vec4 toColor = texture2D(poseMap, clamp(toUv, 0.0, 1.0));
          fromColor.a *= insideFrame(fromUv);
          toColor.a *= insideFrame(toUv);
          // Hand off the feet before the upper body. Overlapping portions
          // blend, but edges trade ownership quickly so limbs stay readable.
          float timing = poseBlend + (.55 - vMapUv.y) * .13;
          float sharedCoverage = smoothstep(.1, .75, min(fromColor.a, toColor.a));
          float weight = mix(smoothstep(.475,.525,timing), smoothstep(.32,.68,timing), sharedCoverage);
          float opacity = mix(fromColor.a, toColor.a, weight);
          sampledDiffuseColor = opacity > .0001
            ? vec4(mix(fromColor.rgb*fromColor.a, toColor.rgb*toColor.a, weight)/opacity,opacity)
            : vec4(0.0);
        }
        float lowerBody = 1.0 - smoothstep(.12, .80, vMapUv.y);
        float shadedSide = smoothstep(.25, .80, vMapUv.x);
        float shade = townRelief * (lowerBody * .76 + shadedSide * .24);
        sampledDiffuseColor.rgb *= vec3(1.0-shade,1.0-shade*.86,1.0-shade*.65);
        diffuseColor *= sampledDiffuseColor;
      `
    ));
  };
  const mix = THREE.MathUtils.lerp;

  function show(from, to = from, weight = 0) {
    if (weight >= 1) {
      from = to;
      weight = 0;
    }
    const width = mix(from.width, to.width, weight);
    const height = mix(from.height, to.height, weight);
    const cx = mix(from.center[0], to.center[0], weight);
    const cy = mix(from.center[1], to.center[1], weight);
    sprite.scale.set(width, height, 1);
    sprite.center.set(cx, cy);
    material.map = from.texture;
    uniforms.poseBlend.value = weight;
    if (!weight) return;
    uniforms.poseMap.value = to.texture;
    uniforms.fromRegistration.value.set(...from.face, width/from.width, height/from.height);
    uniforms.toRegistration.value.set(...to.face, width/to.width, height/to.height);
    uniforms.blendedFace.value.set(
      cx + mix((from.face[0]-from.center[0])*from.width, (to.face[0]-to.center[0])*to.width, weight)/width,
      cy + mix((from.face[1]-from.center[1])*from.height, (to.face[1]-to.center[1])*to.height, weight)/height
    );
  }
  return {
    show,
    setRelief: amount=>{uniforms.townRelief.value=amount;},
    setSeatSway: (hair,tail)=>{uniforms.seatSway.value.set(hair,tail);}
  };
}
