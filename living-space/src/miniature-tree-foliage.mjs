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

function appendSubdividedOctaCore(positions, indices, radius, yScale = 0.88) {
  const baseVerts = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1]
  ];
  const baseFaces = [
    [0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0],
    [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]
  ];

  const verts = baseVerts.map((v) => v.slice());
  const midpointCache = new Map();

  function getMidpoint(a, b) {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    const existing = midpointCache.get(key);
    if (existing !== undefined) return existing;
    const va = verts[a];
    const vb = verts[b];
    const mx = (va[0] + vb[0]) * 0.5;
    const my = (va[1] + vb[1]) * 0.5;
    const mz = (va[2] + vb[2]) * 0.5;
    const len = Math.hypot(mx, my, mz) || 1;
    const idx = verts.length;
    verts.push([mx / len, my / len, mz / len]);
    midpointCache.set(key, idx);
    return idx;
  }

  const baseIdx = positions.length / 3;
  const subFaces = [];
  for (const [a, b, c] of baseFaces) {
    const ab = getMidpoint(a, b);
    const bc = getMidpoint(b, c);
    const ca = getMidpoint(c, a);
    subFaces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
  }

  for (const [vx, vy, vz] of verts) {
    positions.push(vx * radius, vy * radius * yScale, vz * radius);
  }
  for (const [a, b, c] of subFaces) {
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
  // 10-vertex rounded oval/paddle perimeter + top center (10) + bottom center (11)
  const local = [
    [0, arch * 0.12, 0],                                            // 0: Base
    [-hw * 0.58, arch * 0.42 + cup * 0.55, length * 0.18],          // 1: Left-base
    [-hw * 0.98, arch * 0.72 + cup, length * 0.44],                 // 2: Left-mid (widest)
    [-hw * 0.90, arch * 0.58 + cup * 0.75, length * 0.72],          // 3: Left-upper
    [-hw * 0.48, arch * 0.18 + tipDroop * 0.65, length * 0.94],     // 4: Left-tip (broad rounded tip)
    [0, tipDroop, length],                                          // 5: Tip-center
    [hw * 0.48, arch * 0.18 + tipDroop * 0.65, length * 0.94],      // 6: Right-tip (broad rounded tip)
    [hw * 0.90, arch * 0.58 + cup * 0.75, length * 0.72],           // 7: Right-upper
    [hw * 0.98, arch * 0.72 + cup, length * 0.44],                  // 8: Right-mid (widest)
    [hw * 0.58, arch * 0.42 + cup * 0.55, length * 0.18],           // 9: Right-base
    [0, arch + thickness, length * 0.50],                           // 10: Top center
    [0, arch - thickness, length * 0.50]                            // 11: Bottom center
  ];

  // Euler YXZ: roll around Z, pitch around X (negative pitch tilts +Z upward), yaw around Y
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
    // Top fan (CCW looking from +Y -> outward +Y normal)
    indices.push(tc, cur, next);
    // Bottom fan (reversed winding -> outward -Y normal)
    indices.push(bc, next, cur);
  }
}

/**
 * Create a reusable, closed miniature leaf-cluster geometry centered at the origin
 * with unit radius <= 1.0 and <= 280 triangles.
 * Composed of a rounded, continuous subdivided core plus tiered, softly arched
 * broad paddle/oval leaf lobes with rounded tips and smooth shared normals.
 */
export function createMiniatureLeafCluster({
  seed = 0,
  leafCount = 12,
  coreRadius = 0.62
} = {}) {
  const rng = createRng(seed);
  const clampedLeafCount = Math.max(8, Math.min(12, Math.round(leafCount)));
  const positions = [];
  const indices = [];

  // 1. Rounded continuous core (32 triangles, indexed for smooth shading)
  appendSubdividedOctaCore(positions, indices, coreRadius, 0.88);

  // 2. Tiered broad rounded paddle lobes (20 triangles each, <= 272 total)
  const tier0Count = Math.round(clampedLeafCount * 0.42);
  const tier1Count = Math.round(clampedLeafCount * 0.33);
  const tier2Count = clampedLeafCount - tier0Count - tier1Count;
  const tiers = [
    { count: tier0Count, pitchMin: -0.15, pitchMax: 0.12, rMin: 0.28, rMax: 0.35, yMin: -0.18, yMax: 0.04, lenMin: 0.52, lenMax: 0.60, wMin: 0.54, wMax: 0.64, azOffset: 0.0 },
    { count: tier1Count, pitchMin: 0.25, pitchMax: 0.55, rMin: 0.24, rMax: 0.32, yMin: 0.08, yMax: 0.24, lenMin: 0.48, lenMax: 0.56, wMin: 0.50, wMax: 0.60, azOffset: 0.78 },
    { count: tier2Count, pitchMin: 0.65, pitchMax: 0.98, rMin: 0.12, rMax: 0.20, yMin: 0.24, yMax: 0.36, lenMin: 0.44, lenMax: 0.52, wMin: 0.46, wMax: 0.56, azOffset: 0.42 }
  ];

  const origin = new THREE.Vector3();
  for (const tier of tiers) {
    for (let i = 0; i < tier.count; i++) {
      const yaw = (i / Math.max(1, tier.count)) * Math.PI * 2 + tier.azOffset + (rng() - 0.5) * 0.24;
      const pitch = tier.pitchMin + rng() * (tier.pitchMax - tier.pitchMin);
      const roll = (rng() - 0.5) * 0.26;
      const rAnchor = tier.rMin + rng() * (tier.rMax - tier.rMin);
      const yAnchor = tier.yMin + rng() * (tier.yMax - tier.yMin);
      origin.set(Math.sin(yaw) * rAnchor, yAnchor, Math.cos(yaw) * rAnchor);

      const length = tier.lenMin + rng() * (tier.lenMax - tier.lenMin);
      const width = tier.wMin + rng() * (tier.wMax - tier.wMin);
      const thickness = 0.055 + rng() * 0.020;
      const arch = 0.065 + rng() * 0.030;
      const cup = 0.022 + rng() * 0.018;
      const tipDroop = -(0.025 + rng() * 0.030);

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

  // Clamp all vertices strictly inside unit sphere (max radius <= 0.995 <= 1.0)
  let maxR = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const r = Math.hypot(positions[i], positions[i + 1], positions[i + 2]);
    if (r > maxR) maxR = r;
  }
  if (maxR > 0.995) {
    const scale = 0.995 / maxR;
    for (let i = 0; i < positions.length; i++) {
      positions[i] *= scale;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  applyComponentUV(geo, { kind: 'leaf' });
  geo.userData.__cottageUvApplied = true;
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Create a closed miniature pome/berry fruit geometry with a subtle 5-lobe silhouette
 * and a soft top stem dimple, bounded within the original sphere radius envelope.
 */
export function createMiniatureFruitGeometry(radius = 0.085, seed = 0) {
  const geo = new THREE.SphereGeometry(radius, 12, 8);
  const pos = geo.attributes.position;
  const phase = seed * 1.37;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const ny = Math.max(-1, Math.min(1, y / Math.max(1e-6, radius)));
    const theta = Math.atan2(z, x);

    const equat = 1 - ny * ny;
    const lobe = 1 + 0.045 * Math.cos(5 * theta + phase) * equat;
    const belly = 1 + 0.04 * Math.sin((ny + 0.25) * Math.PI) * equat;

    x *= lobe * belly;
    z *= lobe * belly;

    if (ny > 0.65) {
      const topFactor = (ny - 0.65) / 0.35;
      y -= radius * 0.18 * topFactor * topFactor;
    } else if (ny < -0.75) {
      const botFactor = (-ny - 0.75) / 0.25;
      y += radius * 0.07 * botFactor * botFactor;
    }

    const r = Math.hypot(x, y, z);
    if (r > radius) {
      const clampScale = radius / r;
      x *= clampScale;
      y *= clampScale;
      z *= clampScale;
    }

    pos.setXYZ(i, x, y, z);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}
