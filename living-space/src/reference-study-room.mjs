import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { STUDY_LAYOUT } from './reference-room-layout.mjs';
import { createSoftPillowGeometry } from './softness-geometry.mjs';

/**
 * Builds the replacement 1F Study miniature room aligned to references/APPROVED.jpg
 * in studyModel-local space (where `studyModel.scale.x = -1`, so `localX = -worldX`).
 *
 * Original room.glb meshes are hidden at runtime without mutating geometry/materials
 * and restored once on dispose().
 */
export function createReferenceStudyRoom(model) {
  const hiddenOriginals = [];
  model.traverse((obj) => {
    if (obj.isMesh) {
      hiddenOriginals.push({ mesh: obj, visible: obj.visible });
      obj.visible = false;
    }
  });

  const root = new THREE.Group();
  root.name = 'reference-study-room';
  model.add(root);

  let disposed = false;
  const ownedGeometries = new Set();
  const lx = (worldX) => -worldX;

  const materials = {
    wall: new THREE.MeshStandardMaterial({ color: '#f6efe4', roughness: 0.92 }),
    floor: new THREE.MeshStandardMaterial({ color: '#dfb17b', roughness: 0.80 }),
    plankLine: new THREE.MeshStandardMaterial({ color: '#c79660', roughness: 0.86 }),
    plinthTrim: new THREE.MeshStandardMaterial({ color: '#8f6239', roughness: 0.84 }),
    wood: new THREE.MeshStandardMaterial({ color: '#c69866', roughness: 0.82 }),
    woodDeep: new THREE.MeshStandardMaterial({ color: '#a87b4c', roughness: 0.84 }),
    cream: new THREE.MeshStandardMaterial({ color: '#f7f0e2', roughness: 0.88 }),
    curtain: new THREE.MeshStandardMaterial({ color: '#dfd3ec', roughness: 0.92, side: THREE.DoubleSide }),
    lavender: new THREE.MeshStandardMaterial({ color: '#baa3d4', roughness: 0.86 }),
    lavenderDeep: new THREE.MeshStandardMaterial({ color: '#8f74b2', roughness: 0.84 }),
    charcoal: new THREE.MeshStandardMaterial({ color: '#3b3544', roughness: 0.72 }),
    metal: new THREE.MeshStandardMaterial({ color: '#c8c0d0', metalness: 0.25, roughness: 0.55 }),
    brass: new THREE.MeshStandardMaterial({ color: '#c8a568', metalness: 0.28, roughness: 0.58 }),
    chairCream: new THREE.MeshStandardMaterial({ color: '#f7e6a8', roughness: 0.86 }),
    chairTrim: new THREE.MeshStandardMaterial({ color: '#ecd58a', roughness: 0.86 }),
    cushionSage: new THREE.MeshStandardMaterial({ color: '#dca590', roughness: 0.88 }),
    uiPanelBlue: new THREE.MeshBasicMaterial({ color: '#dce8f8', toneMapped: false }),
    uiBarLavender: new THREE.MeshBasicMaterial({ color: '#b8a2d4', toneMapped: false }),
    uiAccentSky: new THREE.MeshBasicMaterial({ color: '#94b8dc', toneMapped: false }),
    uiAccentMint: new THREE.MeshBasicMaterial({ color: '#96c2b0', toneMapped: false }),
    rugMain: new THREE.MeshStandardMaterial({ color: '#d5e1d6', roughness: 0.94 }),
    rugBorder: new THREE.MeshStandardMaterial({ color: '#90b3a6', roughness: 0.94 }),
    ceramic: new THREE.MeshStandardMaterial({ color: '#eee1cc', roughness: 0.48 }),
    tea: new THREE.MeshStandardMaterial({ color: '#996d47', roughness: 0.40 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#79a576', roughness: 0.84 }),
    pot: new THREE.MeshStandardMaterial({ color: '#d8ae96', roughness: 0.82 }),
    bookMint: new THREE.MeshStandardMaterial({ color: '#75ac9c', roughness: 0.82 }),
    bookPeach: new THREE.MeshStandardMaterial({ color: '#dd9384', roughness: 0.82 }),
    bookSky: new THREE.MeshStandardMaterial({ color: '#7faed2', roughness: 0.82 }),
    crystal: new THREE.MeshStandardMaterial({ color: '#b399d4', roughness: 0.48 }),
    windowGlass: new THREE.MeshBasicMaterial({
      name: 'window-glass-mat',
      vertexColors: true,
      toneMapped: false
    }),
    displayScreen: new THREE.MeshBasicMaterial({
      name: 'study-monitor-display-mat',
      color: '#f5f8ff',
      toneMapped: false
    }),
    lampShade: new THREE.MeshStandardMaterial({
      name: 'study-lamp-shade',
      color: '#fae8be',
      emissive: '#ffcf7c',
      emissiveIntensity: 0.45,
      roughness: 0.65
    }),
    lampBulb: new THREE.MeshStandardMaterial({
      name: 'study-lamp-bulb',
      color: '#fff4d4',
      emissive: '#ffe29a',
      emissiveIntensity: 0.85,
      roughness: 0.35
    })
  };

  function trackGeo(g) {
    ownedGeometries.add(g);
    return g;
  }

  function makeBoxGeo(w, h, d, r = 0.012) {
    return new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 4, h / 4, d / 4));
  }

  /**
   * Collects static parts per interaction group and batches them by material,
   * preserving part names in `userData.parts` and interaction tags.
   */
  function createGroupBatcher(groupName, { activity = null, roomSpot = null, castShadow = true, receiveShadow = true } = {}) {
    const group = new THREE.Group();
    group.name = groupName;
    root.add(group);
    const items = [];

    function addGeo(name, geo, matKey, x, y, z, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
      items.push({ name, geo, matKey, x, y, z, rx, ry, rz, sx, sy, sz });
    }

    function addBox(name, w, h, d, matKey, x, y, z, r = 0.012, rot = {}) {
      addGeo(name, makeBoxGeo(w, h, d, r), matKey, x, y, z, rot);
    }

    function flush() {
      const buckets = new Map();
      const m4 = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const euler = new THREE.Euler();
      const scl = new THREE.Vector3();

      for (const it of items) {
        if (!buckets.has(it.matKey)) buckets.set(it.matKey, []);
        buckets.get(it.matKey).push(it);
      }

      for (const [matKey, list] of buckets) {
        const positions = [];
        const normals = [];
        const uvs = [];
        const parts = [];

        for (const it of list) {
          const nonIdx = it.geo.index ? it.geo.toNonIndexed() : it.geo;
          pos.set(it.x, it.y, it.z);
          euler.set(it.rx, it.ry, it.rz);
          quat.setFromEuler(euler);
          scl.set(it.sx, it.sy, it.sz);
          m4.compose(pos, quat, scl);
          nonIdx.applyMatrix4(m4);

          const pArr = nonIdx.attributes.position.array;
          const nArr = nonIdx.attributes.normal.array;
          const uArr = nonIdx.attributes.uv?.array;
          positions.push(pArr);
          normals.push(nArr);
          if (uArr) {
            uvs.push(uArr);
          } else {
            uvs.push(new Float32Array((pArr.length / 3) * 2));
          }
          parts.push(it.name);

          if (nonIdx !== it.geo) nonIdx.dispose();
          it.geo.dispose();
        }

        const mergeAttr = (arrs, itemSize) => {
          const total = arrs.reduce((s, a) => s + a.length, 0);
          const out = new Float32Array(total);
          let off = 0;
          for (const a of arrs) {
            out.set(a, off);
            off += a.length;
          }
          return new THREE.BufferAttribute(out, itemSize);
        };

        const merged = trackGeo(new THREE.BufferGeometry());
        merged.setAttribute('position', mergeAttr(positions, 3));
        merged.setAttribute('normal', mergeAttr(normals, 3));
        merged.setAttribute('uv', mergeAttr(uvs, 2));

        const mesh = new THREE.Mesh(merged, materials[matKey]);
        mesh.name = `${groupName}-${matKey}`;
        mesh.castShadow = castShadow;
        mesh.receiveShadow = receiveShadow;
        mesh.userData.parts = parts;
        if (activity) mesh.userData.activity = activity;
        if (roomSpot) mesh.userData.roomSpot = roomSpot;
        group.add(mesh);
      }
      items.length = 0;
    }

    return { group, addGeo, addBox, flush };
  }

  // =========================================================================
  // 1. ROOM ARCHITECTURE (Floor, Plinth, Walls with TRUE Window Aperture)
  // =========================================================================
  const arch = createGroupBatcher('study-architecture');

  // Floor slab [-2, 2] x [-2, 2], top at y = 0.22
  arch.addBox('study-floor-slab', 4.0, 0.22, 4.0, 'floor', 0, 0.11, 0, 0.01);
  arch.addBox('study-plinth-front-left', 0.08, 0.18, 4.04, 'plinthTrim', lx(-1.98), 0.09, 0.0, 0.01);
  arch.addBox('study-plinth-front-right', 4.04, 0.18, 0.08, 'plinthTrim', 0.0, 0.09, 1.98, 0.01);
  for (const wx of [-1.4, -0.8, -0.2, 0.4, 1.0]) {
    arch.addBox(`study-plank-line-${wx}`, 0.012, 0.004, 3.86, 'plankLine', lx(wx), 0.221, 0.0, 0.001);
  }

  // Right-back wall (world x = +1.93 -> local x = -1.93)
  arch.addBox('study-wall-right-back', 0.14, 2.68, 4.0, 'wall', lx(1.93), 1.56, 0.0, 0.01);
  arch.addBox('study-top-beam-right', 0.18, 0.13, 4.04, 'wood', lx(1.92), 2.94, 0.0, 0.018);
  arch.addBox('study-baseboard-right', 0.03, 0.09, 3.86, 'cream', lx(1.85), 0.265, 0.02, 0.004);

  // Rear wall (z = -1.93) built around the true window opening:
  // local x in [-0.25, 0.85], y in [1.2, 2.4]
  const winMinX = STUDY_LAYOUT.window.localX[0]; // -0.25
  const winMaxX = STUDY_LAYOUT.window.localX[1]; // +0.85
  const winMinY = STUDY_LAYOUT.window.bottomY;   // 1.2
  const winMaxY = STUDY_LAYOUT.window.topY;      // 2.4
  const winCenterX = STUDY_LAYOUT.window.localCenter[0]; // 0.3
  const winWidth = STUDY_LAYOUT.window.width;    // 1.1

  // Segment 1: local x in [-2.0, -0.25] (width 1.75, center -1.125)
  arch.addBox('study-wall-rear-right-seg', 1.75, 2.68, 0.14, 'wall', -1.125, 1.56, -1.93, 0.008);
  // Segment 2: local x in [0.85, 2.0] (width 1.15, center 1.425)
  arch.addBox('study-wall-rear-left-seg', 1.15, 2.68, 0.14, 'wall', 1.425, 1.56, -1.93, 0.008);
  // Segment 3: below window, y in [0.22, 1.2] (height 0.98, center 0.71)
  arch.addBox('study-wall-rear-bottom-seg', winWidth, winMinY - 0.22, 0.14, 'wall', winCenterX, (0.22 + winMinY) / 2, -1.93, 0.006);
  // Segment 4: above window, y in [2.4, 2.90] (height 0.50, center 2.65)
  arch.addBox('study-wall-rear-top-seg', winWidth, 2.90 - winMaxY, 0.14, 'wall', winCenterX, (winMaxY + 2.90) / 2, -1.93, 0.006);

  arch.addBox('study-top-beam-rear', 4.04, 0.13, 0.18, 'wood', 0.0, 2.94, -1.92, 0.018);
  arch.addBox('study-baseboard-rear', 3.86, 0.09, 0.03, 'cream', 0.0, 0.265, -1.85, 0.004);

  // Window casing, mullions, sill, corbels, curtain rod, curtains, sill plant
  for (const x of [winMinX - 0.02, winMaxX + 0.02]) {
    arch.addBox('study-window-casing-v', 0.045, 1.24, 0.06, 'wood', x, 1.80, -1.87, 0.006);
  }
  for (const y of [winMinY - 0.02, winMaxY + 0.02]) {
    arch.addBox('study-window-casing-h', 1.18, 0.045, 0.06, 'wood', winCenterX, y, -1.87, 0.006);
  }
  arch.addBox('study-window-mullion-v', 0.036, 1.18, 0.04, 'wood', winCenterX, 1.80, -1.88, 0.005);
  arch.addBox('study-window-mullion-h', 1.08, 0.036, 0.04, 'wood', winCenterX, 1.86, -1.88, 0.005);
  arch.addBox('study-windowsill', 1.32, 0.055, 0.22, 'wood', winCenterX, 1.16, -1.79, 0.01);
  for (const dx of [-0.46, 0.46]) {
    arch.addBox('study-sill-corbel', 0.06, 0.13, 0.10, 'woodDeep', winCenterX + dx, 1.07, -1.81, 0.008);
  }

  // Curtain rod & finials (in arch); pleated curtains & tiebacks in non-shadow-casting group
  arch.addGeo('study-curtain-rod', new THREE.CylinderGeometry(0.016, 0.016, 1.54, 12), 'woodDeep', winCenterX, 2.53, -1.78, { rz: Math.PI / 2 });
  for (const fx of [winCenterX - 0.78, winCenterX + 0.78]) {
    arch.addGeo('study-curtain-finial', new THREE.SphereGeometry(0.026, 10, 8), 'brass', fx, 2.53, -1.78);
  }
  arch.addGeo('study-sill-pot', new THREE.CylinderGeometry(0.052, 0.04, 0.085, 12), 'pot', winCenterX - 0.36, 1.23, -1.76);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    arch.addGeo(
      `study-sill-leaf-${i}`,
      new THREE.IcosahedronGeometry(0.042, 0),
      'leaf',
      winCenterX - 0.36 + Math.sin(a) * 0.024,
      1.29 + (i % 2) * 0.01,
      -1.76 + Math.cos(a) * 0.024,
      { sy: 0.5 }
    );
  }

  // Desk rug & floor plant (left of desk, world x = -1.55, z = -1.45)
  arch.addBox('study-desk-rug-border', 1.58, 0.01, 1.18, 'rugBorder', lx(-0.30), 0.225, -0.92, 0.005);
  arch.addBox('study-desk-rug-center', 1.44, 0.012, 1.04, 'rugMain', lx(-0.30), 0.227, -0.92, 0.005);
  arch.addGeo('study-floor-pot', new THREE.CylinderGeometry(0.11, 0.085, 0.18, 14), 'pot', lx(-1.55), 0.31, -1.45);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI * 2) / 6;
    arch.addGeo(
      `study-floor-leaf-${i}`,
      new THREE.IcosahedronGeometry(0.09, 0),
      'leaf',
      lx(-1.55) + Math.sin(a) * 0.07,
      0.47 + (i % 2) * 0.06,
      -1.45 + Math.cos(a) * 0.07,
      { sx: 1.1, sy: 0.55, sz: 0.8, ry: a }
    );
  }

  arch.flush();

  // Pale sky window-glass plane (NO trees/hills, NO shadow casting)
  const glassGeo = trackGeo(new THREE.PlaneGeometry(winWidth, winMaxY - winMinY, 1, 1));
  const topCol = new THREE.Color('#cde6ff');
  const botCol = new THREE.Color('#fff2cf');
  const posAttr = glassGeo.attributes.position;
  const colArr = new Float32Array(posAttr.count * 3);
  for (let i = 0; i < posAttr.count; i++) {
    const c = posAttr.getY(i) >= 0 ? topCol : botCol;
    colArr[i * 3] = c.r;
    colArr[i * 3 + 1] = c.g;
    colArr[i * 3 + 2] = c.b;
  }
  glassGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  const windowGlass = new THREE.Mesh(glassGeo, materials.windowGlass);
  windowGlass.name = 'window-glass';
  windowGlass.position.set(winCenterX, (winMinY + winMaxY) / 2, -1.93);
  windowGlass.castShadow = false;
  windowGlass.receiveShadow = false;
  root.add(windowGlass);

  // Gathered cream curtains with soft pleats & lavender tiebacks (non-shadow-casting so window light stays open)
  const curtains = createGroupBatcher('study-curtains', { castShadow: false, receiveShadow: true });
  for (const side of [-1, 1]) {
    const cx = winCenterX + side * 0.53;
    const pleatGeo = new THREE.PlaneGeometry(0.28, 1.32, 14, 16);
    const p = pleatGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i);
      const py = p.getY(i);
      const cinch = Math.exp(-Math.pow((py + 0.28) / 0.24, 2));
      const widthScale = 1.0 - 0.28 * cinch + (py < -0.28 ? 0.08 * ((-py - 0.28) / 0.38) : 0);
      const phase = (px / 0.28 + 0.5) * Math.PI * 5;
      const pz = 0.026 * Math.cos(phase) + 0.018 * cinch;
      p.setXYZ(i, px * widthScale, py, pz);
    }
    pleatGeo.computeVertexNormals();
    curtains.addGeo('study-curtain-drape', pleatGeo, 'curtain', cx, 1.87, -1.77);
    curtains.addBox('study-curtain-tieback', 0.22, 0.038, 0.068, 'lavender', cx, 1.59, -1.755, 0.014);
  }
  curtains.flush();

  // =========================================================================
  // 2. DESK, SWIVEL CHAIR & COMPUTER WORKSTATION
  // =========================================================================
  const desk = createGroupBatcher('study-desk', { roomSpot: 'desk' });
  // Desk spans world x [-1.15, 0.55] (width 1.70, center -0.30), z [-1.8, -1.0] (depth 0.80, center -1.4), tabletopY = 0.94
  desk.addBox('study-desk-top', 1.70, 0.062, 0.80, 'wood', lx(-0.30), 0.909, -1.40, 0.015);
  desk.addBox('study-desk-apron', 1.56, 0.074, 0.038, 'woodDeep', lx(-0.30), 0.856, -1.035, 0.008);
  desk.addBox('study-desk-apron-inset', 1.43, 0.043, 0.014, 'wood', lx(-0.30), 0.856, -1.014, 0.003);
  desk.addBox('study-desk-brass-pull', 0.085, 0.014, 0.018, 'brass', lx(-0.30), 0.856, -1.002, 0.004);
  for (const wx of [-1.055, 0.455]) {
    desk.addBox('study-desk-side-rail', 0.041, 0.062, 0.60, 'woodDeep', lx(wx), 0.866, -1.39, 0.007);
  }
  for (const [wx, wz] of [[-1.08, -1.73], [0.48, -1.73], [-1.08, -1.07], [0.48, -1.07]]) {
    desk.addBox('study-desk-leg', 0.055, 0.68, 0.055, 'charcoal', lx(wx), 0.56, wz, 0.01);
  }
  // Lavender desk pad, cup/saucer, swivel desk chair
  desk.addBox('study-desk-pad', 0.66, 0.008, 0.32, 'lavender', lx(-0.30), 0.944, -1.26, 0.004);
  desk.addGeo('study-tea-saucer', new THREE.CylinderGeometry(0.075, 0.068, 0.01, 18), 'ceramic', lx(-0.56), 0.945, -1.18);
  desk.addGeo('study-tea-cup', new THREE.CylinderGeometry(0.048, 0.04, 0.095, 16), 'ceramic', lx(-0.56), 0.995, -1.18);
  desk.addGeo('study-tea-liquid', new THREE.CylinderGeometry(0.042, 0.042, 0.006, 14), 'tea', lx(-0.56), 1.038, -1.18);

  // Swivel desk chair at world x = -0.30, z = -0.82
  const dcX = lx(-0.30);
  const dcZ = -0.82;
  // The carpet top is y=.233. Keep the seat height while seating the
  // swivel base and its hub on that surface.
  desk.addGeo('study-desk-chair-stem', new THREE.CylinderGeometry(0.025, 0.025, 0.294, 10), 'charcoal', dcX, 0.393, dcZ);
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    desk.addBox('study-desk-chair-spoke', 0.03, 0.025, 0.24, 'charcoal', dcX + Math.sin(a) * 0.11, 0.2455, dcZ + Math.cos(a) * 0.11, 0.006, { ry: a });
  }
  desk.addBox('study-desk-chair-seat', 0.44, 0.07, 0.42, 'lavender', dcX, 0.56, dcZ, 0.02);
  desk.addBox('study-desk-chair-back', 0.40, 0.44, 0.07, 'charcoal', dcX, 0.82, dcZ + 0.18, 0.02);
  desk.addBox('study-desk-chair-back-pad', 0.34, 0.36, 0.03, 'lavender', dcX, 0.82, dcZ + 0.145, 0.015);
  desk.flush();

  // Computer workstation at world [-0.8, 1.0, -1.4] -> local x = 0.8
  const comp = createGroupBatcher('study-computer', { activity: 'computer', roomSpot: 'computer' });
  const compX = lx(-0.80);
  const compZ = -1.46;
  comp.addBox('study-monitor-base', 0.20, 0.018, 0.14, 'metal', compX, 0.949, compZ, 0.006);
  comp.addBox('study-monitor-neck', 0.045, 0.14, 0.035, 'metal', compX, 1.02, compZ - 0.03, 0.006);
  comp.addBox('study-monitor-bezel', 0.52, 0.32, 0.028, 'charcoal', compX, 1.18, compZ, 0.012);
  comp.addBox('study-keyboard', 0.34, 0.014, 0.12, 'lavender', lx(-0.34), 0.952, -1.24, 0.005);
  comp.addBox('study-mouse', 0.055, 0.018, 0.085, 'lavenderDeep', lx(-0.10), 0.954, -1.24, 0.008);
  comp.flush();

  const monitorDisplay = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.47, 0.27)), materials.displayScreen);
  monitorDisplay.name = 'study-monitor-display';
  monitorDisplay.position.set(compX, 1.18, compZ + 0.016);
  monitorDisplay.castShadow = false;
  monitorDisplay.receiveShadow = false;
  monitorDisplay.userData.activity = 'computer';
  monitorDisplay.userData.roomSpot = 'computer';
  root.add(monitorDisplay);

  // Muted lavender/blue UI shapes as actual non-shadow-casting geometry on the monitor display
  const monitorUi = createGroupBatcher('study-monitor-ui-display', {
    activity: 'computer',
    roomSpot: 'computer',
    castShadow: false,
    receiveShadow: false
  });
  const uiZ = compZ + 0.0175;
  monitorUi.addBox('study-ui-topbar', 0.43, 0.028, 0.002, 'uiBarLavender', compX, 1.285, uiZ, 0.001);
  monitorUi.addBox('study-ui-sidebar', 0.11, 0.175, 0.002, 'uiPanelBlue', compX + 0.15, 1.165, uiZ, 0.001);
  monitorUi.addBox('study-ui-main-card', 0.28, 0.175, 0.002, 'uiPanelBlue', compX - 0.07, 1.165, uiZ, 0.001);
  monitorUi.addBox('study-ui-bar-1', 0.045, 0.065, 0.002, 'uiAccentSky', compX - 0.14, 1.14, uiZ + 0.0015, 0.001);
  monitorUi.addBox('study-ui-bar-2', 0.045, 0.105, 0.002, 'uiBarLavender', compX - 0.07, 1.16, uiZ + 0.0015, 0.001);
  monitorUi.addBox('study-ui-bar-3', 0.045, 0.082, 0.002, 'uiAccentMint', compX, 1.148, uiZ + 0.0015, 0.001);
  monitorUi.flush();

  // =========================================================================
  // 3. LAMP GLOW GROUP (`reference-study-lamp-glow`) - NO scene lights
  // =========================================================================
  const lampGroup = new THREE.Group();
  lampGroup.name = STUDY_LAYOUT.lamp.groupName;
  root.add(lampGroup);

  const lampX = lx(STUDY_LAYOUT.lamp.anchor[0]);
  const lampZ = STUDY_LAYOUT.lamp.anchor[2];
  const lampBase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.075, 0.024, 14)), materials.brass);
  lampBase.name = 'study-lamp-base';
  lampBase.position.set(lampX, 0.952, lampZ);
  lampBase.castShadow = true;
  lampBase.receiveShadow = true;

  const lampStem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.014, 0.018, 0.18, 10)), materials.brass);
  lampStem.name = 'study-lamp-stem';
  lampStem.position.set(lampX, 1.05, lampZ);
  lampStem.castShadow = true;
  lampStem.receiveShadow = true;

  const lampShade = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.075, 0.12, 0.14, 18)), materials.lampShade);
  lampShade.name = 'study-lamp-shade-glow';
  lampShade.position.set(lampX, 1.18, lampZ);
  lampShade.castShadow = false;
  lampShade.receiveShadow = false;

  const lampBulb = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.032, 12, 10)), materials.lampBulb);
  lampBulb.name = 'study-lamp-bulb-glow';
  lampBulb.position.set(lampX, 1.14, lampZ);
  lampBulb.castShadow = false;
  lampBulb.receiveShadow = false;

  lampGroup.add(lampBase, lampStem, lampShade, lampBulb);

  // =========================================================================
  // 4. SMALL BOOKSHELF (near world [0.55, 1.0, -1.55])
  // =========================================================================
  const shelf = createGroupBatcher('study-bookshelf', { roomSpot: 'bookshelf' });
  const shX = lx(0.55);
  const shZ = -1.66;
  shelf.addBox('study-shelf-back', 0.86, 1.40, 0.03, 'woodDeep', shX, 0.92, shZ - 0.155, 0.006);
  shelf.addBox('study-shelf-left', 0.054, 1.38, 0.32, 'wood', shX - 0.403, 0.92, shZ, 0.012);
  shelf.addBox('study-shelf-right', 0.054, 1.38, 0.32, 'wood', shX + 0.403, 0.92, shZ, 0.012);
  shelf.addBox('study-shelf-recessed-plinth', 0.76, 0.052, 0.28, 'woodDeep', shX, 0.246, shZ - 0.012, 0.008);
  for (const sy of [0.28, 0.68, 1.12]) {
    shelf.addBox(`study-shelf-board-${sy}`, 0.84, 0.038, 0.32, 'wood', shX, sy, shZ, 0.006);
  }
  shelf.addBox('study-shelf-board-1.6', 0.88, 0.050, 0.348, 'wood', shX, 1.594, shZ, 0.012);
  const bookMats = ['lavender', 'bookMint', 'bookPeach', 'cream', 'bookSky', 'lavenderDeep'];
  for (let row = 0; row < 3; row++) {
    const baseY = [0.30, 0.70, 1.14][row];
    for (let i = 0; i < 6; i++) {
      const bx = shX - 0.30 + i * 0.115;
      const bh = 0.25 + ((i + row) % 3) * 0.025;
      shelf.addBox(`study-book-${row}-${i}`, 0.055, bh, 0.21, bookMats[(i + row) % bookMats.length], bx, baseY + bh / 2, shZ + 0.02, 0.005);
    }
  }
  shelf.addBox('study-shelf-top-notebook', 0.20, 0.032, 0.15, 'lavender', shX - 0.18, 1.635, shZ, 0.006);
  shelf.addGeo('study-shelf-crystal-base', new THREE.CylinderGeometry(0.04, 0.045, 0.016, 12), 'brass', shX + 0.18, 1.628, shZ);
  shelf.addGeo('study-shelf-crystal', new THREE.ConeGeometry(0.032, 0.10, 6), 'crystal', shX + 0.18, 1.682, shZ);
  shelf.flush();

  // =========================================================================
  // 5. COMPACT ROUNDED BUTTER-YELLOW READING CHAIR (world [0.55, 0.66, -0.15], width ~0.85)
  // =========================================================================
  const chair = createGroupBatcher('study-reading-chair', { roomSpot: 'chair' });
  const chX = lx(STUDY_LAYOUT.chairCenter[0]); // -0.55
  const chZ = STUDY_LAYOUT.chairCenter[2];     // -0.15
  // Local +Z faces camera (-6.8, 5.6, 7.2) via +PI/4 rotation in X-mirrored studyModel
  const chRot = { ry: Math.PI / 4 };
  const rotPt = (dx, dz) => {
    const c = Math.cos(Math.PI / 4);
    const s = Math.sin(Math.PI / 4);
    return [chX + dx * c + dz * s, chZ - dx * s + dz * c];
  };

  for (const [dx, dz] of [[-0.25, -0.19], [0.25, -0.19], [-0.25, 0.19], [0.25, 0.19]]) {
    const [px, pz] = rotPt(dx, dz);
    chair.addGeo('study-chair-leg', new THREE.CylinderGeometry(0.028, 0.018, 0.14, 12), 'woodDeep', px, 0.29, pz);
  }
  // Rounded base & plump butter-yellow seat cushion
  chair.addBox('study-chair-base', 0.68, 0.10, 0.62, 'chairTrim', chX, 0.39, chZ, 0.045, chRot);
  chair.addGeo('study-chair-seat-cushion', createSoftPillowGeometry(0.58, 0.13, 0.56), 'chairCream', chX, 0.48, chZ + 0.01, chRot);
  // A curved upholstered back and crown share the same seam line.
  const [bx, bz] = rotPt(0, -0.22);
  chair.addBox('study-chair-backrest', 0.72, 0.54, 0.20, 'chairCream', bx, 0.70, bz, 0.048, chRot);
  // Softly rolled rounded armrests
  for (const side of [-0.33, 0.33]) {
    const [ax, az] = rotPt(side, -0.02);
    chair.addBox('study-chair-arm', 0.15, 0.30, 0.54, 'chairTrim', ax, 0.57, az, 0.038, chRot);
    const [arX, arZ] = rotPt(side, -0.01);
    chair.addBox('study-chair-arm-roll', 0.145, 0.125, 0.46, 'chairCream', arX, 0.693, arZ, 0.032, chRot);
  }
  // Turn the pillow loft toward the front of the chair.
  const [cx, cz] = rotPt(0, -0.11);
  const cushion = createSoftPillowGeometry(0.40, 0.11, 0.23);
  cushion.rotateX(Math.PI / 2);
  chair.addGeo('study-chair-cushion', cushion, 'cushionSage', cx, 0.63, cz, chRot);
  chair.flush();

  // =========================================================================
  // 6. SIDE TABLE (world [1.0, 0.73, 0.2], tabletopY = 0.75)
  // =========================================================================
  const sideTable = createGroupBatcher('study-side-table', { roomSpot: 'table' });
  const stX = lx(STUDY_LAYOUT.sideTable.center[0]); // -1.0
  const stZ = STUDY_LAYOUT.sideTable.center[2];     // 0.2
  sideTable.addGeo('study-side-table-top', new THREE.CylinderGeometry(0.21, 0.21, 0.04, 20), 'wood', stX, 0.73, stZ);
  sideTable.addGeo('study-side-table-pedestal', new THREE.CylinderGeometry(0.032, 0.042, 0.47, 12), 'woodDeep', stX, 0.475, stZ);
  sideTable.addGeo('study-side-table-base', new THREE.CylinderGeometry(0.13, 0.15, 0.03, 16), 'woodDeep', stX, 0.235, stZ);
  sideTable.flush();

  // =========================================================================
  // 7. TWO-FLIGHT QUARTER-TURN WOODEN STAIRCASE WITH BROAD LANDING
  //    Lower flight (+X in front-right) -> broad landing (front-right corner)
  //    -> 90-deg turn -> upper flight (-Z along right wall).
  //    Solid miniature timber construction: thick rounded-nosing treads,
  //    deep side stringers, timber landing apron, chunky newel posts with
  //    restrained caps, secondary vertical balusters, and thick handrails.
  //    Every stair mesh tagged userData.activity = 'stairs'.
  // =========================================================================
  const stairs = createGroupBatcher('study-stairs', { activity: 'stairs', roomSpot: 'stairs' });
  const lower = STUDY_LAYOUT.stairs.lowerFlight;
  const landing = STUDY_LAYOUT.stairs.landing;
  const upper = STUDY_LAYOUT.stairs.upperFlight;

  const TREAD_THICK = 0.070;
  const RISER_THICK = 0.042;
  const STRINGER_THICK = 0.070;
  const STRINGER_DEPTH = 0.20;
  const HANDRAIL_W = 0.080;
  const HANDRAIL_H = 0.076;
  const POST_PRIMARY = 0.096;
  const BALUSTER_W = 0.045;
  const CAP_W = 0.112;
  const CAP_H = 0.032;

  function addNewelCap(name, worldX, topY, worldZ) {
    stairs.addBox(name, CAP_W, CAP_H, CAP_W, 'woodDeep', lx(worldX), topY + CAP_H / 2, worldZ, 0.010);
  }

  // 7a. Lower flight (5 steps, +X toward landing)
  for (let i = 0; i < lower.steps; i++) {
    const wx = lower.xStart + (i + 0.5) * lower.stepRun;
    const treadY = lower.yStart + (i + 1) * lower.stepRise;
    stairs.addBox(
      `study-stair-lower-riser-${i}`,
      RISER_THICK,
      lower.stepRise,
      lower.width - 0.02,
      'woodDeep',
      lx(wx - lower.stepRun / 2 + RISER_THICK / 2),
      treadY - lower.stepRise / 2,
      lower.zCenter,
      0.008
    );
    stairs.addBox(
      `study-stair-lower-tread-${i}`,
      lower.stepRun + 0.026,
      TREAD_THICK,
      lower.width + 0.016,
      'wood',
      lx(wx - 0.005),
      treadY - TREAD_THICK / 2,
      lower.zCenter,
      0.020
    );
  }

  const lowerRun = lower.xEnd - lower.xStart;
  const lowerRise = lower.yEnd - lower.yStart;
  const lowerDiag = Math.hypot(lowerRun, lowerRise);
  const lowerSlope = Math.atan2(lowerRise, lowerRun);
  const lowerMidX = (lower.xStart + lower.xEnd) / 2;
  const lowerMidY = (lower.yStart + lower.yEnd) / 2;
  const lowerRailZFront = lower.worldZ[1] - 0.048;
  const lowerRailZBack = lower.worldZ[0] + 0.048;

  for (const [side, rzPos] of [['front', lowerRailZFront], ['back', lowerRailZBack]]) {
    stairs.addBox(
      `study-stair-lower-stringer-${side}`,
      lowerDiag - 0.16,
      STRINGER_DEPTH,
      STRINGER_THICK,
      'woodDeep',
      lx(lowerMidX),
      lowerMidY + 0.03,
      rzPos,
      0.012,
      { rz: -lowerSlope }
    );
    stairs.addBox(
      `study-stair-lower-handrail-${side}`,
      lowerDiag + 0.06,
      HANDRAIL_H,
      HANDRAIL_W,
      'wood',
      lx(lowerMidX),
      lowerMidY + 0.49,
      rzPos,
      0.018,
      { rz: -lowerSlope }
    );
    for (let i = 0; i <= lower.steps; i++) {
      const t = i / lower.steps;
      const px = lower.xStart + t * lowerRun;
      const py = lower.yStart + t * lowerRise;
      const isEnd = i === 0 || i === lower.steps;
      const pw = isEnd ? POST_PRIMARY : BALUSTER_W;
      stairs.addBox(
        `study-stair-lower-post-${side}-${i}`,
        pw,
        0.5,
        pw,
        isEnd ? 'woodDeep' : 'wood',
        lx(px),
        py + 0.25,
        rzPos,
        0.012
      );
      if (isEnd) {
        addNewelCap(`study-stair-lower-cap-${side}-${i}`, px, py + 0.525, rzPos);
      }
    }
  }

  // 7b. Broad turning landing at front-right corner
  const [landW, , landD] = landing.size;
  const [landX, landY, landZ] = landing.center;
  const landDeckH = TREAD_THICK;
  stairs.addBox('study-stair-landing-deck', landW, landDeckH, landD, 'wood', lx(landX), landY - landDeckH / 2, landZ, 0.016);

  // Real wood apron frame beams just under landing deck (not a walking barrier)
  const apronH = 0.14;
  const apronThick = 0.072;
  const apronY = landY - landDeckH - apronH / 2 + 0.01;
  stairs.addBox('study-stair-landing-apron-front', landW - 0.02, apronH, apronThick, 'woodDeep', lx(landX), apronY, landing.worldZ[1] - 0.048, 0.010);
  stairs.addBox('study-stair-landing-apron-back', landW - 0.02, apronH, apronThick, 'woodDeep', lx(landX), apronY, landing.worldZ[0] + 0.048, 0.010);
  stairs.addBox('study-stair-landing-apron-inner', apronThick, apronH, landD - 0.02, 'woodDeep', lx(landing.worldX[0] + 0.048), apronY, landZ, 0.010);
  stairs.addBox('study-stair-landing-apron-outer', apronThick, apronH, landD - 0.02, 'woodDeep', lx(landing.worldX[1] - 0.048), apronY, landZ, 0.010);

  // 4 chunky corner support legs under landing down to floor y = 0.22
  const legH = landY - landDeckH - 0.22 + 0.01;
  const legY = 0.22 + legH / 2;
  for (const [lxPos, lzPos] of [
    [landing.worldX[0] + 0.048, landing.worldZ[1] - 0.048],
    [landing.worldX[1] - 0.048, landing.worldZ[1] - 0.048],
    [landing.worldX[0] + 0.048, landing.worldZ[0] + 0.048],
    [landing.worldX[1] - 0.048, landing.worldZ[0] + 0.048]
  ]) {
    stairs.addBox('study-stair-landing-leg', POST_PRIMARY, legH, POST_PRIMARY, 'woodDeep', lx(lxPos), legY, lzPos, 0.012);
  }

  // Landing outer railings ONLY on +Z (front) and +X (wall) edges; -X and -Z stay open for walking turn
  const landRailFrontZ = landing.worldZ[1] - 0.048;
  const landRailOuterX = landing.worldX[1] - 0.048;
  stairs.addBox('study-stair-landing-rail-front', landW - 0.04, HANDRAIL_H, HANDRAIL_W, 'wood', lx(landX), landY + 0.49, landRailFrontZ, 0.018);
  stairs.addBox('study-stair-landing-post-front-mid', BALUSTER_W, 0.5, BALUSTER_W, 'wood', lx(landX), landY + 0.25, landRailFrontZ, 0.010);
  stairs.addBox('study-stair-landing-post-front-corner', POST_PRIMARY, 0.5, POST_PRIMARY, 'woodDeep', lx(landRailOuterX), landY + 0.25, landRailFrontZ, 0.012);
  addNewelCap('study-stair-landing-cap-front-corner', landRailOuterX, landY + 0.525, landRailFrontZ);

  stairs.addBox('study-stair-landing-rail-outer', HANDRAIL_W, HANDRAIL_H, landD - 0.04, 'wood', lx(landRailOuterX), landY + 0.49, landZ, 0.018);
  stairs.addBox('study-stair-landing-post-outer-mid', BALUSTER_W, 0.5, BALUSTER_W, 'wood', lx(landRailOuterX), landY + 0.25, landZ, 0.010);
  stairs.addBox('study-stair-landing-post-outer-back', POST_PRIMARY, 0.5, POST_PRIMARY, 'woodDeep', lx(landRailOuterX), landY + 0.25, landing.worldZ[0] + 0.048, 0.012);
  addNewelCap('study-stair-landing-cap-outer-back', landRailOuterX, landY + 0.525, landing.worldZ[0] + 0.048);

  // 7c. Upper flight (8 steps, 90-deg turn toward -Z rear wall)
  for (let i = 0; i < upper.steps; i++) {
    const wz = upper.zStart - (i + 0.5) * upper.stepRun;
    const treadY = upper.yStart + (i + 1) * upper.stepRise;
    stairs.addBox(
      `study-stair-upper-riser-${i}`,
      upper.width - 0.02,
      upper.stepRise,
      RISER_THICK,
      'woodDeep',
      lx(upper.xCenter),
      treadY - upper.stepRise / 2,
      wz + upper.stepRun / 2 - RISER_THICK / 2,
      0.008
    );
    stairs.addBox(
      `study-stair-upper-tread-${i}`,
      upper.width + 0.016,
      TREAD_THICK,
      upper.stepRun + 0.026,
      'wood',
      lx(upper.xCenter),
      treadY - TREAD_THICK / 2,
      wz + 0.005,
      0.020
    );
  }

  const upperRun = upper.zStart - upper.zEnd;
  const upperRise = upper.yEnd - upper.yStart;
  const upperDiag = Math.hypot(upperRun, upperRise);
  const upperSlope = Math.atan2(upperRise, upperRun);
  const upperMidZ = (upper.zStart + upper.zEnd) / 2;
  const upperMidY = (upper.yStart + upper.yEnd) / 2;
  const upperInnerX = upper.worldX[0] + 0.048;
  const upperOuterX = upper.worldX[1] - 0.048;

  for (const [side, sxPos] of [['inner', upperInnerX], ['outer', upperOuterX]]) {
    stairs.addBox(
      `study-stair-upper-stringer-${side}`,
      STRINGER_THICK,
      STRINGER_DEPTH,
      upperDiag + 0.04,
      'woodDeep',
      lx(sxPos),
      upperMidY - 0.02,
      upperMidZ,
      0.012,
      { rx: upperSlope }
    );
  }

  // Open timber support posts under upper flight (no solid triangular wall)
  for (const pz of [-0.4, -1.5]) {
    const t = (upper.zStart - pz) / upperRun;
    const topY = upper.yStart + t * upperRise - 0.03;
    const postH = topY - 0.22;
    for (const sxPos of [upperInnerX, upperOuterX]) {
      stairs.addBox(
        `study-stair-upper-support-${pz}`,
        POST_PRIMARY,
        postH,
        POST_PRIMARY,
        'woodDeep',
        lx(sxPos),
        0.22 + postH / 2,
        pz,
        0.012
      );
    }
  }

  // Upper flight inner handrail + anchored posts + secondary balusters (below y = 3.0 wall cap)
  stairs.addBox(
    'study-stair-upper-handrail',
    HANDRAIL_W,
    HANDRAIL_H,
    upperDiag + 0.06,
    'wood',
    lx(upperInnerX),
    upperMidY + 0.49,
    upperMidZ,
    0.018,
    { rx: upperSlope }
  );
  for (let i = 0; i <= upper.steps; i++) {
    const t = i / upper.steps;
    const pz = upper.zStart - t * upperRun;
    const py = upper.yStart + t * upperRise;
    const isEnd = i === 0 || i === upper.steps;
    const pw = isEnd ? POST_PRIMARY : BALUSTER_W;
    stairs.addBox(
      `study-stair-upper-post-${i}`,
      pw,
      0.5,
      pw,
      isEnd ? 'woodDeep' : 'wood',
      lx(upperInnerX),
      py + 0.25,
      pz,
      0.012
    );
    if (isEnd) {
      addNewelCap(`study-stair-upper-cap-${i}`, upperInnerX, py + 0.525, pz);
    }
  }
  stairs.flush();

  return {
    root,
    getState() {
      const parts = [];
      let meshCount = 0;
      root.traverse((o) => {
        if (o.isMesh) {
          meshCount++;
          parts.push(o.name);
        }
      });
      return {
        parts,
        meshCount,
        hiddenOriginalCount: hiddenOriginals.length,
        disposed
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const rec of hiddenOriginals) {
        rec.mesh.visible = rec.visible;
      }
      for (const g of ownedGeometries) g.dispose();
      for (const m of Object.values(materials)) m.dispose();
      root.removeFromParent();
    }
  };
}
