import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyComponentUV } from './cottage-component-uv.mjs';
import { createMiniatureLeafCluster } from './miniature-tree-foliage.mjs';

/**
 * Create a rounded-rectangle extruded slab aligned so its bottom sits at y = 0
 * and its top sits at y = height (after bevel).
 */
function createRoundedSlabGeometry(width, depth, height, radius, bevel = 0.008, curveSegments = 4) {
  const b = Math.min(bevel, width * 0.15, depth * 0.15, height * 0.35);
  const hw = Math.max(0.01, width * 0.5 - b);
  const hd = Math.max(0.01, depth * 0.5 - b);
  const r = Math.min(Math.max(0.005, radius - b), hw * 0.9, hd * 0.9);

  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

  const innerH = Math.max(0.002, height - 2 * b);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerH,
    bevelEnabled: b > 0.0005,
    bevelSize: b,
    bevelThickness: b,
    bevelSegments: 2,
    curveSegments,
    steps: 1
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  if (geo.boundingBox) {
    geo.translate(0, -geo.boundingBox.min.y, 0);
  }
  return geo;
}

/**
 * Create a wooden picket with a softly pointed/rounded top arch, bottom at y = 0.
 */
function createPicketGeometry(width = 0.054, height = 0.41, thickness = 0.022) {
  const hw = width * 0.5;
  const shoulderY = height - width * 0.65;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, shoulderY);
  shape.quadraticCurveTo(hw * 0.6, height - 0.004, 0, height);
  shape.quadraticCurveTo(-hw * 0.6, height - 0.004, -hw, shoulderY);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSize: 0.003,
    bevelThickness: 0.003,
    bevelSegments: 1,
    curveSegments: 2,
    steps: 1
  });
  geo.translate(0, 0, -thickness * 0.5);
  return geo;
}

/**
 * Create a tapered cylinder segment between two 3D points for organic tree trunk/branches.
 */
function createLimbGeometry(p0, p1, rBottom, rTop, radialSegments = 7) {
  const dir = new THREE.Vector3().subVectors(p1, p0);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(rTop, rBottom, len, radialSegments, 1);
  const nonIdx = geo.index ? geo.toNonIndexed() : geo;
  if (nonIdx !== geo) geo.dispose();
  applyComponentUV(nonIdx, { kind: 'woodDeep', shape: 'cylinder', axis: 'y' });
  nonIdx.userData.__cottageUvApplied = true;
  const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const mat = new THREE.Matrix4().compose(mid, quat, new THREE.Vector3(1, 1, 1));
  nonIdx.applyMatrix4(mat);
  return nonIdx;
}

/**
 * Reference-aligned Yard Details:
 * - Rounded earth plinth + honey wood rim + soft green lawn (top y = 0.015, bounds [-2, 2], bottom -0.25)
 *   plus partly embedded pale soil stones.
 * - Rounded/pointed wooden picket fence with honey frame, pale-lavender post caps, and brass finials,
 *   preserving gate/path openings and route/door/plant rays.
 * - 4 larger rounded stepping pavers in the center lane (x ~ 0.3, z ~ 0.58..1.62, top ~ 0.035).
 * - Soft clustered broad-leaf home tree at (-1.35, 0, -0.65) replacing low-poly home-detailed-tree.
 * - 2 cohesive lilac/blush hydrangea multi-bloom clusters rooted in porch/side planters + restrained corner grass.
 */
export function createReferenceYardDetails(model) {
  const root = new THREE.Group();
  root.name = 'reference-yard-details';
  model.add(root);

  // Record and hide specific existing meshes/groups; restore exact prior visibility on dispose()
  const hiddenRecords = [];
  function hideNode(node) {
    if (!node) return;
    hiddenRecords.push({ node, prevVisible: node.visible });
    node.visible = false;
  }

  hideNode(model.getObjectByName('Ground_Courtyard_Mesh'));
  hideNode(model.getObjectByName('Ground_Courtyard_Mesh_1'));
  hideNode(model.getObjectByName('Fence_Front'));
  hideNode(model.getObjectByName('Fence_Back'));
  hideNode(model.getObjectByName('Stone_Path'));

  const homeTreeOld = model.getObjectByName('home-detailed-tree');
  if (homeTreeOld) {
    hideNode(homeTreeOld);
  } else {
    hideNode(model.getObjectByName('Tree_Trunk'));
    hideNode(model.getObjectByName('Tree_Canopy'));
  }

  // Hide old sparse path pebbles & planter dot flowers from porch-courtyard if present
  const porchGroup = model.getObjectByName('porch-courtyard-joinery');
  if (porchGroup) {
    porchGroup.traverse((o) => {
      if (o.isMesh && (o.name === 'rounded-path-stone' || o.name === 'lavender-flower-cluster')) {
        hideNode(o);
      }
    });
  }

  // Materials clearly named so createCozyYardFinish harmonizes palette seamlessly
  const materials = {
    soil: new THREE.MeshStandardMaterial({ name: 'ref-yard-soil', color: '#8e6b4e', roughness: 0.94 }),
    wood: new THREE.MeshStandardMaterial({ name: 'ref-yard-wood', color: '#c49662', roughness: 0.84 }),
    woodDeep: new THREE.MeshStandardMaterial({ name: 'ref-yard-woodDeep-bark', color: '#8a623d', roughness: 0.88 }),
    mat_grass: new THREE.MeshStandardMaterial({ name: 'ref-yard-mat_grass', color: '#9eb87d', roughness: 0.90 }),
    stone: new THREE.MeshStandardMaterial({ name: 'ref-yard-stone', color: '#ded2bd', roughness: 0.92 }),
    flowerLavender: new THREE.MeshStandardMaterial({ name: 'ref-yard-flowerLavender', color: '#bba1d4', roughness: 0.86 }),
    flowerPeach: new THREE.MeshStandardMaterial({ name: 'ref-yard-flowerPeach', color: '#eab5a0', roughness: 0.86 }),
    metalGold: new THREE.MeshStandardMaterial({ name: 'ref-yard-metalGold', color: '#dfb35c', roughness: 0.35, metalness: 0.45 }),
    leafDeep: new THREE.MeshStandardMaterial({ name: 'ref-yard-leafDeep', color: '#63875e', roughness: 0.88 }),
    leaf: new THREE.MeshStandardMaterial({ name: 'ref-yard-leaf', color: '#82a673', roughness: 0.86 })
  };

  const buckets = new Map();
  const createdGeometries = [];

  function pushGeo(geo, kind, action = null, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const nonIdx = geo.index ? geo.toNonIndexed() : geo.clone();
    if (sx !== 1 || sy !== 1 || sz !== 1) nonIdx.scale(sx, sy, sz);
    if (!geo.userData?.__cottageUvApplied) {
      applyComponentUV(nonIdx, { kind });
    }
    if (rx) nonIdx.rotateX(rx);
    if (ry) nonIdx.rotateY(ry);
    if (rz) nonIdx.rotateZ(rz);
    if (x || y || z) nonIdx.translate(x, y, z);
    const key = `${kind}|${action || ''}`;
    if (!buckets.has(key)) buckets.set(key, { kind, action, list: [] });
    buckets.get(key).list.push(nonIdx);
    geo.dispose();
  }

  // 1. Rounded Earth Plinth + Honey Wood Rim + Soft Green Lawn (bounds [-2, 2], bottom -0.25, top 0.015)
  pushGeo(createRoundedSlabGeometry(4.0, 4.0, 0.21, 0.22, 0.012, 4), 'soil', null, 0, -0.25, 0);
  pushGeo(createRoundedSlabGeometry(4.0, 4.0, 0.044, 0.22, 0.008, 4), 'wood', null, 0, -0.042, 0);
  pushGeo(createRoundedSlabGeometry(3.92, 3.92, 0.015, 0.19, 0.004, 4), 'mat_grass', null, 0, 0.0, 0);

  // Partly embedded pale soil stones along the plinth sides
  const plinthStones = [
    [-1.12, -0.14, 1.98, 0.068, 0.042, 0.036, 0.15],
    [0.92, -0.15, 1.98, 0.075, 0.044, 0.036, -0.12],
    [1.98, -0.14, 0.78, 0.036, 0.042, 0.072, 0.2],
    [1.98, -0.15, -0.74, 0.036, 0.040, 0.066, -0.15],
    [-1.98, -0.14, 0.45, 0.036, 0.042, 0.068, 0.1]
  ];
  for (const [sx, sy, sz, rx, ry, rz, rotY] of plinthStones) {
    pushGeo(new THREE.IcosahedronGeometry(1, 1), 'stone', null, sx, sy, sz, 0, rotY, 0, rx, ry, rz);
  }

  // 2. 4 Larger Rounded Stepping Pavers in Center Lane (x ~ 0.3, z ~ 0.58..1.62, top = 0.035)
  const pavers = [
    [0.36, 0.60, 0.34, 0.22, 0.04],
    [0.28, 0.94, 0.36, 0.23, -0.05],
    [0.33, 1.28, 0.35, 0.22, 0.03],
    [0.26, 1.62, 0.34, 0.22, -0.04]
  ];
  for (const [px, pz, pw, pd, rotY] of pavers) {
    pushGeo(createRoundedSlabGeometry(pw, pd, 0.023, 0.065, 0.006, 3), 'stone', null, px, 0.012, pz, 0, rotY, 0);
  }

  // 3. Rounded/Pointed Wooden Picket Fence + Honey Frame + Pale-Lavender Post Caps + Brass Finials
  function addFencePost(px, pz) {
    pushGeo(new THREE.BoxGeometry(0.074, 0.48, 0.074), 'wood', null, px, 0.255, pz);
    pushGeo(new THREE.BoxGeometry(0.094, 0.030, 0.094), 'flowerLavender', null, px, 0.510, pz);
    pushGeo(new THREE.SphereGeometry(0.022, 8, 6), 'metalGold', null, px, 0.542, pz);
  }

  function addFenceRun(x0, z0, x1, z1, postFracs = [0, 1]) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz); // rotation around Y so local +Z aligns with (dx, dz)
    const rotY = Math.atan2(-dz, dx); // rotation around Y so local +X aligns with (dx, dz)

    // Two horizontal honey-wood rails
    const mx = (x0 + x1) * 0.5;
    const mz = (z0 + z1) * 0.5;
    for (const ry of [0.145, 0.355]) {
      pushGeo(new THREE.BoxGeometry(len, 0.038, 0.030), 'wood', null, mx, ry, mz, 0, rotY, 0);
    }

    // Pickets spaced ~0.125m apart, skipping near posts
    const postPositions = postFracs.map((t) => t * len);
    const step = 0.125;
    const count = Math.max(2, Math.floor(len / step));
    const ux = dx / len;
    const uz = dz / len;
    // Offset pickets slightly outward (+normal) on rails
    const nx = uz * 0.016;
    const nz = -ux * 0.016;

    for (let i = 1; i < count; i++) {
      const d = (i / count) * len;
      if (postPositions.some((p) => Math.abs(p - d) < 0.072)) continue;
      const px = x0 + ux * d + nx;
      const pz = z0 + uz * d + nz;
      pushGeo(createPicketGeometry(0.054, 0.41, 0.020), 'wood', null, px, 0.045, pz, 0, rotY, 0);
    }
    void angle;
  }

  // Posts: corners, gateposts, and intermediate posts
  const posts = [
    [-1.90, 1.92],
    [-1.05, 1.92],
    [-0.21, 1.92], // left gatepost
    [0.68, 1.92],  // right gatepost (cap clears center lane x <= 0.62)
    [1.29, 1.92],
    [1.90, 1.92],
    [-1.90, 0.96],
    [-1.90, 0.0],
    [-1.90, -0.95],
    [-1.90, -1.90],
    [1.90, 0.96],
    [1.90, 0.0],
    [1.90, -0.95],
    [1.90, -1.90],
    [-0.95, -1.90],
    [0.0, -1.90],
    [0.95, -1.90]
  ];
  for (const [px, pz] of posts) {
    addFencePost(px, pz);
  }

  // 5 Fence runs (preserving gate opening x in [-0.21, 0.68])
  addFenceRun(-1.90, 1.92, -0.21, 1.92, [0, 0.5, 1]);
  addFenceRun(0.68, 1.92, 1.90, 1.92, [0, 0.5, 1]);
  addFenceRun(-1.90, 1.92, -1.90, -1.90, [0, 0.25, 0.5, 0.75, 1]);
  addFenceRun(1.90, -1.90, 1.90, 1.92, [0, 0.25, 0.5, 0.75, 1]);
  addFenceRun(1.90, -1.90, -1.90, -1.90, [0, 0.25, 0.5, 0.75, 1]);

  // 4. Soft Clustered Broad-Leaf Home Tree at (-1.35, 0, -0.65)
  const tx = -1.35;
  const tz = -0.65;
  // Grounded trunk + flared root buttresses + primary branches
  const trunkPts = [
    new THREE.Vector3(tx, 0.015, tz),
    new THREE.Vector3(tx - 0.02, 0.65, tz - 0.02),
    new THREE.Vector3(tx + 0.02, 1.25, tz - 0.01),
    new THREE.Vector3(tx, 1.68, tz - 0.03)
  ];
  pushGeo(createLimbGeometry(trunkPts[0], trunkPts[1], 0.145, 0.115, 8), 'woodDeep');
  pushGeo(createLimbGeometry(trunkPts[1], trunkPts[2], 0.115, 0.092, 8), 'woodDeep');
  pushGeo(createLimbGeometry(trunkPts[2], trunkPts[3], 0.092, 0.068, 7), 'woodDeep');

  // 4 flared roots grounded at y = 0.015
  for (let i = 0; i < 4; i++) {
    const a = i * (Math.PI / 2) + 0.4;
    const p0 = new THREE.Vector3(tx + Math.cos(a) * 0.20, 0.015, tz + Math.sin(a) * 0.20);
    const p1 = new THREE.Vector3(tx + Math.cos(a) * 0.06, 0.22, tz + Math.sin(a) * 0.06);
    pushGeo(createLimbGeometry(p0, p1, 0.062, 0.038, 6), 'woodDeep');
  }

  // Primary and secondary branches reaching into lobed crown
  const branches = [
    [trunkPts[2], new THREE.Vector3(tx - 0.36, 1.78, tz - 0.18), 0.060, 0.032],
    [trunkPts[2], new THREE.Vector3(tx + 0.34, 1.76, tz + 0.10), 0.056, 0.030],
    [trunkPts[3], new THREE.Vector3(tx - 0.24, 2.08, tz + 0.26), 0.050, 0.026],
    [trunkPts[3], new THREE.Vector3(tx + 0.22, 2.12, tz - 0.24), 0.050, 0.026],
    [trunkPts[3], new THREE.Vector3(tx - 0.04, 2.26, tz - 0.04), 0.046, 0.024],
    [new THREE.Vector3(tx - 0.20, 1.56, tz - 0.10), new THREE.Vector3(tx - 0.40, 1.94, tz + 0.04), 0.032, 0.018],
    [new THREE.Vector3(tx + 0.18, 1.54, tz + 0.04), new THREE.Vector3(tx + 0.30, 1.94, tz - 0.06), 0.030, 0.016]
  ];
  for (const [b0, b1, r0, r1] of branches) {
    pushGeo(createLimbGeometry(b0, b1, r0, r1, 6), 'woodDeep');
  }

  // Soft lobed broad-leaf foliage clusters (staying within x <= -0.52 and x >= -2.02)
  const canopyClusters = [
    // [x, y, z, rx, ry, rz, kind]
    [tx - 0.34, 1.74, tz - 0.18, 0.28, 0.20, 0.26, 'leafDeep'],
    [tx + 0.30, 1.72, tz + 0.08, 0.26, 0.19, 0.25, 'leafDeep'],
    [tx - 0.05, 1.78, tz - 0.34, 0.28, 0.20, 0.26, 'leafDeep'],
    [tx - 0.22, 1.88, tz + 0.28, 0.26, 0.19, 0.25, 'leafDeep'],
    [tx + 0.14, 1.92, tz - 0.28, 0.26, 0.20, 0.25, 'leafDeep'],
    [tx - 0.40, 1.96, tz + 0.04, 0.25, 0.19, 0.24, 'leaf'],
    [tx + 0.32, 1.96, tz - 0.04, 0.25, 0.19, 0.24, 'leaf'],
    [tx - 0.20, 2.14, tz - 0.18, 0.29, 0.21, 0.27, 'leaf'],
    [tx + 0.18, 2.16, tz + 0.16, 0.27, 0.20, 0.26, 'leaf'],
    [tx - 0.28, 2.18, tz + 0.22, 0.25, 0.19, 0.24, 'leaf'],
    [tx + 0.04, 2.26, tz - 0.20, 0.27, 0.20, 0.26, 'leaf'],
    [tx - 0.04, 2.42, tz - 0.02, 0.30, 0.22, 0.28, 'leaf'],
    [tx - 0.22, 2.38, tz + 0.06, 0.24, 0.18, 0.23, 'leaf'],
    [tx + 0.16, 2.36, tz - 0.08, 0.23, 0.18, 0.22, 'leaf']
  ];
  for (let idx = 0; idx < canopyClusters.length; idx++) {
    const [cx, cy, cz, rx, ry, rz, kind] = canopyClusters[idx];
    const phase = idx * 1.43 + 0.5;
    const jx = Math.sin(phase * 1.1) * 0.024;
    const jy = Math.cos(phase * 1.5) * 0.020;
    const jz = Math.sin(phase * 1.9) * 0.024;
    const rotX = Math.sin(phase * 0.8) * 0.16;
    const rotY = (idx * 1.71) % (Math.PI * 2);
    const rotZ = Math.cos(phase * 1.2) * 0.16;
    pushGeo(
      createMiniatureLeafCluster({ seed: 101 + idx * 7.3 }),
      kind,
      null,
      cx + jx,
      cy + jy,
      cz + jz,
      rotX,
      rotY,
      rotZ,
      rx,
      ry,
      rz
    );
  }

  // 5. Two Cohesive Lilac/Blush Hydrangea Multi-Bloom Clusters Rooted in Planters
  function addHydrangeaPlanterCluster(cx, soilY, cz, heads) {
    // Broad basal foliage leaves
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const lx = cx + Math.cos(a) * 0.095;
      const lz = cz + Math.sin(a) * 0.080;
      const leafKind = i % 2 === 0 ? 'leafDeep' : 'leaf';
      pushGeo(new THREE.IcosahedronGeometry(1, 1), leafKind, 'plants', lx, soilY + 0.045, lz, 0, a, 0, 0.075, 0.032, 0.055);
    }
    // Dense multi-bloom hemispherical hydrangea heads
    for (const [hx, hy, hz, r, primaryMat] of heads) {
      const altMat = primaryMat === 'flowerLavender' ? 'flowerPeach' : 'flowerLavender';
      pushGeo(new THREE.IcosahedronGeometry(r * 0.72, 1), primaryMat, 'plants', hx, hy, hz);
      for (let j = 0; j < 7; j++) {
        const a = j * 0.897 + hx * 5.0;
        const elev = j < 5 ? 0.25 : 0.72;
        const dist = r * (j < 5 ? 0.56 : 0.30);
        const fx = hx + Math.cos(a) * dist;
        const fy = hy + Math.sin(elev) * r * 0.42;
        const fz = hz + Math.sin(a) * dist;
        const mat = j % 3 === 0 ? altMat : primaryMat;
        pushGeo(new THREE.IcosahedronGeometry(r * 0.42, 1), mat, 'plants', fx, fy, fz);
      }
    }
  }

  // Right-side planter (porch-courtyard planter soil at x=1.20, y=0.365, z=0.77)
  addHydrangeaPlanterCluster(1.20, 0.365, 0.77, [
    [1.11, 0.47, 0.75, 0.072, 'flowerLavender'],
    [1.24, 0.50, 0.74, 0.078, 'flowerLavender'],
    [1.27, 0.45, 0.83, 0.068, 'flowerPeach']
  ]);

  // Left-side porch planter (Planters soil at x ~ -0.32, y ~ 0.225, z ~ 0.34)
  addHydrangeaPlanterCluster(-0.32, 0.225, 0.34, [
    [-0.39, 0.33, 0.32, 0.070, 'flowerLavender'],
    [-0.27, 0.36, 0.33, 0.076, 'flowerLavender'],
    [-0.29, 0.31, 0.41, 0.066, 'flowerPeach']
  ]);

  // 6. Restrained Grass Tufts Near Fence Corners (leaving central lawn & actor zone open)
  const cornerTufts = [
    [-1.72, 1.72],
    [1.72, 1.72],
    [-1.72, -1.72],
    [1.72, -1.72]
  ];
  for (const [gx, gz] of cornerTufts) {
    for (let i = 0; i < 4; i++) {
      const a = i * (Math.PI / 2) + 0.4;
      pushGeo(
        new THREE.ConeGeometry(0.018, 0.085, 4),
        'mat_grass',
        null,
        gx + Math.cos(a) * 0.032,
        0.052,
        gz + Math.sin(a) * 0.032,
        Math.sin(a) * 0.22,
        a,
        -Math.cos(a) * 0.22
      );
    }
  }

  // Finalize batched meshes
  let meshCount = 0;
  let triangleCount = 0;
  for (const { kind, action, list } of buckets.values()) {
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (!merged) continue;
    createdGeometries.push(merged);
    const mesh = new THREE.Mesh(merged, materials[kind]);
    mesh.name = `ref-yard-${kind}${action ? `-${action}` : ''}`;
    mesh.castShadow = kind !== 'mat_grass';
    mesh.receiveShadow = true;
    if (action) {
      mesh.userData.townAction = action;
    }
    root.add(mesh);
    meshCount++;
    triangleCount += merged.attributes.position.count / 3;
  }

  let night = false;
  let disposed = false;

  return {
    root,
    setNight(value) {
      if (disposed) return;
      night = !!value;
    },
    getState() {
      return {
        night,
        disposed,
        meshCount,
        materialCount: Object.keys(materials).length,
        triangleCount: Math.round(triangleCount),
        hiddenOriginals: hiddenRecords.length
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const rec of hiddenRecords) {
        rec.node.visible = rec.prevVisible;
      }
      for (const g of createdGeometries) g.dispose();
      for (const m of Object.values(materials)) m.dispose();
      root.removeFromParent();
    }
  };
}
