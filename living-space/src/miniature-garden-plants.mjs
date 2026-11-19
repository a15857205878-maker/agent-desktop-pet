import * as THREE from 'three';
import { applyComponentUV } from './cottage-component-uv.mjs';

function createRng(seed = 0) {
  let s = (Math.imul(Math.floor(seed * 1000) || 0, 0x9e3779b1) ^ 0x85ebca6b) >>> 0;
  if (s === 0) s = 0x6d2b79f5;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function appendClosedOctaCore(positions, indices, radiusXZ, radiusY) {
  const baseIdx = positions.length / 3;
  const verts = [
    [radiusXZ, 0, 0],
    [-radiusXZ, 0, 0],
    [0, radiusY, 0],
    [0, -radiusY, 0],
    [0, 0, radiusXZ],
    [0, 0, -radiusXZ]
  ];
  const faces = [
    [0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0],
    [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]
  ];
  for (const [x, y, z] of verts) {
    positions.push(x, y, z);
  }
  for (const [a, b, c] of faces) {
    indices.push(baseIdx + a, baseIdx + b, baseIdx + c);
  }
}

function appendRoundedLobe(positions, indices, {
  origin,
  yaw,
  pitch,
  roll,
  length,
  width,
  thickness,
  arch,
  cup,
  tipDroop
}) {
  const hw = width * 0.5;
  // 12 shared vertices in local lobe space (+Z = length, +Y = up, +X = right):
  // 10-vertex rounded oval/paddle perimeter + top center (10) + bottom center (11) = 20 triangles.
  const local = [
    [0, arch * 0.12, 0],                                            // 0: Base
    [-hw * 0.58, arch * 0.42 + cup * 0.55, length * 0.18],          // 1: Left-base
    [-hw * 0.98, arch * 0.72 + cup, length * 0.44],                 // 2: Left-mid (widest)
    [-hw * 0.90, arch * 0.58 + cup * 0.75, length * 0.72],          // 3: Left-upper
    [-hw * 0.50, arch * 0.18 + tipDroop * 0.65, length * 0.94],     // 4: Left-tip (broad rounded tip)
    [0, tipDroop, length],                                          // 5: Tip-center
    [hw * 0.50, arch * 0.18 + tipDroop * 0.65, length * 0.94],      // 6: Right-tip (broad rounded tip)
    [hw * 0.90, arch * 0.58 + cup * 0.75, length * 0.72],           // 7: Right-upper
    [hw * 0.98, arch * 0.72 + cup, length * 0.44],                  // 8: Right-mid (widest)
    [hw * 0.58, arch * 0.42 + cup * 0.55, length * 0.18],           // 9: Right-base
    [0, arch + thickness, length * 0.50],                           // 10: Top center
    [0, arch - thickness, length * 0.50]                            // 11: Bottom center
  ];

  const euler = new THREE.Euler(-pitch, yaw, roll, 'YXZ');
  const quat = new THREE.Quaternion().setFromEuler(euler);
  const v = new THREE.Vector3();
  const baseIdx = positions.length / 3;

  for (const [lx, ly, lz] of local) {
    v.set(lx, ly, lz).applyQuaternion(quat).add(origin);
    positions.push(v.x, v.y, v.z);
  }

  const tc = baseIdx + 10;
  const bc = baseIdx + 11;
  const rimCount = 10;
  for (let i = 0; i < rimCount; i++) {
    const cur = baseIdx + i;
    const next = baseIdx + ((i + 1) % rimCount);
    indices.push(tc, cur, next);
    indices.push(bc, next, cur);
  }
}

function clampTuftBounds(positions, maxRadius, maxHeight) {
  let maxXZ = 0;
  let maxY = 0;
  for (let i = 0; i < positions.length; i += 3) {
    if (positions[i + 1] < 0) positions[i + 1] = 0;
    const r = Math.hypot(positions[i], positions[i + 2]);
    if (r > maxXZ) maxXZ = r;
    if (positions[i + 1] > maxY) maxY = positions[i + 1];
  }
  const scaleXZ = maxXZ > maxRadius ? maxRadius / maxXZ : 1;
  const scaleY = maxY > maxHeight ? maxHeight / maxY : 1;
  if (scaleXZ < 1 || scaleY < 1) {
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] *= scaleXZ;
      positions[i + 1] *= scaleY;
      positions[i + 2] *= scaleXZ;
    }
  }
}

function clampHeadBounds(positions, maxRadius, maxHalfHeight) {
  let maxXZ = 0;
  let maxAbsY = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const r = Math.hypot(positions[i], positions[i + 2]);
    const ay = Math.abs(positions[i + 1]);
    if (r > maxXZ) maxXZ = r;
    if (ay > maxAbsY) maxAbsY = ay;
  }
  const scaleXZ = maxXZ > maxRadius ? maxRadius / maxXZ : 1;
  const scaleY = maxAbsY > maxHalfHeight ? maxHalfHeight / maxAbsY : 1;
  if (scaleXZ < 1 || scaleY < 1) {
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] *= scaleXZ;
      positions[i + 1] *= scaleY;
      positions[i + 2] *= scaleXZ;
    }
  }
}

function finalizePlantGeometry(positions, indices, uvKind) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  applyComponentUV(geo, { kind: uvKind });
  geo.userData.__cottageUvApplied = true;
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Create a closed, rounded low broadleaf tuft geometry (<= 96 triangles, 20 tri/lobe)
 * with base at y = 0 and bounded local dimensions [-radius, radius] x [0, height].
 */
export function createBroadleafTuftGeometry({
  seed = 0,
  leafCount = 4,
  radius = 0.068,
  height = 0.082
} = {}) {
  const rng = createRng(seed);
  const clampedCount = Math.max(3, Math.min(4, Math.round(leafCount)));
  const safeRadius = Math.max(0.02, radius);
  const safeHeight = Math.max(0.02, height);
  const positions = [];
  const indices = [];

  const origin = new THREE.Vector3();
  const baseYaw = rng() * Math.PI * 2;
  for (let i = 0; i < clampedCount; i++) {
    const yaw = baseYaw + (i / clampedCount) * Math.PI * 2 + (rng() - 0.5) * 0.25;
    const pitch = 0.42 + rng() * 0.28;
    const roll = (rng() - 0.5) * 0.20;
    const rAnchor = safeRadius * (0.04 + rng() * 0.08);
    origin.set(Math.sin(yaw) * rAnchor, safeHeight * (0.05 + rng() * 0.08), Math.cos(yaw) * rAnchor);

    const length = safeRadius * (0.86 + rng() * 0.16);
    const width = length * (0.88 + rng() * 0.16);
    const thickness = safeHeight * (0.18 + rng() * 0.06);
    const arch = safeHeight * (0.42 + rng() * 0.16);
    const cup = safeHeight * (0.12 + rng() * 0.08);
    const tipDroop = -safeHeight * (0.05 + rng() * 0.06);

    appendRoundedLobe(positions, indices, {
      origin,
      yaw,
      pitch,
      roll,
      length,
      width,
      thickness,
      arch,
      cup,
      tipDroop
    });
  }

  clampTuftBounds(positions, safeRadius, safeHeight);
  return finalizePlantGeometry(positions, indices, 'leaf');
}

/**
 * Create a closed, cohesive rounded petal/hydrangea flowerhead geometry (<= 120 triangles)
 * centered at the origin with bounded local dimensions [-radius, radius] x [-height/2, height/2].
 * Uses 10-perimeter-vertex rounded petals (20 tri each) over a fuller rounded inner core (8 tri).
 */
export function createPetalFlowerheadGeometry({
  seed = 0,
  petalCount = 5,
  radius = 0.058,
  height = 0.080
} = {}) {
  const rng = createRng(seed);
  const clampedCount = Math.max(3, Math.min(5, Math.round(petalCount)));
  const safeRadius = Math.max(0.015, radius);
  const safeHalfH = Math.max(0.012, height * 0.5);
  const positions = [];
  const indices = [];

  // Fuller inner rounded core closes airy gaps between petals
  appendClosedOctaCore(positions, indices, safeRadius * 0.70, safeHalfH * 0.88);

  const outerCount = Math.ceil(clampedCount * 0.6);
  const crownCount = clampedCount - outerCount;
  const tiers = [
    { count: outerCount, pitchMin: 0.08, pitchMax: 0.30, rFactor: 0.22, yFactor: -0.14, lenFactor: 0.78, azOffset: rng() * Math.PI * 2 },
    { count: crownCount, pitchMin: 0.52, pitchMax: 0.84, rFactor: 0.12, yFactor: 0.20, lenFactor: 0.72, azOffset: rng() * Math.PI * 2 + 0.62 }
  ];

  const origin = new THREE.Vector3();
  for (const tier of tiers) {
    for (let i = 0; i < tier.count; i++) {
      const yaw = tier.azOffset + (i / Math.max(1, tier.count)) * Math.PI * 2 + (rng() - 0.5) * 0.22;
      const pitch = tier.pitchMin + rng() * (tier.pitchMax - tier.pitchMin);
      const roll = (rng() - 0.5) * 0.18;
      const rAnchor = safeRadius * tier.rFactor;
      origin.set(Math.sin(yaw) * rAnchor, safeHalfH * tier.yFactor, Math.cos(yaw) * rAnchor);

      const length = safeRadius * (tier.lenFactor + rng() * 0.12);
      const width = length * (1.02 + rng() * 0.14);
      const thickness = safeHalfH * (0.28 + rng() * 0.08);
      const arch = safeHalfH * (0.34 + rng() * 0.14);
      const cup = safeHalfH * (0.22 + rng() * 0.10);
      const tipDroop = -safeHalfH * (0.06 + rng() * 0.06);

      appendRoundedLobe(positions, indices, {
        origin,
        yaw,
        pitch,
        roll,
        length,
        width,
        thickness,
        arch,
        cup,
        tipDroop
      });
    }
  }

  clampHeadBounds(positions, safeRadius, safeHalfH);
  return finalizePlantGeometry(positions, indices, 'flower');
}
