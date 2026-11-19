import {STUDY_LAYOUT,BEDROOM_LAYOUT} from './reference-room-layout.mjs';
import * as THREE from 'three';
import { BEDROOM_POINTS } from './bedroom-scene.mjs';

export const STUDY_CONFIGS = Object.freeze({
  back: Object.freeze({
    station: 'desk',
    base: Object.freeze([-0.334, 0.74, -0.75]),
    shadow: Object.freeze([-0.334, 0.224, -0.75]),
    center: Object.freeze([0.49, 0.27]),
    aspect: 1,
    next: 'turn',
    label: '背身挂机 · 点击角色可以回头'
  }),
  turn: Object.freeze({
    station: 'desk',
    base: Object.freeze([-0.334, 0.74, -0.75]),
    shadow: Object.freeze([-0.334, 0.224, -0.75]),
    center: Object.freeze([0.49, 0.27]),
    aspect: 1,
    next: 'back',
    label: '回头回应 · 点击角色回到背身'
  }),
  relax: Object.freeze({
    station: 'chair',
    base: STUDY_LAYOUT.chairBase,
    shadow: STUDY_LAYOUT.chairShadow,
    center: Object.freeze([0.49, 0.46]),
    aspect: 0.5,
    next: 'rest',
    label: '扶手椅放松 · 点击角色闭目休息'
  }),
  rest: Object.freeze({
    station: 'chair',
    base: STUDY_LAYOUT.chairBase,
    shadow: STUDY_LAYOUT.chairShadow,
    center: Object.freeze([0.49, 0.46]),
    aspect: 0.5,
    next: 'relax',
    label: '闭目休息 · 点击角色睁眼'
  }),
  stretch: Object.freeze({
    station: 'chair',
    base: STUDY_LAYOUT.chairBase,
    shadow: STUDY_LAYOUT.chairShadow,
    center: Object.freeze([0.50, 0.44]),
    aspect: 1,
    sizeScale: 0.88,
    next: 'relax',
    label: '伸个懒腰 · 放松一下'
  })
});

export const BEDROOM_CONFIGS = Object.freeze({
  relax: Object.freeze({
    station: 'reading',
    base: BEDROOM_POINTS.companionReadingBase,
    shadow: Object.freeze([-1.08, 0.224, -0.44]),
    center: Object.freeze([0.49, 0.46]),
    aspect: 0.5,
    sizeScale: BEDROOM_LAYOUT.readingSpriteSizeScale,
    next: 'rest',
    label: '卧室阅读椅 · 点击角色小憩'
  }),
  rest: Object.freeze({
    station: 'reading',
    base: BEDROOM_POINTS.companionReadingBase,
    shadow: Object.freeze([-1.08, 0.224, -0.44]),
    center: Object.freeze([0.49, 0.46]),
    aspect: 0.5,
    sizeScale: BEDROOM_LAYOUT.readingSpriteSizeScale,
    next: 'relax',
    label: '卧室小憩 · 点击角色唤醒'
  }),
  back: Object.freeze({
    station: 'reading',
    base: BEDROOM_POINTS.companionReadingBase,
    shadow: Object.freeze([-1.08, 0.224, -0.44]),
    center: Object.freeze([0.49, 0.46]),
    aspect: 0.5,
    sizeScale: BEDROOM_LAYOUT.readingSpriteSizeScale,
    next: 'turn',
    label: '卧室阅读角 · 点击角色回应'
  }),
  turn: Object.freeze({
    station: 'reading',
    base: BEDROOM_POINTS.companionReadingBase,
    shadow: Object.freeze([-1.08, 0.224, -0.44]),
    center: Object.freeze([0.49, 0.46]),
    aspect: 0.5,
    sizeScale: BEDROOM_LAYOUT.readingSpriteSizeScale,
    next: 'relax',
    label: '卧室回应 · 点击角色继续放松'
  }),
  bedSit: Object.freeze({
    station: 'bed',
    base: BEDROOM_POINTS.companionBedBase,
    shadow: Object.freeze([1.14, 0.626, -0.45]),
    center: Object.freeze([0.50, 0.10]),
    aspect: 1,
    sizeScale: 0.78,
    next: 'lying',
    label: '床沿坐稳 · 准备躺下或起身'
  }),
  lying: Object.freeze({
    station: 'bed',
    base: BEDROOM_POINTS.companionBedBase,
    shadow: Object.freeze([1.14, 0.626, -0.45]),
    center: Object.freeze([0.50, 0.29]),
    aspect: 1,
    sizeScale: 0.72,
    next: 'rise',
    label: '床上侧躺小憩 · 点击角色起身回阅读椅'
  }),
  rise: Object.freeze({
    station: 'bed',
    base: BEDROOM_POINTS.companionBedBase,
    shadow: Object.freeze([1.14, 0.626, -0.45]),
    center: Object.freeze([0.50, 0.10]),
    aspect: 1,
    sizeScale: 0.78,
    next: 'relax',
    label: '醒来起身 · 准备回阅读椅'
  }),
  stretch: Object.freeze({
    station: 'reading',
    base: BEDROOM_POINTS.companionReadingBase,
    shadow: Object.freeze([-1.08, 0.224, -0.44]),
    center: Object.freeze([0.50, 0.44]),
    aspect: 1,
    sizeScale: 0.88 * BEDROOM_LAYOUT.readingSpriteSizeScale,
    next: 'relax',
    label: '卧室伸懒腰 · 舒展一下'
  })
});

export function getRoomPoseConfig(room, pose) {
  const table = room === 'bedroom' ? BEDROOM_CONFIGS : STUDY_CONFIGS;
  return table[pose] || table.relax || STUDY_CONFIGS.back;
}

function createRadialShadowTexture() {
  if (typeof document === 'undefined') {
    const data = new Uint8Array([0, 0, 0, 90]);
    const tex = new THREE.DataTexture(data, 1, 1);
    tex.needsUpdate = true;
    return tex;
  }
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  g.addColorStop(0, 'rgba(58, 42, 66, 0.34)');
  g.addColorStop(0.55, 'rgba(58, 42, 66, 0.16)');
  g.addColorStop(1, 'rgba(58, 42, 66, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Manages the `companion` layer group:
 * - Houses the single transparent companion Sprite (with depthTest & alphaTest)
 * - Renders a dedicated grounded contact shadow mesh underneath the companion
 *   so the shadow lands on the floor independently without baking the character into the room map.
 */
export function createCompanionLayer(scene) {
  const group = new THREE.Group();
  group.name = 'companion';
  scene.add(group);

  let disposed = false;
  let boundSprite = null;
  let lamps = null;
  const studyDay = new THREE.Color('#fff9f0');
  const bedroomDay = new THREE.Color('#fff7f2');
  const studyLamp = new THREE.Color('#fff4e9');
  const bedroomLamp = new THREE.Color('#fff0e3');

  const shadowGeo = new THREE.CircleGeometry(0.36, 28);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowTex = createRadialShadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.85,
    depthTest: true,
    depthWrite: false,
    toneMapped: false
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.name = 'companion-ground-shadow';
  shadowMesh.position.set(-0.334, 0.224, -0.75);
  group.add(shadowMesh);

  function bindSprite(sprite) {
    boundSprite = sprite;
    if (sprite && sprite.parent !== group) {
      group.add(sprite);
    }
  }

  function sync({ room = 'study', pose = 'back', settings = { x: 0, y: 0, z: 0, size: 1.7 }, stretch = 1, opacity = 1, shadow }) {
    const cfg = getRoomPoseConfig(room, pose);
    const inBedroom = room === 'bedroom';
    const sx = cfg.shadow[0] + (settings.x || 0);
    const sz = cfg.shadow[2] + (settings.z || 0);
    // The reading and desk rugs sit just above the floor. Put the shadow on
    // the textile at the default anchor while respecting manual repositioning.
    const atAnchor = Math.abs(settings.x || 0) < 0.04 && Math.abs(settings.z || 0) < 0.04;
    let shadowHeight = cfg.shadow[1];
    if (atAnchor && cfg.station === 'reading') shadowHeight = 0.244;
    if (atAnchor && cfg.station === 'desk') shadowHeight = 0.235;
    if (shadow) shadowMesh.position.fromArray(shadow);
    else shadowMesh.position.set(sx, shadowHeight, sz);
    const lamp = lamps?.[room];
    const { x, z } = shadowMesh.position;
    // Use the moving contact anchor so the tint follows the character as
    // she walks away from the lamp or takes a seat.
    const warmth = lamp ? 1 - THREE.MathUtils.smoothstep(Math.hypot(x-lamp[0],z-lamp[2]),.25,1.65) : 0;
    boundSprite?.material.color.copy(inBedroom ? bedroomDay : studyDay)
      .lerp(inBedroom ? bedroomLamp : studyLamp, warmth);
    const breathScale = 1 - (stretch - 1) * 1.2;
    const baseScale = cfg.station === 'desk' ? 1.05 : 0.92;
    shadowMesh.scale.set(baseScale * breathScale, 1, baseScale * 0.82 * breathScale);
    shadowMat.opacity = Math.max(0, Math.min(1, opacity)) * (cfg.station === 'bed' ? 0.72 : 0.92);
  }

  function setSoftLight(value, positions) {
    lamps = value ? positions : null;
  }

  function countVisibleCompanions() {
    let count = 0;
    scene.traverse((o) => {
      if (o.isSprite && o.visible && o.material && o.material.opacity > 0.01) {
        count++;
      }
    });
    return count;
  }

  function getShadowState() {
    return {
      name: shadowMesh.name,
      visible: shadowMesh.visible,
      position: shadowMesh.position.toArray().map((v) => +v.toFixed(3)),
      opacity: +shadowMat.opacity.toFixed(3),
      depthTest: shadowMat.depthTest,
      depthWrite: shadowMat.depthWrite
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    shadowGeo.dispose();
    shadowTex.dispose();
    shadowMat.dispose();
    group.removeFromParent();
  }

  return {
    group,
    shadowMesh,
    bindSprite,
    sync,
    setSoftLight,
    countVisibleCompanions,
    getShadowState,
    dispose
  };
}
