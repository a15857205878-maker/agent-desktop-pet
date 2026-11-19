import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyComponentUV } from './cottage-component-uv.mjs';

/**
 * Create a compact chamfered/beveled box geometry for miniature indoor furniture.
 */
function createChamferBoxGeometry(w, h, d, bevel = 0.008) {
  const b = Math.min(bevel, w * 0.22, h * 0.22, d * 0.22);
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
 * Modest Final Indoor Furnishings:
 * - Study (attached to X-mirrored studyModel): 1 narrow 2-drawer stationery cabinet beside desk
 *   at world [-1.52, 0.52, -1.02] (footprint x=0.38, z=0.44, floor=0.22, top=0.82) with brass pulls
 *   and 1 flat colored notebook.
 * - Bedroom (attached to bedroomRoot): 1 low upholstered bed-end stool at world [0.22, 0.35, -0.47]
 *   (depthX=0.28, lengthZ=0.58, floor=0.22, top=0.46), warm wood + muted lavender cushion.
 * - Decorative only: no roomSpot/activity tags, no lights, no save logic.
 */
export function createRoomFinalFurnishings(studyModel, bedroomRoot) {
  const studyRoot = new THREE.Group();
  studyRoot.name = 'study-final-furnishings';
  if (studyModel) studyModel.add(studyRoot);

  const bedRoot = new THREE.Group();
  bedRoot.name = 'bedroom-final-furnishings';
  if (bedroomRoot) bedroomRoot.add(bedRoot);

  const materials = {
    wood: new THREE.MeshStandardMaterial({ name: 'final-room-wood', color: '#c89b6a', roughness: 0.82 }),
    woodDeep: new THREE.MeshStandardMaterial({ name: 'final-room-woodDeep', color: '#9c7144', roughness: 0.85 }),
    brass: new THREE.MeshStandardMaterial({ name: 'final-room-brass', color: '#dfb35c', roughness: 0.36, metalness: 0.45 }),
    notebookCover: new THREE.MeshStandardMaterial({ name: 'final-room-notebook-lavender', color: '#b8a2d4', roughness: 0.84 }),
    cushionLavender: new THREE.MeshStandardMaterial({ name: 'final-room-cushion-lavender', color: '#b6a3cc', roughness: 0.90 })
  };

  const createdGeometries = [];
  let meshCount = 0;
  let triangleCount = 0;

  function buildBatchedGroup(parent, prefix, builder) {
    const buckets = new Map();
    function pushGeo(geo, kind, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
      const shape = geo.type === 'CylinderGeometry' ? 'cylinder' : 'auto';
      const nonIdx = geo.index ? geo.toNonIndexed() : geo.clone();
      applyComponentUV(nonIdx, { kind, shape });
      if (rx) nonIdx.rotateX(rx);
      if (ry) nonIdx.rotateY(ry);
      if (rz) nonIdx.rotateZ(rz);
      if (x || y || z) nonIdx.translate(x, y, z);
      if (!buckets.has(kind)) buckets.set(kind, []);
      buckets.get(kind).push(nonIdx);
      geo.dispose();
    }

    builder({
      addBox: (w, h, d, kind, x, y, z, rx = 0, ry = 0, rz = 0) =>
        pushGeo(new THREE.BoxGeometry(w, h, d), kind, x, y, z, rx, ry, rz),
      addChamferBox: (w, h, d, kind, x, y, z, rx = 0, ry = 0, rz = 0, bevel = 0.008) =>
        pushGeo(createChamferBoxGeometry(w, h, d, bevel), kind, x, y, z, rx, ry, rz),
      addGeo: pushGeo
    });

    for (const [kind, list] of buckets.entries()) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      createdGeometries.push(merged);
      const mesh = new THREE.Mesh(merged, materials[kind]);
      mesh.name = `${prefix}-${kind}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.decorativeOnly = true;
      parent.add(mesh);
      meshCount++;
      triangleCount += merged.attributes.position.count / 3;
    }
  }

  // 1. Study: Narrow 2-drawer stationery cabinet beside desk
  // World center: [-1.52, 0.52, -1.02] -> studyModel is X-mirrored (localX = -worldX = +1.52)
  if (studyModel) {
    const cx = 1.52;
    const cz = -1.02;
    const w = 0.38;
    const d = 0.44;
    buildBatchedGroup(studyRoot, 'study-cabinet', ({ addChamferBox, addGeo }) => {
      // 4 tapered legs from floor y=0.22 to y=0.29
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addGeo(
            new THREE.CylinderGeometry(0.017, 0.012, 0.07, 8),
            'woodDeep',
            cx + sx * (w * 0.5 - 0.035),
            0.255,
            cz + sz * (d * 0.5 - 0.035)
          );
        }
      }
      // Cabinet carcase (y: 0.29 .. 0.79)
      addChamferBox(w - 0.02, 0.50, d - 0.02, 'wood', cx, 0.54, cz, 0, 0, 0, 0.008);
      // Slightly overhanging top (y: 0.79 .. 0.82)
      addChamferBox(w, 0.030, d, 'woodDeep', cx, 0.805, cz, 0, 0, 0, 0.007);

      // 2 drawer fronts on +Z face (cz + d/2 - 0.004) + small brass pulls
      const frontZ = cz + d * 0.5 - 0.004;
      for (const dy of [0.42, 0.65]) {
        addChamferBox(w - 0.06, 0.19, 0.020, 'woodDeep', cx, dy, frontZ, 0, 0, 0, 0.005);
        addChamferBox(0.055, 0.016, 0.018, 'brass', cx, dy, frontZ + 0.014, 0, 0, 0, 0.003);
      }

      // 1 flat colored notebook resting on top (y: 0.82 .. 0.838)
      addChamferBox(0.16, 0.018, 0.22, 'notebookCover', cx - 0.02, 0.829, cz + 0.01, 0, 0.18, 0, 0.004);
    });
  }

  // 2. Bedroom: Low upholstered bed-end stool
  // World center: [0.22, 0.35, -0.47], depthX=0.28, lengthZ=0.58, floor=0.22, top=0.46
  if (bedroomRoot) {
    const bx = 0.22;
    const bz = -0.47;
    const dx = 0.28;
    const dz = 0.58;
    buildBatchedGroup(bedRoot, 'bedroom-footstool', ({ addChamferBox, addGeo }) => {
      // 4 short wooden legs from floor y=0.22 to y=0.355
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          addGeo(
            new THREE.CylinderGeometry(0.018, 0.013, 0.135, 8),
            'woodDeep',
            bx + sx * (dx * 0.5 - 0.038),
            0.2875,
            bz + sz * (dz * 0.5 - 0.045)
          );
        }
      }
      // Wooden apron frame (y: 0.34 .. 0.39)
      addChamferBox(dx - 0.02, 0.052, dz - 0.02, 'wood', bx, 0.365, bz, 0, 0, 0, 0.008);
      // Muted lavender upholstered seat cushion (y: 0.39 .. 0.46)
      addChamferBox(dx, 0.072, dz, 'cushionLavender', bx, 0.424, bz, 0, 0, 0, 0.018);
    });
  }

  let disposed = false;

  return {
    roots: {
      study: studyRoot,
      bedroom: bedRoot
    },
    getState() {
      return {
        disposed,
        meshCount,
        materialCount: Object.keys(materials).length,
        triangleCount: Math.round(triangleCount),
        studyAttached: studyRoot.parent === studyModel,
        bedroomAttached: bedRoot.parent === bedroomRoot
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const g of createdGeometries) g.dispose();
      for (const m of Object.values(materials)) m.dispose();
      studyRoot.removeFromParent();
      bedRoot.removeFromParent();
    }
  };
}
