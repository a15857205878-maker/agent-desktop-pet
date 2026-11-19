import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyComponentUV } from './cottage-component-uv.mjs';

/**
 * Create a compact chamfered/beveled box geometry for miniature timber,
 * shingles, and window framing without excessive triangle overhead.
 */
function createChamferBoxGeometry(w, h, d, bevel = 0.008) {
  const b = Math.min(bevel, w * 0.24, h * 0.24, d * 0.24);
  if (b <= 0.0005) {
    return new THREE.BoxGeometry(w, h, d);
  }
  const hw = w * 0.5 - b;
  const hh = h * 0.5 - b;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hh - b);
  shape.lineTo(hw, -hh - b);
  shape.quadraticCurveTo(hw + b, -hh - b, hw + b, -hh);
  shape.lineTo(hw + b, hh);
  shape.quadraticCurveTo(hw + b, hh + b, hw, hh + b);
  shape.lineTo(-hw, hh + b);
  shape.quadraticCurveTo(-hw - b, hh + b, -hw - b, hh);
  shape.lineTo(-hw - b, -hh);
  shape.quadraticCurveTo(-hw - b, -hh - b, -hw, -hh - b);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, d - 2 * b),
    bevelEnabled: true,
    bevelSize: b,
    bevelThickness: b,
    bevelSegments: 1,
    curveSegments: 2,
    steps: 1
  });
  geo.translate(0, 0, -(d - 2 * b) * 0.5);
  return geo;
}

/**
 * Incremental Two-Story Cottage Exterior for the Yard Scene.
 * - Keeps yard.glb byte-for-byte intact; hides original single-story Roof at runtime and restores on dispose().
 * - Preserves Prop_FrontDoor pivot, Bench, Tree_Trunk/Tree_Canopy (x <= -0.61), Planters, and courtyard open space.
 * - Batches static meshes by material (<= 12 draw calls) for handcrafted miniature shingle, dormer, and shutter craft.
 */
export function createTwoStoryExterior(model) {
  const root = new THREE.Group();
  root.name = 'two-story-cottage-exterior';
  model.add(root);

  const originalRoof = model.getObjectByName('Roof');
  const prevRoofVisible = originalRoof ? originalRoof.visible : true;
  if (originalRoof) {
    originalRoof.visible = false;
  }

  const materials = {
    wallCream: new THREE.MeshStandardMaterial({ color: '#f3e7d3', roughness: 0.92 }),
    wood: new THREE.MeshStandardMaterial({ color: '#c49662', roughness: 0.84 }),
    woodDeep: new THREE.MeshStandardMaterial({ color: '#9c7144', roughness: 0.86 }),
    roofTile: new THREE.MeshStandardMaterial({ color: '#d7a46b', roughness: 0.82 }),
    roofTileAlt: new THREE.MeshStandardMaterial({ color: '#c99358', roughness: 0.84 }),
    shutterSage: new THREE.MeshStandardMaterial({ color: '#8fa372', roughness: 0.86 }),
    windowGlow: new THREE.MeshStandardMaterial({
      color: '#fae3b4',
      emissive: '#ffbe6b',
      emissiveIntensity: 0.04,
      roughness: 0.55
    }),
    windowGlass: new THREE.MeshStandardMaterial({
      color: '#dfecee',
      roughness: 0.16,
      metalness: 0.08,
      transparent: true,
      opacity: 0.30
    }),
    flowerLavender: new THREE.MeshStandardMaterial({ color: '#bba1cf', roughness: 0.88 }),
    flowerPeach: new THREE.MeshStandardMaterial({ color: '#efb69b', roughness: 0.88 }),
    flowerCream: new THREE.MeshStandardMaterial({ color: '#f5dff0', roughness: 0.88 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#859c67', roughness: 0.86 })
  };

  const buckets = new Map();
  const createdGeometries = [];

  function pushGeo(geo, kind, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const nonIdx = geo.index ? geo.toNonIndexed() : geo.clone();
    applyComponentUV(nonIdx, { kind });
    if (rx) nonIdx.rotateX(rx);
    if (ry) nonIdx.rotateY(ry);
    if (rz) nonIdx.rotateZ(rz);
    if (x || y || z) nonIdx.translate(x, y, z);
    if (!buckets.has(kind)) buckets.set(kind, []);
    buckets.get(kind).push(nonIdx);
    geo.dispose();
  }

  function addBox(w, h, d, kind, x, y, z, rx = 0, ry = 0, rz = 0) {
    pushGeo(new THREE.BoxGeometry(w, h, d), kind, x, y, z, rx, ry, rz);
  }

  function addChamferBox(w, h, d, kind, x, y, z, rx = 0, ry = 0, rz = 0, bevel = 0.008) {
    pushGeo(createChamferBoxGeometry(w, h, d, bevel), kind, x, y, z, rx, ry, rz);
  }

  // Footprint aligned above 1F walls: x in [-0.52, 1.88], z in [-1.74, -0.05]
  const xMin = -0.52;
  const xMax = 1.88;
  const xMid = (xMin + xMax) / 2; // 0.68
  const halfSpanX = (xMax - xMin) / 2; // 1.20
  const zMin = -1.74;
  const zMax = -0.05;
  const zMid = (zMin + zMax) / 2; // -0.895
  const depthZ = zMax - zMin; // 1.69

  // 1. Second-story main cream-white wall volume (y: 1.62 .. 2.66)
  addBox(xMax - xMin, 1.04, depthZ, 'wallCream', xMid, 2.14, zMid);

  // 2. Gable triangular prism infill (y: 2.66 .. 3.48)
  const gablePeakY = 3.48;
  const eavesY = 2.66;
  const gableHeight = gablePeakY - eavesY; // 0.82
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-halfSpanX, 0);
  gableShape.lineTo(halfSpanX, 0);
  gableShape.lineTo(0, gableHeight);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, {
    depth: depthZ,
    bevelEnabled: false,
    steps: 1
  });
  pushGeo(gableGeo, 'wallCream', xMid, eavesY, zMin);

  // 3. Honey-warm timber framing with chamfered beams, corner posts, and eave corbels
  // Horizontal belt beam separating 1F & 2F
  addChamferBox(xMax - xMin + 0.09, 0.078, depthZ + 0.07, 'wood', xMid, 1.63, zMid, 0, 0, 0, 0.010);
  // Corner vertical posts (2F)
  for (const px of [xMin - 0.01, xMax + 0.01]) {
    for (const pz of [zMin + 0.02, zMax - 0.02]) {
      addChamferBox(0.078, 1.08, 0.078, 'wood', px, 2.14, pz, 0, 0, 0, 0.009);
    }
  }
  // Front & back upper horizontal beams at eavesY
  for (const pz of [zMax + 0.015, zMin - 0.015]) {
    addChamferBox(xMax - xMin + 0.07, 0.070, 0.064, 'wood', xMid, eavesY, pz, 0, 0, 0, 0.008);
  }
  // Right & left side upper horizontal beams + small eave corbel brackets
  for (const px of [xMax + 0.015, xMin - 0.015]) {
    addChamferBox(0.064, 0.070, depthZ + 0.05, 'wood', px, eavesY, zMid, 0, 0, 0, 0.008);
  }
  for (const bz of [zMin + 0.16, zMid, zMax - 0.16]) {
    addChamferBox(0.065, 0.085, 0.045, 'woodDeep', xMax + 0.015, eavesY - 0.055, bz, 0, 0, 0, 0.006);
  }
  // Front facade gable king-post + diagonal braces + peak finial block
  addChamferBox(0.058, gableHeight - 0.04, 0.054, 'wood', xMid, eavesY + gableHeight / 2, zMax + 0.015, 0, 0, 0, 0.007);
  for (const sign of [-1, 1]) {
    addChamferBox(0.050, 0.62, 0.048, 'wood', xMid + sign * 0.42, eavesY + 0.24, zMax + 0.015, 0, 0, sign * 0.68, 0.006);
  }
  // Front facade diagonal timber braces on upper 2F wall (flanking 2F front window, clear of shutters)
  // Left bay: from (0.02, 1.67) up-left to (-0.48, 2.60)
  addChamferBox(0.052, 1.05, 0.048, 'wood', -0.23, 2.135, zMax + 0.015, 0, 0, 0.493, 0.006);
  // Right bay: from (0.94, 1.67) up-right to (1.84, 2.60)
  addChamferBox(0.052, 1.28, 0.048, 'wood', 1.39, 2.135, zMax + 0.015, 0, 0, -0.769, 0.006);
  // Right-side mid-wall vertical timber studs
  addChamferBox(0.056, 1.04, 0.060, 'wood', xMax + 0.015, 2.14, zMid - 0.42, 0, 0, 0, 0.007);
  addChamferBox(0.056, 1.04, 0.060, 'wood', xMax + 0.015, 2.14, zMid + 0.42, 0, 0, 0, 0.007);

  // 4. Crafted Miniature Shingle Gable Roof (deck + 7 overlapping staggered shingle courses + ridge cap + bargeboards)
  const slopeAngle = Math.atan2(gableHeight, halfSpanX); // ~0.599 rad
  const slopeLen = Math.hypot(halfSpanX + 0.07, gableHeight + 0.05);
  const roofDepth = depthZ + 0.24; // 1.93, overhangs front & back (maxZ ~ 0.09)
  const roofCenterZ = zMid + 0.02; // -0.875
  const roofNormY = Math.cos(slopeAngle);
  const roofNormX = Math.sin(slopeAngle);

  // Dormer exclusion zone on right slope (+1) so shingles never intersect enlarged dormer walls
  const dormerZ = -0.88;
  const dormerHalfW = 0.24;
  const dormerMinX = 0.94;
  const dormerMaxX = 1.62;

  const courseCount = 7;
  const colsPerCourse = 7;
  const colStep = (roofDepth - 0.08) / colsPerCourse;

  for (const sign of [-1, 1]) {
    const midX = xMid + sign * (halfSpanX / 2 + 0.015);
    const midY = (eavesY + gablePeakY) / 2 - 0.015;
    // Solid pitched roof deck underneath shingles
    addBox(slopeLen, 0.075, roofDepth - 0.02, 'roofTile', midX, midY, roofCenterZ, 0, 0, -sign * slopeAngle);

    // Moulded fascia / bargeboard along front & back edges + thinner under-soffit trim
    for (const bz of [roofCenterZ + roofDepth / 2 - 0.02, roofCenterZ - roofDepth / 2 + 0.02]) {
      addChamferBox(slopeLen + 0.03, 0.110, 0.048, 'woodDeep', midX, midY - 0.008, bz, 0, 0, -sign * slopeAngle, 0.008);
      addChamferBox(slopeLen + 0.01, 0.032, 0.062, 'wood', midX - sign * roofNormX * 0.04, midY - roofNormY * 0.048, bz, 0, 0, -sign * slopeAngle, 0.005);
    }

    // Eave drip edge nosing along bottom of slope
    const eaveX = xMid + sign * (halfSpanX + 0.075);
    const eaveY = eavesY - 0.045;
    addChamferBox(0.055, 0.042, roofDepth, 'woodDeep', eaveX, eaveY, roofCenterZ, 0, 0, -sign * slopeAngle, 0.007);

    // 7 staggered overlapping shingle courses seated cleanly on the roof deck
    for (let row = 0; row < courseCount; row++) {
      const t = (row + 0.5) / courseCount; // 0 = eaves, 1 = ridge
      const baseRx = xMid + sign * (1 - t) * (halfSpanX + 0.055);
      const baseRy = eavesY + t * gableHeight + 0.022;
      const shingleLen = (slopeLen / courseCount) * 1.18; // overlaps lower course

      for (let col = 0; col < colsPerCourse; col++) {
        const zOffset = (row % 2 === 0 ? 0.02 : -0.02) * ((col % 2) * 2 - 1);
        const cz = roofCenterZ - (roofDepth - 0.08) * 0.5 + (col + 0.5) * colStep + zOffset * 0.35;
        const cw = colStep - 0.008;

        // Skip shingles inside dormer footprint on right slope
        if (sign === 1 && baseRx >= dormerMinX && baseRx <= dormerMaxX && Math.abs(cz - dormerZ) < dormerHalfW + 0.04) {
          continue;
        }

        // Subtle deterministic thickness & seating offset (always >= 0 into deck normal, never floating)
        const hash = Math.sin(row * 12.9898 + col * 78.233 + sign * 37.719);
        const thickVar = 0.028 + hash * 0.004;
        const lift = 0.012 + (row % 2) * 0.002;
        const rx = baseRx + sign * roofNormX * lift;
        const ry = baseRy + roofNormY * lift;
        const tilt = -sign * (slopeAngle - 0.032); // slight overlap kick at lower nosing
        const matKind = (row + col * 2) % 3 === 0 ? 'roofTileAlt' : 'roofTile';

        addChamferBox(shingleLen, thickVar, cw, matKind, rx, ry, cz, 0, 0, tilt, 0.006);
      }
    }
  }

  // Rounded ridge beam + segmented ridge cap tiles
  addChamferBox(0.11, 0.085, roofDepth + 0.05, 'woodDeep', xMid, gablePeakY + 0.048, roofCenterZ, 0, 0, 0, 0.016);
  for (let i = 0; i < 6; i++) {
    const rz = roofCenterZ - (roofDepth - 0.14) * 0.5 + (i + 0.5) * ((roofDepth - 0.14) / 6);
    addChamferBox(0.135, 0.038, (roofDepth - 0.14) / 6 - 0.012, 'roofTileAlt', xMid, gablePeakY + 0.075, rz, 0, 0, 0, 0.010);
  }

  // 5. Refined Attic Dormer on the right-side roof slope (~24% enlarged, cleanly seated into pitched shingles)
  // Roof surface height at x=0.94 is ~3.30, at x=1.56 is ~2.88.
  const dormerWallXMin = 0.94;
  const dormerWallXMax = 1.56;
  const dormerWallCenterX = (dormerWallXMin + dormerWallXMax) * 0.5; // 1.25
  const dormerWallWidthX = dormerWallXMax - dormerWallXMin; // 0.62
  const dormerBaseY = 2.78;
  const dormerEaveY = 3.23;
  const dormerPeakY = 3.44;
  const dormerWidthZ = 0.45;

  // Dormer cheek/front box seated down into roof deck
  addBox(dormerWallWidthX, dormerEaveY - dormerBaseY, dormerWidthZ, 'wallCream', dormerWallCenterX, (dormerBaseY + dormerEaveY) * 0.5, dormerZ);
  // Dormer front gable triangle (extruded along -X into the main roof)
  const dGableShape = new THREE.Shape();
  dGableShape.moveTo(-dormerWidthZ * 0.5, 0);
  dGableShape.lineTo(dormerWidthZ * 0.5, 0);
  dGableShape.lineTo(0, dormerPeakY - dormerEaveY);
  dGableShape.closePath();
  const dGableGeo = new THREE.ExtrudeGeometry(dGableShape, {
    depth: dormerWallWidthX,
    bevelEnabled: false,
    steps: 1
  });
  // ExtrudeGeometry extrudes +Z; rotateY(+PI/2) maps +Z -> +X, +X -> -Z
  dGableGeo.rotateY(Math.PI / 2);
  pushGeo(dGableGeo, 'wallCream', dormerWallXMin, dormerEaveY, dormerZ);

  // Dormer pitched roof slopes (left & right around Z, cleanly pitched at atan2(0.21, 0.225) ~ 0.751 rad)
  const dSlopeAngle = Math.atan2(dormerPeakY - dormerEaveY, dormerWidthZ * 0.5);
  const dSlopeLenZ = Math.hypot(dormerWidthZ * 0.5 + 0.065, dormerPeakY - dormerEaveY + 0.035);
  const dRoofLenX = dormerWallWidthX + 0.13;
  for (const zSign of [-1, 1]) {
    const dz = dormerZ + zSign * (dormerWidthZ * 0.25 + 0.016);
    const dy = (dormerEaveY + dormerPeakY) * 0.5 + 0.012;
    // Dormer roof shingle panel
    addChamferBox(dRoofLenX, 0.044, dSlopeLenZ, 'roofTileAlt', dormerWallCenterX + 0.02, dy, dz, zSign * dSlopeAngle, 0, 0, 0.006);
    // Dormer front bargeboard
    addChamferBox(0.040, 0.056, dSlopeLenZ + 0.01, 'woodDeep', dormerWallXMax + 0.055, dy - 0.004, dz, zSign * dSlopeAngle, 0, 0, 0.005);
  }
  // Dormer ridge cap & corner trim
  addChamferBox(dRoofLenX + 0.02, 0.038, 0.050, 'woodDeep', dormerWallCenterX + 0.02, dormerPeakY + 0.024, dormerZ, 0, 0, 0, 0.007);
  for (const cz of [dormerZ - dormerWidthZ * 0.5, dormerZ + dormerWidthZ * 0.5]) {
    addChamferBox(0.036, dormerEaveY - dormerBaseY - 0.04, 0.036, 'wood', dormerWallXMax - 0.005, (dormerBaseY + dormerEaveY) * 0.5 + 0.01, cz, 0, 0, 0, 0.004);
  }

  // Dormer window: hollow 4-rail frame, recessed glow backing, clear glass pane, mullions & sill
  const dFx = dormerWallXMax + 0.005;
  addChamferBox(0.036, 0.034, 0.29, 'wood', dFx, 3.04 + 0.125, dormerZ, 0, 0, 0, 0.004);
  addChamferBox(0.036, 0.034, 0.29, 'wood', dFx, 3.04 - 0.125, dormerZ, 0, 0, 0, 0.004);
  addChamferBox(0.036, 0.22, 0.034, 'wood', dFx, 3.04, dormerZ - 0.125, 0, 0, 0, 0.004);
  addChamferBox(0.036, 0.22, 0.034, 'wood', dFx, 3.04, dormerZ + 0.125, 0, 0, 0, 0.004);
  addBox(0.014, 0.22, 0.22, 'windowGlow', dFx + 0.003, 3.04, dormerZ);
  addBox(0.005, 0.22, 0.22, 'windowGlass', dFx + 0.013, 3.04, dormerZ);
  addBox(0.018, 0.018, 0.22, 'woodDeep', dFx + 0.010, 3.04, dormerZ);
  addBox(0.018, 0.22, 0.018, 'woodDeep', dFx + 0.010, 3.04, dormerZ);
  addChamferBox(0.056, 0.028, 0.32, 'woodDeep', dormerWallXMax + 0.018, 2.89, dormerZ, 0, 0, 0, 0.004);

  // 6. Second-floor Windows with Hollow 4-Rail Frames, Clear Glass Panes, Hinged Louvered Shutters & Moulded Flowerboxes
  function addWindowWithFlowerbox(cx, cy, cz, facing) {
    const isFront = facing === 'front';
    if (isFront) {
      // Hollow 4-rail outer frame, recessed warm glow, clear glass pane, crisp mullions
      addChamferBox(0.45, 0.045, 0.042, 'wood', cx, cy + 0.2225, cz, 0, 0, 0, 0.005);
      addChamferBox(0.45, 0.045, 0.042, 'wood', cx, cy - 0.2225, cz, 0, 0, 0, 0.005);
      addChamferBox(0.045, 0.40, 0.042, 'wood', cx - 0.2025, cy, cz, 0, 0, 0, 0.005);
      addChamferBox(0.045, 0.40, 0.042, 'wood', cx + 0.2025, cy, cz, 0, 0, 0, 0.005);
      addBox(0.36, 0.40, 0.016, 'windowGlow', cx, cy, cz - 0.002);
      addBox(0.36, 0.40, 0.006, 'windowGlass', cx, cy, cz + 0.012);
      addBox(0.36, 0.022, 0.022, 'woodDeep', cx, cy, cz + 0.010);
      addBox(0.022, 0.40, 0.022, 'woodDeep', cx, cy, cz + 0.010);

      // Framed sage shutters with louver slats & strap hinges
      for (const sx of [cx - 0.305, cx + 0.305]) {
        addChamferBox(0.145, 0.48, 0.036, 'shutterSage', sx, cy, cz + 0.008, 0, 0, 0, 0.005);
        for (const ly of [-0.14, -0.05, 0.05, 0.14]) {
          addBox(0.105, 0.022, 0.016, 'shutterSage', sx, cy + ly, cz + 0.024, 0.25, 0, 0);
        }
        const hingeX = sx < cx ? sx + 0.048 : sx - 0.048;
        for (const hy of [cy - 0.15, cy + 0.15]) {
          addBox(0.048, 0.022, 0.014, 'woodDeep', hingeX, hy, cz + 0.025);
        }
      }

      // Sill, moulded flowerbox lip, support brackets & layered flower clusters
      addChamferBox(0.51, 0.042, 0.145, 'woodDeep', cx, cy - 0.26, cz + 0.048, 0, 0, 0, 0.005);
      addChamferBox(0.46, 0.115, 0.125, 'wood', cx, cy - 0.325, cz + 0.052, 0, 0, 0, 0.006);
      addChamferBox(0.485, 0.026, 0.140, 'woodDeep', cx, cy - 0.275, cz + 0.054, 0, 0, 0, 0.004);
      for (const bx of [cx - 0.16, cx + 0.16]) {
        addChamferBox(0.038, 0.065, 0.095, 'woodDeep', bx, cy - 0.39, cz + 0.035, 0, 0, 0, 0.004);
      }
      for (let i = 0; i < 5; i++) {
        const fx = cx - 0.16 + i * 0.08;
        const fz = cz + 0.062 + (i % 2 === 0 ? 0.012 : -0.008);
        pushGeo(new THREE.OctahedronGeometry(0.044, 0), 'leaf', fx, cy - 0.232, fz);
        const bloomMat = i % 3 === 0 ? 'flowerLavender' : i % 3 === 1 ? 'flowerPeach' : 'flowerCream';
        pushGeo(new THREE.IcosahedronGeometry(0.030, 0), bloomMat, fx, cy - 0.192, fz + 0.008);
        pushGeo(new THREE.IcosahedronGeometry(0.022, 0), 'flowerCream', fx + 0.018, cy - 0.205, fz - 0.010);
      }
    } else {
      // Right-side wall window: hollow 4-rail outer frame
      addChamferBox(0.042, 0.045, 0.45, 'wood', cx, cy + 0.2225, cz, 0, 0, 0, 0.005);
      addChamferBox(0.042, 0.045, 0.45, 'wood', cx, cy - 0.2225, cz, 0, 0, 0, 0.005);
      addChamferBox(0.042, 0.40, 0.045, 'wood', cx, cy, cz - 0.2025, 0, 0, 0, 0.005);
      addChamferBox(0.042, 0.40, 0.045, 'wood', cx, cy, cz + 0.2025, 0, 0, 0, 0.005);
      addBox(0.016, 0.40, 0.36, 'windowGlow', cx - 0.002, cy, cz);
      addBox(0.006, 0.40, 0.36, 'windowGlass', cx + 0.012, cy, cz);
      addBox(0.022, 0.022, 0.36, 'woodDeep', cx + 0.010, cy, cz);
      addBox(0.022, 0.40, 0.022, 'woodDeep', cx + 0.010, cy, cz);

      for (const sz of [cz - 0.305, cz + 0.305]) {
        addChamferBox(0.036, 0.48, 0.145, 'shutterSage', cx + 0.008, cy, sz, 0, 0, 0, 0.005);
        for (const ly of [-0.14, -0.05, 0.05, 0.14]) {
          addBox(0.016, 0.022, 0.105, 'shutterSage', cx + 0.024, cy + ly, sz, 0, 0, -0.25);
        }
        const hingeZ = sz < cz ? sz + 0.048 : sz - 0.048;
        for (const hy of [cy - 0.15, cy + 0.15]) {
          addBox(0.014, 0.022, 0.048, 'woodDeep', cx + 0.025, hy, hingeZ);
        }
      }

      addChamferBox(0.145, 0.042, 0.51, 'woodDeep', cx + 0.048, cy - 0.26, cz, 0, 0, 0, 0.005);
      addChamferBox(0.125, 0.115, 0.46, 'wood', cx + 0.052, cy - 0.325, cz, 0, 0, 0, 0.006);
      addChamferBox(0.140, 0.026, 0.485, 'woodDeep', cx + 0.054, cy - 0.275, cz, 0, 0, 0, 0.004);
      for (const bz of [cz - 0.16, cz + 0.16]) {
        addChamferBox(0.095, 0.065, 0.038, 'woodDeep', cx + 0.035, cy - 0.39, bz, 0, 0, 0, 0.004);
      }
      for (let i = 0; i < 5; i++) {
        const fz = cz - 0.16 + i * 0.08;
        const fx = cx + 0.062 + (i % 2 === 0 ? 0.012 : -0.008);
        pushGeo(new THREE.OctahedronGeometry(0.044, 0), 'leaf', fx, cy - 0.232, fz);
        const bloomMat = i % 3 === 0 ? 'flowerLavender' : i % 3 === 1 ? 'flowerPeach' : 'flowerCream';
        pushGeo(new THREE.IcosahedronGeometry(0.030, 0), bloomMat, fx + 0.008, cy - 0.192, fz);
        pushGeo(new THREE.IcosahedronGeometry(0.022, 0), 'flowerCream', fx - 0.010, cy - 0.205, fz + 0.018);
      }
    }
  }

  // Front 2F window above front door
  addWindowWithFlowerbox(0.44, 2.15, zMax + 0.015, 'front');
  // Right-side 2F window aligned above 1F right window
  addWindowWithFlowerbox(xMax + 0.015, 2.15, -0.90, 'side');

  // Finalize batched meshes
  let meshCount = 0;
  let triangleCount = 0;
  for (const [kind, list] of buckets.entries()) {
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (!merged) continue;
    createdGeometries.push(merged);
    const mesh = new THREE.Mesh(merged, materials[kind]);
    mesh.name = `two-story-${kind}`;
    mesh.castShadow = kind !== 'windowGlow' && kind !== 'windowGlass';
    mesh.receiveShadow = true;
    root.add(mesh);
    meshCount++;
    triangleCount += merged.attributes.position.count / 3;
  }

  let disposed = false;

  return {
    root,
    setNight(night) {
      materials.windowGlow.emissiveIntensity = night ? 1.85 : 0.04;
      materials.windowGlow.color.set(night ? '#ffe5a8' : '#fae3b4');
    },
    getState() {
      return {
        meshCount,
        materialCount: Object.keys(materials).length,
        triangleCount: Math.round(triangleCount),
        roofHidden: originalRoof ? !originalRoof.visible : false,
        windowEmissive: materials.windowGlow.emissiveIntensity
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (originalRoof) {
        originalRoof.visible = prevRoofVisible;
      }
      for (const g of createdGeometries) g.dispose();
      for (const m of Object.values(materials)) m.dispose();
      root.removeFromParent();
    }
  };
}
