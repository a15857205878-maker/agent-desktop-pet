import * as THREE from 'three';
import { miniatureParts } from './miniature-parts.mjs';
import { createCurvedGrassBladeGeometry, createOrganicPebbleGeometry } from './softness-geometry.mjs';

function createCompactBedStoneGeometry(w, h, d, seed = 0) {
  const geo = new THREE.BoxGeometry(1, 1, 1, 3, 2, 3);
  const pos = geo.attributes.position;
  const hx = w * 0.5;
  const hy = h * 0.5;
  const hz = d * 0.5;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const len = Math.hypot(x, y, z) || 1;
    const ux = x / len;
    const uy = y / len;
    const uz = z / len;
    const theta = Math.atan2(uz, ux);
    const rVar = 0.86 + 0.09 * Math.sin(2 * theta + seed * 1.9) + 0.05 * Math.cos(3 * theta - seed * 1.3);
    const yScale = uy < 0 ? 0.72 : 0.94;
    pos.setXYZ(i, ux * hx * rVar, uy * hy * yScale, uz * hz * rVar);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Restrained exterior garden beds, path-edge stone variation, 1F shutter/flowerbox trim,
 * and porch welcome-mat details for the cottage yard. Batched via miniatureParts so
 * draw calls stay low, walking lanes / door raycasts / bench / tree footprints remain clear,
 * and dispose() removes all owned geometry and materials cleanly.
 */
export function createYardGardenDetails(model) {
  const d = miniatureParts(model, 'yard-garden-details', {
    wood: '#b88f62',
    woodDeep: '#966d43',
    stone: '#d8cbb4',
    stoneWarm: '#c8b99e',
    soil: '#6c5845',
    leaf: '#8da16f',
    leafDeep: '#768b5b',
    lavender: '#b89ec9',
    peach: '#efb69b',
    cream: '#f4e8d6',
    matCoir: '#c9a679',
    matBorder: '#9c7853'
  });
  const { box, add } = d;

  // 1. Low-profile doorstep coir mat on the existing porch step (flush, non-blocking)
  box('porch-welcome-mat-border', 0.48, 0.008, 0.22, 'matBorder', 0.445, 0.143, 0.11);
  box('porch-welcome-mat-center', 0.42, 0.010, 0.16, 'matCoir', 0.445, 0.144, 0.11);

  // 2. Subtle shutter louver rails, strap hinges, and flowerbox lip on 1F windows (away from door)
  for (const x of [-0.55, 0.065]) {
    box('front-shutter-top-rail', 0.135, 0.022, 0.02, 'leafDeep', x, 1.44, -0.048);
    box('front-shutter-bot-rail', 0.135, 0.022, 0.02, 'leafDeep', x, 0.85, -0.048);
    const hingeX = x < -0.25 ? x + 0.045 : x - 0.045;
    box('front-shutter-hinge-top', 0.042, 0.018, 0.016, 'woodDeep', hingeX, 1.38, -0.042);
    box('front-shutter-hinge-bot', 0.042, 0.018, 0.016, 'woodDeep', hingeX, 0.91, -0.042);
  }
  for (const z of [-1.405, -0.64]) {
    box('side-shutter-top-rail', 0.02, 0.022, 0.12, 'leafDeep', 1.911, 1.44, z);
    box('side-shutter-bot-rail', 0.02, 0.022, 0.12, 'leafDeep', 1.911, 0.85, z);
    const hingeZ = z < -1.0 ? z + 0.042 : z - 0.042;
    box('side-shutter-hinge-top', 0.016, 0.018, 0.042, 'woodDeep', 1.916, 1.38, hingeZ);
    box('side-shutter-hinge-bot', 0.016, 0.018, 0.042, 'woodDeep', 1.916, 0.91, hingeZ);
  }
  // Moulded lip on 1F right-side window flowerbox
  box('side-flowerbox-lip', 0.15, 0.022, 0.56, 'woodDeep', 1.93, 0.825, -1.02);

  // 3. Path-edge pebble & stepping-stone variation (exact 8 path-edge-pebble parts, seated on y=0.015 ground)
  const pathEdgeStones = [
    [-0.12, 0.48, 0.13, 0.10, 'stone'],
    [-0.14, 0.88, 0.15, 0.11, 'stoneWarm'],
    [-0.11, 1.28, 0.12, 0.09, 'stone'],
    [-0.13, 1.66, 0.14, 0.10, 'stoneWarm'],
    [0.72, 0.56, 0.12, 0.09, 'stoneWarm'],
    [0.74, 0.98, 0.14, 0.11, 'stone'],
    [0.71, 1.42, 0.13, 0.10, 'stoneWarm'],
    [0.73, 1.76, 0.11, 0.09, 'stone']
  ];
  pathEdgeStones.forEach(([sx, sz, sw, sd, kind], index) => {
    add(
      'path-edge-pebble',
      createOrganicPebbleGeometry(sw, 0.016, sd, index * 1.37 + sx * 2.1 + sz * 0.7),
      kind,
      sx,
      0.020,
      sz
    );
  });

  // 4. Helper builders for cohesive side garden beds, grass clumps, and flower clusters
  function addGrassTuft(gx, gz, scale = 1, baseY = 0.015) {
    const bladeCount = 4;
    for (let i = 0; i < bladeCount; i++) {
      const angle = i * ((Math.PI * 2) / bladeCount) + gx * 2.7 + gz * 1.3;
      const height = (0.062 + (i % 3) * 0.011) * scale;
      const arch = (0.018 + (i % 2) * 0.008) * scale;
      const blade = add(
        'garden-grass-blade',
        createCurvedGrassBladeGeometry(0.014 * scale, height, arch, (i % 2 === 0 ? 1 : -1) * 0.16),
        i % 2 === 0 ? 'leaf' : 'leafDeep',
        gx + Math.sin(angle) * 0.018 * scale,
        baseY + height * 0.42,
        gz + Math.cos(angle) * 0.018 * scale
      );
      blade.rotation.y = angle;
      blade.rotation.x = 0.08 + (i % 2) * 0.06;
    }
  }

  function addWildflowerCluster(fx, fz, bloomKind = 'lavender', baseY = 0.022) {
    addGrassTuft(fx, fz, 0.88, baseY);
    const stem = add(
      'garden-wildflower-stem',
      createCurvedGrassBladeGeometry(0.007, 0.102, 0.012, 0.06),
      'leafDeep',
      fx,
      baseY + 0.048,
      fz
    );
    stem.rotation.y = fx * 2.1;
    for (let j = 0; j < 4; j++) {
      const a = j * 1.57 + fz * 1.7;
      add(
        'garden-wildflower-bloom',
        new THREE.IcosahedronGeometry(0.016, 0),
        bloomKind,
        fx + Math.sin(a) * 0.014,
        baseY + 0.092 + (j % 2) * 0.012,
        fz + Math.cos(a) * 0.014
      );
    }
  }

  function addBedEdgingStones(points) {
    points.forEach(([sx, sz, sw, sd, kind], i) => {
      add(
        'garden-bed-stone',
        createCompactBedStoneGeometry(sw, 0.036, sd, i * 1.9 + sx + sz),
        kind,
        sx,
        0.028,
        sz
      );
    });
  }

  // Cohesive Bed 1: Tree-base & back-left bed (clear of Bench z >= -0.37 and Tree_Trunk)
  add(
    'garden-bed-soil',
    createCompactBedStoneGeometry(0.68, 0.024, 0.42, 0.5),
    'soil',
    -1.36,
    0.022,
    -0.72
  );
  addBedEdgingStones([
    [-1.70, -0.52, 0.12, 0.10, 'stoneWarm'],
    [-1.56, -0.46, 0.11, 0.09, 'stone'],
    [-1.02, -0.50, 0.12, 0.10, 'stoneWarm'],
    [-1.00, -0.84, 0.13, 0.10, 'stone'],
    [-1.64, -0.92, 0.12, 0.10, 'stoneWarm']
  ]);
  addWildflowerCluster(-1.66, -0.58, 'lavender', 0.022);
  addGrassTuft(-1.58, -0.88, 1.05, 0.022);
  addWildflowerCluster(-1.08, -0.84, 'cream', 0.022);
  addWildflowerCluster(-1.05, -0.54, 'peach', 0.020);

  // Cohesive Bed 2: Right-side cottage border bed (clear of planter x <= 1.41, path x <= 0.66, route sign (1.07, 1.64))
  add(
    'garden-bed-soil',
    createCompactBedStoneGeometry(0.28, 0.024, 1.12, 2.1),
    'soil',
    1.68,
    0.022,
    0.96
  );
  addBedEdgingStones([
    [1.54, 0.46, 0.10, 0.11, 'stone'],
    [1.53, 0.72, 0.11, 0.12, 'stoneWarm'],
    [1.54, 1.02, 0.10, 0.11, 'stone'],
    [1.53, 1.32, 0.11, 0.12, 'stoneWarm'],
    [1.56, 1.54, 0.11, 0.10, 'stone']
  ]);
  addGrassTuft(1.66, 0.44, 0.95, 0.024);
  addWildflowerCluster(1.68, 0.68, 'lavender', 0.024);
  addGrassTuft(1.64, 0.96, 1.0, 0.024);
  addWildflowerCluster(1.69, 1.24, 'peach', 0.024);
  addWildflowerCluster(1.66, 1.48, 'cream', 0.024);

  // Cohesive Bed 3: Front-left fence corner bed (clear of Fence_Front z >= 1.88 and actor)
  add(
    'garden-bed-soil',
    createCompactBedStoneGeometry(0.46, 0.024, 0.28, 3.4),
    'soil',
    -1.52,
    0.022,
    1.64
  );
  addBedEdgingStones([
    [-1.74, 1.50, 0.11, 0.10, 'stoneWarm'],
    [-1.56, 1.48, 0.12, 0.09, 'stone'],
    [-1.34, 1.52, 0.11, 0.10, 'stoneWarm'],
    [-1.26, 1.68, 0.10, 0.11, 'stone']
  ]);
  addGrassTuft(-1.68, 1.60, 1.0, 0.024);
  addWildflowerCluster(-1.52, 1.66, 'lavender', 0.024);
  addWildflowerCluster(-1.36, 1.64, 'peach', 0.024);

  d.root.traverse((o) => {
    if (o.isMesh && /mat/.test(o.name)) {
      o.userData.townAction = 'door';
    } else if (o.isMesh && /wildflower|grass/.test(o.name)) {
      o.userData.townAction = 'plants';
    }
  });

  d.finish();

  return {
    root: d.root,
    setNight(night) {
      d.materials.cream.color.set(night ? '#ded0be' : '#f4e8d6');
      d.materials.lavender.color.set(night ? '#a48db8' : '#b89ec9');
      d.materials.peach.color.set(night ? '#d69e86' : '#efb69b');
    },
    getState() {
      return {
        meshCount: d.root.children.length,
        parts: d.root.children.map((c) => c.name)
      };
    },
    dispose() {
      d.dispose();
    }
  };
}
