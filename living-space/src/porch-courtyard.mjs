import * as THREE from 'three';
import { miniatureParts } from './miniature-parts.mjs';
import { createOrganicPebbleGeometry, createSoftRollGeometry } from './softness-geometry.mjs';

export function createPorchCourtyard(model) {
  const d = miniatureParts(model, 'porch-courtyard-joinery', {
    wood: '#b38e65',
    edge: '#d2ad7a',
    stone: '#d9cbb1',
    lavender: '#baa4c5',
    peach: '#efb69b',
    linen: '#f3e8d6',
    leaf: '#9aa77e',
    soil: '#6b5946',
    brass: { color: '#c4a36a', metalness: 0.25, roughness: 0.62 },
    glow: { color: '#f9e1b1', emissive: '#ffc77a', emissiveIntensity: 0.04, roughness: 0.65 }
  });
  const { box, add } = d;

  // 1. Oak door jambs, header, and corner mortise blocks (clear of Prop_FrontDoor pivot)
  for (const x of [0.035, 0.855]) {
    box('oak-door-jamb', 0.048, 1.48, 0.056, 'wood', x, 0.805, -0.035);
    box('oak-door-jamb-base', 0.062, 0.075, 0.066, 'stone', x, 0.095, -0.035);
    box('oak-door-corner-tenon', 0.054, 0.054, 0.064, 'edge', x, 1.545, -0.035);
  }
  box('oak-door-header', 0.91, 0.058, 0.062, 'wood', 0.445, 1.55, -0.035);

  // 2. Crafted Porch Canopy: pitched board roof, front fascia, side bargeboards, capitals & stone plinths
  const canopyBase = box('porch-canopy-deck', 1.10, 0.044, 0.43, 'edge', 0.445, 1.648, 0.10);
  canopyBase.rotation.x = 0.08;
  for (let i = 0; i < 3; i++) {
    const z = -0.02 + i * 0.125;
    const y = 1.678 - i * 0.011;
    const course = box('porch-canopy', 1.12, 0.022, 0.145, i % 2 === 0 ? 'wood' : 'edge', 0.445, y, z);
    course.rotation.x = 0.12;
  }
  box('canopy-front-fascia', 1.13, 0.068, 0.046, 'wood', 0.445, 1.598, 0.305);
  box('canopy-front-moulding', 1.15, 0.024, 0.052, 'edge', 0.445, 1.635, 0.312);
  for (const x of [-0.105, 0.995]) {
    const barge = box('canopy-side-barge', 0.036, 0.055, 0.45, 'wood', x, 1.622, 0.10);
    barge.rotation.x = 0.08;
  }

  for (const x of [-0.025, 0.915]) {
    box('canopy-wall-bracket', 0.056, 0.21, 0.072, 'wood', x, 1.48, -0.005);
    const brace = box('canopy-diagonal-support', 0.050, 0.25, 0.046, 'wood', x, 1.49, 0.095);
    brace.rotation.x = 0.60;
    box('canopy-brace-peg', 0.058, 0.018, 0.018, 'edge', x, 1.55, 0.035);

    // Oak post with top capital, bottom collar & chamfered stone plinth seated on ground (y=0.015)
    box('porch-front-oak-post', 0.048, 1.48, 0.048, 'wood', x, 0.82, 0.28);
    box('porch-post-capital', 0.072, 0.044, 0.072, 'edge', x, 1.545, 0.28);
    box('porch-post-collar', 0.064, 0.036, 0.064, 'edge', x, 0.115, 0.28);
    box('porch-post-stone-foot', 0.088, 0.082, 0.088, 'stone', x, 0.056, 0.28);
  }

  // 3. Porch Lantern (mounted away from existing door pivot and handle; day/night shares glow material)
  box('lantern-wall-plate', 0.088, 0.175, 0.028, 'brass', 1.04, 1.31, -0.045);
  box('lantern-arm', 0.024, 0.026, 0.145, 'brass', 1.04, 1.38, 0.035);
  box('lantern-glass', 0.102, 0.150, 0.102, 'glow', 1.04, 1.265, 0.11);
  for (const y of [1.18, 1.35]) {
    box('lantern-copper-cap', 0.142, 0.024, 0.142, 'brass', 1.04, y, 0.11);
  }
  box('lantern-copper-roof', 0.095, 0.032, 0.095, 'brass', 1.04, 1.375, 0.11);
  add('lantern-finial', new THREE.SphereGeometry(0.016, 8, 6), 'brass', 1.04, 1.402, 0.11);
  for (const x of [0.984, 1.096]) {
    box('lantern-copper-upright', 0.012, 0.155, 0.012, 'brass', x, 1.265, 0.17);
  }

  // Restrained linen textile trim tucked under canopy fascia (clear of door and bench)
  const canopyTrim = add('porch-canopy-textile-trim', createSoftRollGeometry(0.88, 0.014), 'linen', 0.445, 1.558, 0.295);
  canopyTrim.rotation.z = Math.PI / 2;

  // 4. Grounded sandstone threshold nosing & path stepping stones (seated at y=0.015+)
  box('sandstone-step-nosing', 0.96, 0.044, 0.175, 'stone', 0.445, 0.054, 0.375);
  for (const sx of [-0.015, 0.905]) {
    box('sandstone-step-cheek', 0.055, 0.068, 0.21, 'stone', sx, 0.049, 0.355);
  }
  for (let i = 0; i < 3; i++) {
    add(
      'rounded-path-stone',
      createOrganicPebbleGeometry(0.38, 0.020, 0.24, 1.5 + i * 2.1),
      'stone',
      0.44 - i * 0.13,
      0.025,
      0.68 + i * 0.34
    );
  }

  // 5. Right-hand flowerbox planter joinery & cohesive floral cluster (preserves [1.25, 0.36, 0.75] click)
  box('planter-front-oak-rail', 0.42, 0.048, 0.036, 'edge', 1.20, 0.31, 0.89);
  box('planter-top-lip', 0.435, 0.024, 0.30, 'wood', 1.20, 0.355, 0.77);
  box('planter-soil-bed', 0.36, 0.026, 0.22, 'soil', 1.20, 0.365, 0.77);
  for (const x of [1.035, 1.365]) {
    add('planter-brass-pin', new THREE.SphereGeometry(0.012, 8, 6), 'brass', x, 0.31, 0.913);
  }
  for (let i = 0; i < 3; i++) {
    const x = 1.07 + i * 0.13;
    const z = 0.77 + (i % 2) * 0.032;
    for (let j = 0; j < 4; j++) {
      const a = j * (Math.PI / 2) + i * 0.4;
      const m = add('planter-leaf', new THREE.OctahedronGeometry(0.062, 0), 'leaf', x + Math.sin(a) * 0.036, 0.40, z + Math.cos(a) * 0.036);
      m.scale.set(1, 0.42, 1);
    }
    for (let j = 0; j < 4; j++) {
      const a = j * 2.4 + i * 0.7;
      const mat = j === 3 ? 'peach' : 'lavender';
      add(
        'lavender-flower-cluster',
        new THREE.IcosahedronGeometry(0.032, 0),
        mat,
        x + Math.sin(a) * 0.028,
        0.475 + (j % 2) * 0.022,
        z + Math.cos(a) * 0.028
      );
    }
  }

  // Keep facade pieces selectable as the door, while plants retain their action.
  d.root.traverse((o) => {
    if (o.isMesh && /door|canopy|lantern/.test(o.name)) {
      o.userData.townAction = 'door';
    }
    if (o.isMesh && /planter|flower/.test(o.name)) {
      o.userData.townAction = 'plants';
    }
  });

  d.finish();
  return {
    ...d,
    setNight(night) {
      d.materials.glow.emissiveIntensity = night ? 1.2 : 0.04;
    }
  };
}
