import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyComponentUV } from './cottage-component-uv.mjs';
import { createMiniatureLeafCluster } from './miniature-tree-foliage.mjs';
import { createBroadleafTuftGeometry, createPetalFlowerheadGeometry } from './miniature-garden-plants.mjs';

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
function createPicketGeometry(width = 0.052, height = 0.39, thickness = 0.020) {
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
 * Create a ring/annulus slab aligned with bottom at y = 0 and top at y = height.
 */
function createRingDiscGeometry(outerRadius, innerRadius, height, segments = 24) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelSize: 0.004,
    bevelThickness: 0.003,
    bevelSegments: 1,
    curveSegments: segments,
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
 * Create a slender tapered cylinder segment between two 3D points for fruit stems.
 */
function createStemGeometry(p0, p1, rBottom = 0.013, rTop = 0.008, radialSegments = 5) {
  const dir = new THREE.Vector3().subVectors(p1, p0);
  const len = Math.max(0.005, dir.length());
  const geo = new THREE.CylinderGeometry(rTop, rBottom, len, radialSegments, 1);
  const nonIdx = geo.index ? geo.toNonIndexed() : geo;
  if (nonIdx !== geo) geo.dispose();
  applyComponentUV(nonIdx, { kind: 'wood', shape: 'cylinder', axis: 'y' });
  nonIdx.userData.__cottageUvApplied = true;
  const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  const mat = new THREE.Matrix4().compose(mid, quat, new THREE.Vector3(1, 1, 1));
  nonIdx.applyMatrix4(mat);
  return nonIdx;
}

/**
 * Cozy miniature diorama refinements for the town plaza and orchard.
 * Preserves all existing interactive targets, route signs, benches, lamps,
 * fountain, soil rings, harvest-owned tree canopies, and harvest fruits.
 */
export function createCozyTownDistrictDetails({ plaza = null, orchard = null } = {}) {
  const materials = {
    soil: new THREE.MeshStandardMaterial({ name: 'town-cozy-soil', color: '#8e6b4e', roughness: 0.94 }),
    wood: new THREE.MeshStandardMaterial({ name: 'town-cozy-wood', color: '#c49662', roughness: 0.84 }),
    wallCream: new THREE.MeshStandardMaterial({ name: 'town-cozy-wallCream', color: '#eee4d3', roughness: 0.88 }),
    stone: new THREE.MeshStandardMaterial({ name: 'town-cozy-stone', color: '#ded2bd', roughness: 0.92 }),
    grass: new THREE.MeshStandardMaterial({ name: 'town-cozy-grass', color: '#9eb87d', roughness: 0.90 }),
    leaf: new THREE.MeshStandardMaterial({ name: 'town-cozy-leaf', color: '#82a673', roughness: 0.86 }),
    leafShade: new THREE.MeshStandardMaterial({ name: 'town-cozy-leafShade', color: '#63875e', roughness: 0.88 }),
    leafLight: new THREE.MeshStandardMaterial({ name: 'town-cozy-leafLight', color: '#a4b48a', roughness: 0.86 }),
    flowerLavender: new THREE.MeshStandardMaterial({ name: 'town-cozy-flowerLavender', color: '#bba1d4', roughness: 0.86 }),
    flowerPeach: new THREE.MeshStandardMaterial({ name: 'town-cozy-flowerPeach', color: '#eab5a0', roughness: 0.86 }),
    metalGold: new THREE.MeshStandardMaterial({ name: 'town-cozy-metalGold', color: '#dfb35c', roughness: 0.35, metalness: 0.45 })
  };

  const hiddenRecords = [];
  const createdGeometries = [];
  const crownRoots = [];

  function hideNode(node) {
    if (!node) return;
    hiddenRecords.push({ node, prevVisible: node.visible });
    node.visible = false;
  }

  function hideTaggedBaseParts(group) {
    if (!group) return;
    group.traverse((obj) => {
      if (obj.isMesh && (obj.userData?.townBasePart === 'plinth' || obj.userData?.townBasePart === 'grass' || obj.userData?.townBasePart === 'path')) {
        hideNode(obj);
      }
    });
  }

  function createBucketCollector(root, namePrefix, { decorativeOnly = true } = {}) {
    const buckets = new Map();

    function pushGeo(geo, kind, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
      const nonIdx = geo.index ? geo.toNonIndexed() : geo.clone();
      if (sx !== 1 || sy !== 1 || sz !== 1) nonIdx.scale(sx, sy, sz);
      if (!geo.userData?.__cottageUvApplied) {
        applyComponentUV(nonIdx, { kind });
      }
      if (rx) nonIdx.rotateX(rx);
      if (ry) nonIdx.rotateY(ry);
      if (rz) nonIdx.rotateZ(rz);
      if (x || y || z) nonIdx.translate(x, y, z);
      if (!buckets.has(kind)) buckets.set(kind, []);
      buckets.get(kind).push(nonIdx);
      geo.dispose();
    }

    function finalize() {
      let meshCount = 0;
      let triangleCount = 0;
      for (const [kind, list] of buckets.entries()) {
        if (!list.length) continue;
        const merged = mergeGeometries(list, false);
        for (const g of list) g.dispose();
        if (!merged) continue;
        createdGeometries.push(merged);
        const mesh = new THREE.Mesh(merged, materials[kind]);
        mesh.name = `${namePrefix}-${kind}`;
        mesh.castShadow = kind !== 'grass';
        mesh.receiveShadow = true;
        if (decorativeOnly) {
          mesh.userData.decorativeOnly = true;
        }
        root.add(mesh);
        meshCount++;
        triangleCount += merged.attributes.position.count / 3;
      }
      return { root, meshCount, triangleCount: Math.round(triangleCount) };
    }

    return { pushGeo, finalize };
  }

  function createDistrictBuilder(districtName, parentGroup) {
    const root = new THREE.Group();
    root.name = `cozy-town-${districtName}-details`;
    if (parentGroup) parentGroup.add(root);

    const { pushGeo, finalize } = createBucketCollector(root, `town-cozy-${districtName}`, { decorativeOnly: true });

    function addIslandBase() {
      // Rounded earth plinth [-2, 2], bottom -0.25, top -0.04
      pushGeo(createRoundedSlabGeometry(4.0, 4.0, 0.21, 0.15, 0.012, 4), 'soil', 0, -0.25, 0);
      // Warm honey wood rim [-0.043, 0.002]
      pushGeo(createRoundedSlabGeometry(4.0, 4.0, 0.045, 0.15, 0.008, 4), 'wood', 0, -0.043, 0);
      // Soft green lawn top [0, 0.025]
      pushGeo(createRoundedSlabGeometry(3.92, 3.92, 0.025, 0.13, 0.004, 4), 'grass', 0, 0.0, 0);

      // Partly embedded pale soil stones along the plinth sides
      const plinthStones = [
        [-1.12, -0.14, 1.98, 0.068, 0.042, 0.036, 0.15],
        [0.92, -0.15, 1.98, 0.075, 0.044, 0.036, -0.12],
        [1.98, -0.14, 0.78, 0.036, 0.042, 0.072, 0.2],
        [1.98, -0.15, -0.74, 0.036, 0.040, 0.066, -0.15],
        [-1.98, -0.14, 0.45, 0.036, 0.042, 0.068, 0.1]
      ];
      for (const [sx, sy, sz, rx, ry, rz, rotY] of plinthStones) {
        pushGeo(new THREE.IcosahedronGeometry(1, 1), 'stone', sx, sy, sz, 0, rotY, 0, rx, ry, rz);
      }
    }

    function addHydrangeaPlanter(cx, cz) {
      // Low honey-wood planter box at ground level (y = 0.025..0.195)
      pushGeo(new THREE.BoxGeometry(0.36, 0.16, 0.25), 'wood', cx, 0.105, cz);
      pushGeo(new THREE.BoxGeometry(0.39, 0.026, 0.28), 'wood', cx, 0.192, cz);
      pushGeo(new THREE.BoxGeometry(0.32, 0.02, 0.21), 'soil', cx, 0.188, cz);

      // Soft rounded basal broadleaf tufts
      const baseSeed = Math.round((cx * 17 + cz * 31) * 10);
      pushGeo(
        createBroadleafTuftGeometry({ seed: baseSeed + 1, leafCount: 4, radius: 0.145, height: 0.095 }),
        'leafShade',
        cx - 0.02,
        0.195,
        cz
      );
      pushGeo(
        createBroadleafTuftGeometry({ seed: baseSeed + 2, leafCount: 4, radius: 0.135, height: 0.090 }),
        'leaf',
        cx + 0.03,
        0.198,
        cz + 0.01
      );

      // 3 cohesive rounded hydrangea bouquets (~1.35 * radius height) with soft two-tone accent florets
      const heads = [
        [cx - 0.08, 0.275, cz - 0.01, 0.066, 0.090, 5, 'flowerLavender', 'flowerPeach'],
        [cx + 0.02, 0.300, cz + 0.02, 0.072, 0.098, 5, 'flowerLavender', 'flowerPeach'],
        [cx + 0.09, 0.265, cz - 0.02, 0.062, 0.084, 5, 'flowerPeach', 'flowerLavender']
      ];
      for (let i = 0; i < heads.length; i++) {
        const [hx, hy, hz, r, h, petals, primaryMat, altMat] = heads[i];
        pushGeo(
          createPetalFlowerheadGeometry({ seed: baseSeed + 10 + i * 3, petalCount: petals, radius: r, height: h }),
          primaryMat,
          hx,
          hy,
          hz
        );
        pushGeo(
          createPetalFlowerheadGeometry({ seed: baseSeed + 11 + i * 3, petalCount: 4, radius: r * 0.56, height: h * 0.56 }),
          altMat,
          hx + (i === 1 ? -0.026 : 0.024),
          hy + h * 0.14,
          hz + 0.020
        );
      }
    }

    function addCornerPlants(corners) {
      for (let idx = 0; idx < corners.length; idx++) {
        const [gx, gz] = corners[idx];
        const seed = Math.round((gx * 13 + gz * 29) * 10) + idx * 7;
        pushGeo(
          createBroadleafTuftGeometry({ seed: seed + 1, leafCount: 4, radius: 0.088, height: 0.085 }),
          'leafShade',
          gx,
          0.025,
          gz
        );
        pushGeo(
          createBroadleafTuftGeometry({ seed: seed + 2, leafCount: 3, radius: 0.070, height: 0.075 }),
          'leaf',
          gx + 0.014,
          0.025,
          gz - 0.012
        );
        pushGeo(
          createPetalFlowerheadGeometry({ seed: seed + 3, petalCount: 5, radius: 0.042, height: 0.058 }),
          'flowerLavender',
          gx - 0.028,
          0.105,
          gz + 0.018
        );
        pushGeo(
          createPetalFlowerheadGeometry({ seed: seed + 4, petalCount: 5, radius: 0.038, height: 0.052 }),
          'flowerPeach',
          gx + 0.028,
          0.098,
          gz - 0.018
        );
      }
    }

    return { root, pushGeo, addIslandBase, addHydrangeaPlanter, addCornerPlants, finalize };
  }

  // --- PLAZA (kept unchanged) ---
  const plazaBuilder = createDistrictBuilder('plaza', plaza);
  if (plaza) {
    hideTaggedBaseParts(plaza);
    plazaBuilder.addIslandBase();

    // Warm pale paving apron around existing fountain centered at (0, -0.2)
    plazaBuilder.pushGeo(createRingDiscGeometry(1.04, 0.72, 0.014, 24), 'stone', 0, 0.025, -0.2);
    plazaBuilder.pushGeo(createRingDiscGeometry(0.95, 0.89, 0.015, 24), 'wallCream', 0, 0.026, -0.2);

    // Warm pale stone paving strips replacing the hidden straight grey paths (y = 0.025..0.040, below map-detail paving at 0.061)
    plazaBuilder.pushGeo(createRoundedSlabGeometry(0.72, 1.24, 0.014, 0.08, 0.004, 3), 'stone', 0, 0.025, 1.24);
    plazaBuilder.pushGeo(createRoundedSlabGeometry(1.06, 0.76, 0.014, 0.08, 0.004, 3), 'stone', -1.18, 0.025, -0.35);
    plazaBuilder.pushGeo(createRoundedSlabGeometry(1.06, 0.76, 0.014, 0.08, 0.004, 3), 'stone', 1.18, 0.025, -0.35);

    // Understated honey-wood gable canopy above the noticeboard at (0, 0, -1.42)
    // Kept strictly above y = 1.18 so the 'manage' board face (y = 0.85) stays 100% unoccluded.
    for (const bx of [-0.33, 0.33]) {
      plazaBuilder.pushGeo(new THREE.BoxGeometry(0.045, 0.14, 0.06), 'wood', bx, 1.23, -1.42);
    }
    const pitch = 0.34;
    plazaBuilder.pushGeo(new THREE.BoxGeometry(0.94, 0.032, 0.24), 'wood', 0, 1.32, -1.32, pitch, 0, 0);
    plazaBuilder.pushGeo(new THREE.BoxGeometry(0.94, 0.032, 0.24), 'wood', 0, 1.32, -1.52, -pitch, 0, 0);
    plazaBuilder.pushGeo(new THREE.BoxGeometry(0.96, 0.036, 0.05), 'wood', 0, 1.375, -1.42);

    // 2 lavender/peach planters near back margins beside the noticeboard
    plazaBuilder.addHydrangeaPlanter(-0.76, -1.65);
    plazaBuilder.addHydrangeaPlanter(0.76, -1.65);

    // Low planted corners (well clear of route signs at (±1.25, 1.42), benches, and actor)
    plazaBuilder.addCornerPlants([
      [-1.74, 1.74],
      [1.74, 1.74],
      [-1.74, -1.74],
      [1.74, -1.74]
    ]);
  }
  const plazaResult = plazaBuilder.finalize();

  // --- ORCHARD ---
  const orchardBuilder = createDistrictBuilder('orchard', orchard);
  let crownMeshes = 0;
  let crownTriangles = 0;

  if (orchard) {
    hideTaggedBaseParts(orchard);
    orchardBuilder.addIslandBase();

    // Gently staggered flagstone stepping pads along center path (y = 0.025..0.040, below map-detail flagstones at 0.062)
    const steppingPads = [
      [-0.03, -1.62, 0.52, 0.28, 0.05],
      [0.03, -1.24, 0.50, 0.27, -0.06],
      [-0.02, -0.86, 0.54, 0.28, 0.04],
      [0.04, -0.48, 0.50, 0.27, -0.05],
      [-0.03, -0.10, 0.52, 0.28, 0.03],
      [0.03, 0.28, 0.52, 0.28, -0.04],
      [-0.02, 0.66, 0.50, 0.27, 0.05],
      [0.03, 1.04, 0.54, 0.28, -0.03],
      [-0.03, 1.42, 0.50, 0.27, 0.04],
      [0.02, 1.76, 0.48, 0.25, -0.04],
      // Gentle branch stones toward the bench at (1.17, 1.1)
      [0.44, 1.04, 0.32, 0.22, 0.08],
      [0.78, 1.08, 0.30, 0.21, -0.06]
    ];
    for (let i = 0; i < steppingPads.length; i++) {
      const [px, pz, pw, pd, rotY] = steppingPads[i];
      const matKind = i % 3 === 0 ? 'wallCream' : 'stone';
      orchardBuilder.pushGeo(createRoundedSlabGeometry(pw, pd, 0.015, 0.065, 0.004, 3), matKind, px, 0.025, pz, 0, rotY, 0);
    }

    // Short pointed wooden side fences along x = ±1.85 with small lilac post-cap accents
    const postZs = [-1.7, -0.8, 0.1, 1.0, 1.7];
    for (const fx of [-1.85, 1.85]) {
      const outward = fx < 0 ? -0.018 : 0.018;
      for (const pz of postZs) {
        orchardBuilder.pushGeo(new THREE.BoxGeometry(0.086, 0.022, 0.086), 'flowerLavender', fx, 0.551, pz);
        orchardBuilder.pushGeo(new THREE.SphereGeometry(0.018, 8, 6), 'metalGold', fx, 0.576, pz);
      }
      for (let i = 0; i < 24; i++) {
        const pz = -1.64 + i * 0.142;
        if (postZs.some((p) => Math.abs(p - pz) < 0.075)) continue;
        orchardBuilder.pushGeo(createPicketGeometry(0.052, 0.39, 0.020), 'wood', fx + outward, 0.040, pz, 0, Math.PI / 2, 0);
      }
    }

    // Replace ONLY original tree foliage meshes; parent new canopy under each original town-tree
    // so whole-tree harvest ownership is preserved without touching decorative plants.
    const treeGroups = [];
    orchard.traverse((obj) => {
      if (obj.name === 'town-tree' && obj.userData?.townAction === 'harvest') {
        treeGroups.push(obj);
      }
    });

    // Lower/rear clusters wrap the branch-fruit zone naturally while keeping front fruits and points.harvest visible.
    const crownClusters = [
      // Lower & rear clusters around branches (y = 1.08..1.38)
      [-0.34, 1.14, -0.10, 0.24, 0.18, 0.22, 'leafShade'],
      [0.02, 1.16, -0.28, 0.25, 0.19, 0.23, 'leafShade'],
      [0.24, 1.24, -0.22, 0.22, 0.18, 0.21, 'leafShade'],
      [-0.28, 1.28, 0.16, 0.22, 0.17, 0.20, 'leafShade'],
      [-0.12, 1.32, -0.32, 0.26, 0.20, 0.24, 'leafShade'],
      [0.08, 1.32, 0.16, 0.21, 0.16, 0.19, 'leaf'],
      // Mid crown clusters (y = 1.40..1.62)
      [-0.30, 1.44, -0.06, 0.26, 0.20, 0.24, 'leaf'],
      [0.26, 1.48, -0.12, 0.24, 0.19, 0.22, 'leaf'],
      [-0.02, 1.48, -0.10, 0.28, 0.21, 0.26, 'leaf'],
      [-0.12, 1.54, 0.14, 0.25, 0.19, 0.23, 'leaf'],
      [0.11, 1.56, 0.09, 0.24, 0.19, 0.22, 'leaf'],
      // Upper crown clusters (y = 1.66..1.84)
      [-0.02, 1.72, -0.04, 0.27, 0.21, 0.25, 'leafLight'],
      [-0.20, 1.68, -0.06, 0.22, 0.17, 0.21, 'leafLight'],
      [0.15, 1.68, -0.08, 0.21, 0.17, 0.20, 'leafLight']
    ];

    // Short tapered curved twigs arching from nearby branches into each of the 3 fruit top dimples
    const fruitTwigArcs = [
      [new THREE.Vector3(-0.08, 1.30, 0.25), new THREE.Vector3(-0.15, 1.31, 0.37), new THREE.Vector3(-0.20, 1.228, 0.46)],
      [new THREE.Vector3(0.14, 1.54, 0.26), new THREE.Vector3(0.21, 1.55, 0.37), new THREE.Vector3(0.26, 1.488, 0.46)],
      [new THREE.Vector3(0.28, 1.21, 0.08), new THREE.Vector3(0.38, 1.21, 0.13), new THREE.Vector3(0.45, 1.148, 0.18)]
    ];

    for (let t = 0; t < treeGroups.length; t++) {
      const tg = treeGroups[t];
      for (const child of tg.children) {
        if (child.isMesh && (child.name === 'tree-leaf' || child.name === 'tree-shade' || child.name === 'tree-light')) {
          hideNode(child);
        }
      }

      const tx = tg.position.x;
      const tz = tg.position.z;
      for (const [p0, pMid, p1] of fruitTwigArcs) {
        const w0 = new THREE.Vector3(tx + p0.x, p0.y, tz + p0.z);
        const wMid = new THREE.Vector3(tx + pMid.x, pMid.y, tz + pMid.z);
        const w1 = new THREE.Vector3(tx + p1.x, p1.y, tz + p1.z);
        orchardBuilder.pushGeo(createStemGeometry(w0, wMid, 0.015, 0.010, 5), 'wood');
        orchardBuilder.pushGeo(createStemGeometry(wMid, w1, 0.010, 0.006, 5), 'wood');
      }

      const canopyGroup = new THREE.Group();
      canopyGroup.name = 'cozy-town-tree-canopy';
      tg.add(canopyGroup);
      crownRoots.push(canopyGroup);

      const treeCollector = createBucketCollector(canopyGroup, `town-cozy-tree-${t}`, { decorativeOnly: false });
      for (let idx = 0; idx < crownClusters.length; idx++) {
        const [dx, dy, dz, rx, ry, rz, kind] = crownClusters[idx];
        const phase = t * 2.31 + idx * 1.17;
        const jx = Math.sin(phase * 1.3) * 0.032;
        const jy = Math.cos(phase * 1.7) * 0.025;
        const jz = Math.sin(phase * 2.1) * 0.032;
        const rotX = Math.sin(phase * 0.9) * 0.18;
        const rotY = (t * 2.09 + idx * 1.37) % (Math.PI * 2);
        const rotZ = Math.cos(phase * 1.1) * 0.18;
        treeCollector.pushGeo(
          createMiniatureLeafCluster({ seed: t * 29 + idx * 5.3 }),
          kind,
          dx + jx,
          dy + jy,
          dz + jz,
          rotX,
          rotY,
          rotZ,
          rx,
          ry,
          rz
        );
      }
      const treeRes = treeCollector.finalize();
      crownMeshes += treeRes.meshCount;
      crownTriangles += treeRes.triangleCount;
    }

    // Low fruit basket/crate in right margin at (1.45, 0.15) — outside route, bench, and actor clear zones
    const bx = 1.45;
    const bz = 0.15;
    orchardBuilder.pushGeo(new THREE.BoxGeometry(0.32, 0.025, 0.22), 'wood', bx, 0.037, bz);
    for (const dz of [-0.10, 0.10]) {
      orchardBuilder.pushGeo(new THREE.BoxGeometry(0.32, 0.045, 0.022), 'wood', bx, 0.075, bz + dz);
      orchardBuilder.pushGeo(new THREE.BoxGeometry(0.32, 0.045, 0.022), 'wood', bx, 0.135, bz + dz);
    }
    for (const dx of [-0.15, 0.15]) {
      orchardBuilder.pushGeo(new THREE.BoxGeometry(0.022, 0.045, 0.22), 'wood', bx + dx, 0.075, bz);
      orchardBuilder.pushGeo(new THREE.BoxGeometry(0.022, 0.045, 0.22), 'wood', bx + dx, 0.135, bz);
      for (const dz of [-0.10, 0.10]) {
        orchardBuilder.pushGeo(new THREE.BoxGeometry(0.032, 0.145, 0.032), 'wood', bx + dx, 0.097, bz + dz);
      }
    }
    const basketFruits = [
      [bx - 0.07, 0.09, bz - 0.03, 'flowerPeach'],
      [bx + 0.01, 0.095, bz + 0.03, 'metalGold'],
      [bx + 0.08, 0.09, bz - 0.02, 'flowerPeach'],
      [bx - 0.02, 0.135, bz - 0.01, 'flowerPeach'],
      [bx + 0.05, 0.13, bz + 0.03, 'metalGold']
    ];
    for (const [fx, fy, fz, kind] of basketFruits) {
      orchardBuilder.pushGeo(new THREE.IcosahedronGeometry(0.040, 1), kind, fx, fy, fz);
    }

    // Low planted back corners
    orchardBuilder.addCornerPlants([
      [-1.70, -1.70],
      [1.70, -1.70]
    ]);
  }
  const orchardResult = orchardBuilder.finalize();

  let night = false;
  let disposed = false;

  return {
    roots: {
      plaza: plazaResult.root,
      orchard: orchardResult.root,
      crowns: crownRoots
    },
    setNight(value) {
      if (disposed) return;
      night = !!value;
    },
    getState() {
      return {
        night,
        disposed,
        meshCount: plazaResult.meshCount + orchardResult.meshCount + crownMeshes,
        materialCount: Object.keys(materials).length,
        triangleCount: plazaResult.triangleCount + orchardResult.triangleCount + crownTriangles,
        plazaMeshes: plazaResult.meshCount,
        orchardMeshes: orchardResult.meshCount,
        crownMeshes,
        crownRoots: crownRoots.length,
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
      plazaResult.root.removeFromParent();
      orchardResult.root.removeFromParent();
      for (const cr of crownRoots) cr.removeFromParent();
    }
  };
}
