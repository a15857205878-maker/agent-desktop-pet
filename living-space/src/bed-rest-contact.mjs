import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const BED_REST_ANCHOR = Object.freeze([1.14, 0.625, -0.45]);

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Normalizes a sprite UV X coordinate across single-frame ([0,1]) and
 * two-frame ([offset.x, offset.x + 0.5]) pose sheets while preserving per-texture offsets.
 */
export function computeNormalizedPoseUvX(vMapUvX, poseFrameBounds, nextPoseBounds) {
  const frameSpan = Math.max(0.0001, poseFrameBounds[1] - poseFrameBounds[0]);
  const uNorm = clamp((vMapUvX - poseFrameBounds[0]) / frameSpan, 0, 1);
  return nextPoseBounds[0] + (nextPoseBounds[1] - nextPoseBounds[0]) * uNorm;
}

function createSoftContactTexture() {
  if (typeof document === 'undefined') {
    const data = new Uint8Array([32, 22, 40, 110]);
    const tex = new THREE.DataTexture(data, 1, 1);
    tex.needsUpdate = true;
    return tex;
  }
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  g.addColorStop(0, 'rgba(48, 34, 62, 0.44)');
  g.addColorStop(0.55, 'rgba(48, 34, 62, 0.20)');
  g.addColorStop(1, 'rgba(48, 34, 62, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const bedContact = {
  bedSit: { tuck: .14, bolster: .25, shadow: .65, elongated: .20 },
  rise: { tuck: .28, bolster: .45, shadow: .78, elongated: .45 },
  lying: { tuck: 1, bolster: 1, shadow: 1, elongated: 1 }
};

// Weight the mattress and linen by the visible pose. A phase boundary can
// request a new drawing while the previous one still rests on the pillow.
export function computeBedContactWeights(phase = 'inactive', pose = 'relax', opacity = 1, blend = null) {
  const op = clamp(Number.isFinite(Number(opacity)) ? Number(opacity) : 1, 0, 1);
  const from = bedContact[pose];
  if (phase === 'inactive' || !from || op <= 0.01) {
    return { active: false, tuck: 0, bolster: 0, shadow: 0, elongated: 0 };
  }
  const to = bedContact[blend?.toPose] ?? from;
  const amount = blend?.weight ?? 0;
  const mix = THREE.MathUtils.lerp;
  return { active: true,
    tuck: mix(from.tuck, to.tuck, amount) * op,
    bolster: mix(from.bolster, to.bolster, amount) * op,
    shadow: mix(from.shadow, to.shadow, amount) * op,
    elongated: mix(from.elongated, to.elongated, amount)
  };
}

/**
 * Independent bed contact layer (pillow bolster, tucked quilt lip, and soft mattress contact shadow)
 * synchronized with companion bed-rest phases. Cleans up completely on cancel/leave/dispose.
 */
export function createBedRestContactLayer(backParent, frontParent) {
  const backGroup = new THREE.Group();
  backGroup.name = 'bed-rest-contact-back';
  const frontGroup = new THREE.Group();
  frontGroup.name = 'bed-rest-contact-front';
  backParent.add(backGroup);
  frontParent.add(frontGroup);

  const shadowTex = createSoftContactTexture();
  const shadowGeo = new THREE.PlaneGeometry(0.76, 0.44);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.name = 'bed-contact-shadow';
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.set(BED_REST_ANCHOR[0] + 0.04, 0.628, BED_REST_ANCHOR[2] + 0.02);
  shadowMesh.visible = false;
  backGroup.add(shadowMesh);

  const bolsterGeo = new RoundedBoxGeometry(0.24, 0.075, 0.38, 2, 0.025);
  const bolsterMat = new THREE.MeshStandardMaterial({
    color: '#d8cef0',
    roughness: 0.9,
    transparent: true,
    opacity: 0
  });
  const bolsterMesh = new THREE.Mesh(bolsterGeo, bolsterMat);
  bolsterMesh.name = 'bed-contact-pillow-bolster';
  bolsterMesh.position.set(1.48, 0.635, -0.47);
  bolsterMesh.rotation.z = 0.16;
  bolsterMesh.visible = false;
  backGroup.add(bolsterMesh);

  // Foreground tucked quilt lip: covers only lower legs/torso (x <= 1.12, top y <= 0.66),
  // leaving face, horns, collar, and sleeves completely unobstructed.
  const lipGeo = new RoundedBoxGeometry(0.54, 0.068, 0.64, 2, 0.024);
  const lipMat = new THREE.MeshStandardMaterial({
    color: '#f5efe6',
    roughness: 0.92,
    transparent: true,
    opacity: 0
  });
  const lipMesh = new THREE.Mesh(lipGeo, lipMat);
  lipMesh.name = 'bed-contact-quilt-lip';
  lipMesh.position.set(0.92, 0.622, -0.34);
  lipMesh.userData.bedroomSpot = 'bed';
  lipMesh.visible = false;
  frontGroup.add(lipMesh);

  let state = {
    active: false,
    phase: 'inactive',
    pose: 'relax',
    tuckWeight: 0,
    bolsterWeight: 0,
    shadowOpacity: 0,
    anchor: [...BED_REST_ANCHOR]
  };

  function reset() {
    shadowMesh.visible = false;
    shadowMat.opacity = 0;
    bolsterMesh.visible = false;
    bolsterMat.opacity = 0;
    lipMesh.visible = false;
    lipMat.opacity = 0;
    state = {
      active: false,
      phase: 'inactive',
      pose: 'relax',
      tuckWeight: 0,
      bolsterWeight: 0,
      shadowOpacity: 0,
      anchor: [...BED_REST_ANCHOR]
    };
  }

  function sync({ active = false, phase = 'inactive', pose = 'relax', opacity = 1, blend = null, breatheDelta = 0 } = {}) {
    if (!active) {
      reset();
      return state;
    }
    const w = computeBedContactWeights(phase, pose, opacity, blend);
    if (!w.active) {
      reset();
      return state;
    }

    shadowMesh.visible = w.shadow > 0.01;
    shadowMat.opacity = w.shadow;
    shadowMesh.scale.set(0.65 + 0.42 * w.elongated, 0.72 + 0.25 * w.elongated, 1);

    bolsterMesh.visible = w.bolster > 0.02;
    bolsterMat.opacity = clamp(w.bolster * 0.92, 0, 1);
    bolsterMesh.scale.set(1, 0.75 + 0.25 * w.bolster, 1);

    lipMesh.visible = w.tuck > 0.02;
    lipMat.opacity = clamp(w.tuck * 0.94, 0, 1);
    lipMesh.position.y = 0.614 + w.tuck * 0.014 + breatheDelta * 0.35;
    lipMesh.scale.set(1, 0.6 + 0.4 * w.tuck, 1);

    state = {
      active: true,
      phase,
      pose,
      tuckWeight: Number(w.tuck.toFixed(4)),
      bolsterWeight: Number(w.bolster.toFixed(4)),
      shadowOpacity: Number(w.shadow.toFixed(4)),
      anchor: [...BED_REST_ANCHOR]
    };
    return state;
  }

  function dispose() {
    reset();
    shadowGeo.dispose();
    shadowMat.dispose();
    shadowTex.dispose();
    bolsterGeo.dispose();
    bolsterMat.dispose();
    lipGeo.dispose();
    lipMat.dispose();
    backGroup.parent?.remove(backGroup);
    frontGroup.parent?.remove(frontGroup);
  }

  return {
    sync,
    reset,
    getState: () => ({ ...state, anchor: [...state.anchor] }),
    dispose
  };
}
