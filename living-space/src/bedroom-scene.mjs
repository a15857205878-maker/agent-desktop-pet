import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BED_REST_ANCHOR, createBedRestContactLayer } from './bed-rest-contact.mjs';
import { createBedroomCozyDetails } from './bedroom-cozy-details.mjs';
import { createSoftPillowGeometry, createSoftQuiltGeometry } from './softness-geometry.mjs';

export const STUDY_STAIRS_POINT = Object.freeze([1.62, 0.58, 1.66]);
export const BEDROOM_POINTS = Object.freeze({
  stairs: Object.freeze([1.36, 0.24, 1.12]),
  reading: Object.freeze([-0.86, 0.56, -0.66]),
  bed: Object.freeze([1.18, 0.62, -0.47]),
  lamp: Object.freeze([1.66, 0.92, 0.22]),
  bookshelf: Object.freeze([-0.46, 0.74, -1.52]),
  companionReadingBase: Object.freeze([-1.08, 0.61, -0.44]),
  companionBedBase: BED_REST_ANCHOR,
  companionBedRiseBase: BED_REST_ANCHOR
});

/**
 * Provides compatible depth occlusion layer groups (room-back, furniture-back,
 * furniture-front, props-hotspots) and the clickable stair entry hotspot for the
 * 1F study room. The full staircase geometry lives in reference-study-room.mjs.
 */
export function createStudyStairsAndLayers(studyModel, parentScene) {
  const root = new THREE.Group();
  root.name = 'study-layered-extensions';
  parentScene.add(root);

  const roomBack = new THREE.Group();
  roomBack.name = 'room-back';
  const furnitureBack = new THREE.Group();
  furnitureBack.name = 'furniture-back';
  const furnitureFront = new THREE.Group();
  furnitureFront.name = 'furniture-front';
  const propsHotspots = new THREE.Group();
  propsHotspots.name = 'props-hotspots';
  root.add(roomBack, furnitureBack, furnitureFront, propsHotspots);

  let disposed = false;
  const geometries = [];
  const materials = {
    hotspot: new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.001,
      depthWrite: false
    })
  };

  function trackGeo(g) {
    geometries.push(g);
    return g;
  }

  function addBox(group, name, w, h, d, matKey, x, y, z, r = 0.012) {
    const geo = trackGeo(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 4, h / 4, d / 4)));
    const mesh = new THREE.Mesh(geo, materials[matKey]);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    return mesh;
  }

  // Clickable 3D entry hotspot for the full study staircase (entry [1.62, 0.58, 1.66])
  const stairHotspot = addBox(propsHotspots, 'study-stairs-hotspot', 0.68, 0.90, 0.72, 'hotspot', 1.55, 0.62, 1.48, 0.01);
  stairHotspot.userData.activity = 'stairs';
  stairHotspot.userData.roomSpot = 'stairs';

  return {
    root,
    groups: {
      'room-back': roomBack,
      'furniture-back': furnitureBack,
      'furniture-front': furnitureFront,
      'props-hotspots': propsHotspots
    },
    stairsHotspot: stairHotspot,
    stairsPoint: [...STUDY_STAIRS_POINT],
    setVisible(visible) {
      root.visible = !!visible;
      if (studyModel) studyModel.visible = !!visible;
    },
    getSummary() {
      return {
        layerNames: ['room-back', 'furniture-back', 'companion', 'furniture-front', 'props-hotspots'],
        furnitureBackCount: furnitureBack.children.length,
        furnitureFrontCount: furnitureFront.children.length,
        hotspotCount: propsHotspots.children.length,
        maxFrontOccluderY: 0,
        stairsPoint: [...STUDY_STAIRS_POINT]
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const g of geometries) g.dispose();
      for (const m of Object.values(materials)) m.dispose();
      root.removeFromParent();
    }
  };
}

/**
 * Builds the standalone 3D Bedroom scene (二层卧室) with true 3D meshes,
 * a real stairwell cutout in the floor slab, descending steps, safety railing
 * with an unobstructed top landing, bed, wardrobe, nightstand + lamp,
 * open-frame low bookshelf (showing two visible rows of book spines),
 * and properly oriented reading chair behind the seated companion.
 */
export function createBedroomScene(parentScene) {
  const root = new THREE.Group();
  root.name = 'bedroom-scene-root';
  root.visible = false;
  if (parentScene) parentScene.add(root);

  const roomBack = new THREE.Group();
  roomBack.name = 'room-back';
  const furnitureBack = new THREE.Group();
  furnitureBack.name = 'furniture-back';
  const furnitureFront = new THREE.Group();
  furnitureFront.name = 'furniture-front';
  const propsHotspots = new THREE.Group();
  propsHotspots.name = 'props-hotspots';
  root.add(roomBack, furnitureBack, furnitureFront, propsHotspots);

  let disposed = false;
  let softLightOn = false;
  const geometries = [];

  const materials = {
    wall: new THREE.MeshStandardMaterial({ color: '#f6efe4', roughness: 0.92 }),
    floor: new THREE.MeshStandardMaterial({ color: '#dfb17b', roughness: 0.80 }),
    floorPlankLine: new THREE.MeshStandardMaterial({ color: '#c79660', roughness: 0.86 }),
    plinthTrim: new THREE.MeshStandardMaterial({ color: '#8f6239', roughness: 0.84 }),
    stairWellWall: new THREE.MeshStandardMaterial({ color: '#b58858', roughness: 0.88 }),
    stairPit: new THREE.MeshStandardMaterial({ color: '#3b2e2a', roughness: 0.95 }),
    wood: new THREE.MeshStandardMaterial({ color: '#c69866', roughness: 0.82 }),
    woodDeep: new THREE.MeshStandardMaterial({ color: '#a87b4c', roughness: 0.84 }),
    shelfBack: new THREE.MeshStandardMaterial({ color: '#b38656', roughness: 0.86 }),
    creamDoor: new THREE.MeshStandardMaterial({ color: '#f7f0e2', roughness: 0.86 }),
    mattress: new THREE.MeshStandardMaterial({ color: '#fbf5ea', roughness: 0.88 }),
    quiltCream: new THREE.MeshStandardMaterial({ color: '#f7eedc', roughness: 0.90 }),
    lavender: new THREE.MeshStandardMaterial({ color: '#af8dce', roughness: 0.86 }),
    lavenderDeep: new THREE.MeshStandardMaterial({ color: '#9371b4', roughness: 0.86 }),
    chairCream: new THREE.MeshStandardMaterial({ color: '#b6cfb9', roughness: 0.88 }),
    chairTrim: new THREE.MeshStandardMaterial({ color: '#8ead9a', roughness: 0.88 }),
    cushionSage: new THREE.MeshStandardMaterial({ color: '#dfb0a0', roughness: 0.90 }),
    rugMain: new THREE.MeshStandardMaterial({ color: '#e6d5be', roughness: 0.94 }),
    rugBorder: new THREE.MeshStandardMaterial({ color: '#ccb59a', roughness: 0.94 }),
    curtain: new THREE.MeshStandardMaterial({ color: '#eed9e6', roughness: 0.92, side: THREE.DoubleSide }),
    windowSky: new THREE.MeshBasicMaterial({ color: '#d8ecff', toneMapped: false }),
    windowSun: new THREE.MeshBasicMaterial({ color: '#fff3cf', transparent: true, opacity: 0.55, toneMapped: false }),
    sunPatch: new THREE.MeshBasicMaterial({ color: '#fff2c6', transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false }),
    lampShade: new THREE.MeshStandardMaterial({
      color: '#fae8be',
      emissive: '#ffcf7c',
      emissiveIntensity: 0.45,
      roughness: 0.65
    }),
    brass: new THREE.MeshStandardMaterial({ color: '#c8a568', metalness: 0.28, roughness: 0.58 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#92b079', roughness: 0.84 }),
    pot: new THREE.MeshStandardMaterial({ color: '#eadac0', roughness: 0.82 }),
    bookMint: new THREE.MeshStandardMaterial({ color: '#8ab8a8', roughness: 0.82 }),
    bookPeach: new THREE.MeshStandardMaterial({ color: '#e4a68b', roughness: 0.82 }),
    bookSky: new THREE.MeshStandardMaterial({ color: '#92b4d4', roughness: 0.82 }),
    crystal: new THREE.MeshStandardMaterial({ color: '#b399d4', roughness: 0.48 }),
    hotspot: new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.001,
      depthWrite: false
    })
  };

  function trackGeo(g) {
    geometries.push(g);
    return g;
  }

  function addMesh(group, name, geo, matKey, x, y, z) {
    trackGeo(geo);
    const m = new THREE.Mesh(geo, materials[matKey]);
    m.name = name;
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }

  function addBox(group, name, w, h, d, matKey, x, y, z, r = 0.012) {
    const geo = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 4, h / 4, d / 4));
    return addMesh(group, name, geo, matKey, x, y, z);
  }

  function addArchedBedPanel(name, width, bottom, shoulder, crown, thickness, x, matKey) {
    const half = width / 2;
    const bevel = 0.009;
    const outline = new THREE.Shape();
    outline.moveTo(-half, bottom);
    outline.lineTo(half, bottom);
    outline.lineTo(half, shoulder);
    outline.quadraticCurveTo(0, 2 * crown - shoulder, -half, shoulder);
    outline.closePath();
    const geometry = new THREE.ExtrudeGeometry(outline, {
      depth: thickness - 2 * bevel,
      bevelEnabled: true,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 2,
      curveSegments: 16
    });
    geometry.translate(0, 0, -(thickness - 2 * bevel) / 2);
    geometry.rotateY(-Math.PI / 2);
    return addMesh(bedBack, name, geometry, matKey, x, 0, -0.47);
  }

  // =========================================================================
  // 1. ROOM-BACK: Floor slabs with true stairwell cutout, descending steps,
  //    double cutaway walls, top beams, window + curtains, rug & sun patch
  // =========================================================================
  addBox(roomBack, 'bedroom-floor-main', 2.88, 0.22, 4.0, 'floor', -0.56, 0.11, 0.0, 0.01);
  addBox(roomBack, 'bedroom-floor-back-right', 1.12, 0.22, 2.48, 'floor', 1.44, 0.11, -0.76, 0.01);
  addBox(roomBack, 'bedroom-floor-front-right', 1.12, 0.22, 0.28, 'floor', 1.44, 0.11, 1.86, 0.01);
  addBox(roomBack, 'bedroom-floor-outer-right', 0.16, 0.22, 1.24, 'floor', 1.92, 0.11, 1.10, 0.008);

  addBox(roomBack, 'bedroom-plinth-trim-left', 0.08, 0.18, 4.04, 'plinthTrim', -1.98, 0.09, 0.0, 0.01);
  addBox(roomBack, 'bedroom-plinth-trim-front', 4.04, 0.18, 0.08, 'plinthTrim', 0.0, 0.09, 1.98, 0.01);

  for (const x of [-1.4, -0.8, -0.2, 0.4]) {
    addBox(roomBack, `bedroom-plank-line-${x}`, 0.012, 0.004, 3.86, 'floorPlankLine', x, 0.221, 0.0, 0.001);
  }

  // Stairwell recessed pit & 4 short descending wooden steps inside x in [0.88, 1.84], z in [0.48, 1.72]
  addBox(roomBack, 'bedroom-stairwell-inner-wall-left', 0.04, 0.62, 1.24, 'stairWellWall', 0.90, -0.09, 1.10, 0.004);
  addBox(roomBack, 'bedroom-stairwell-inner-wall-right', 0.04, 0.62, 1.24, 'stairWellWall', 1.82, -0.09, 1.10, 0.004);
  addBox(roomBack, 'bedroom-stairwell-inner-wall-front', 0.96, 0.62, 0.04, 'stairWellWall', 1.36, -0.09, 1.70, 0.004);
  const pit = addBox(roomBack, 'bedroom-stairwell-pit-bottom', 0.92, 0.04, 1.20, 'stairPit', 1.36, -0.38, 1.10, 0.002);
  pit.castShadow = false;

  for (let i = 0; i < 4; i++) {
    const sz = 0.62 + i * 0.26;
    const sy = 0.12 - i * 0.11;
    const stepMesh = addBox(roomBack, `bedroom-down-step-${i}`, 0.88, 0.045, 0.24, 'wood', 1.36, sy, sz, 0.008);
    stepMesh.userData.bedroomSpot = 'stairs';
    const riserMesh = addBox(roomBack, `bedroom-down-riser-${i}`, 0.86, 0.11, 0.03, 'creamDoor', 1.36, sy + 0.055, sz - 0.11, 0.004);
    riserMesh.userData.bedroomSpot = 'stairs';
  }

  // Cutaway walls: left-back rear wall built with a true window opening at x in [-1.05, 0.13], y in [1.23, 2.41]
  addBox(roomBack, 'bedroom-wall-left-back-left-seg', 0.95, 2.68, 0.14, 'wall', -1.525, 1.56, -1.93, 0.008);
  addBox(roomBack, 'bedroom-wall-left-back-right-seg', 1.87, 2.68, 0.14, 'wall', 1.065, 1.56, -1.93, 0.008);
  addBox(roomBack, 'bedroom-wall-left-back-bottom-seg', 1.18, 1.01, 0.14, 'wall', -0.46, 0.725, -1.93, 0.006);
  addBox(roomBack, 'bedroom-wall-left-back-top-seg', 1.18, 0.49, 0.14, 'wall', -0.46, 2.655, -1.93, 0.006);
  addBox(roomBack, 'bedroom-wall-right-back', 0.14, 2.68, 4.0, 'wall', 1.93, 1.56, 0.0, 0.01);

  addBox(roomBack, 'bedroom-top-beam-left', 4.04, 0.13, 0.18, 'wood', 0.0, 2.94, -1.92, 0.018);
  addBox(roomBack, 'bedroom-top-beam-right', 0.18, 0.13, 4.04, 'wood', 1.92, 2.94, 0.0, 0.018);
  addBox(roomBack, 'bedroom-baseboard-left', 3.86, 0.09, 0.03, 'creamDoor', -0.02, 0.265, -1.85, 0.004);
  addBox(roomBack, 'bedroom-baseboard-right', 0.03, 0.09, 3.86, 'creamDoor', 1.85, 0.265, 0.02, 0.004);

  // Left-back window (glass & glow inside aperture, never cast shadow)
  const winX = -0.46;
  const winY = 1.82;
  const winZ = -1.84;
  const winGlass = addBox(roomBack, 'bedroom-window-glass', 1.18, 1.18, 0.02, 'windowSky', winX, winY, -1.93, 0.002);
  winGlass.castShadow = false;
  winGlass.receiveShadow = false;
  const winGlow = addBox(roomBack, 'bedroom-window-sun-glow', 1.12, 0.54, 0.022, 'windowSun', winX, winY - 0.24, -1.926, 0.002);
  winGlow.castShadow = false;
  winGlow.receiveShadow = false;
  for (const dx of [-0.60, 0.0, 0.60]) {
    addBox(roomBack, 'bedroom-window-mullion-v', 0.045, 1.24, 0.045, 'wood', winX + dx, winY, winZ + 0.01, 0.006);
  }
  for (const dy of [-0.60, 0.0, 0.60]) {
    addBox(roomBack, 'bedroom-window-mullion-h', 1.26, 0.045, 0.045, 'wood', winX, winY + dy, winZ + 0.01, 0.006);
  }
  addBox(roomBack, 'bedroom-windowsill', 1.38, 0.055, 0.22, 'wood', winX, 1.18, -1.77, 0.01);
  for (const dx of [-0.48, 0.48]) {
    addBox(roomBack, 'bedroom-sill-corbel', 0.06, 0.14, 0.10, 'woodDeep', winX + dx, 1.09, -1.80, 0.008);
  }

  const rod = addMesh(roomBack, 'bedroom-curtain-rod', new THREE.CylinderGeometry(0.016, 0.016, 1.54, 12), 'woodDeep', winX, 2.54, -1.78);
  rod.rotation.z = Math.PI / 2;
  for (const dx of [-0.54, 0.54]) {
    addBox(roomBack, 'bedroom-curtain-drape', 0.24, 1.26, 0.04, 'curtain', winX + dx, 1.88, -1.78, 0.012);
    addBox(roomBack, 'bedroom-curtain-tieback', 0.25, 0.036, 0.048, 'lavender', winX + dx, 1.62, -1.77, 0.008);
  }

  addMesh(roomBack, 'bedroom-sill-pot', new THREE.CylinderGeometry(0.055, 0.042, 0.09, 14), 'pot', winX - 0.28, 1.25, -1.74);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const leaf = addMesh(
      roomBack,
      `bedroom-sill-leaf-${i}`,
      new THREE.IcosahedronGeometry(0.045, 0),
      'leaf',
      winX - 0.28 + Math.sin(a) * 0.025,
      1.31 + (i % 2) * 0.012,
      -1.74 + Math.cos(a) * 0.025
    );
    leaf.scale.set(1, 0.5, 1);
  }

  // Braided oval rug in front of the reading nook & warm sunlight patch on the floor
  const rugOuter = addMesh(roomBack, 'bedroom-reading-rug-border', new THREE.CylinderGeometry(0.58, 0.58, 0.012, 32), 'rugBorder', -0.92, 0.226, -0.34);
  rugOuter.scale.set(1.16, 1, 0.88);
  const rugInner = addMesh(roomBack, 'bedroom-reading-rug-center', new THREE.CylinderGeometry(0.45, 0.45, 0.015, 32), 'rugMain', -0.92, 0.228, -0.34);
  rugInner.scale.set(1.16, 1, 0.88);

  const sunPatch = addMesh(roomBack, 'bedroom-sunlight-floor-patch', new THREE.PlaneGeometry(0.92, 0.64), 'sunPatch', -0.08, 0.225, -0.42);
  sunPatch.rotation.x = -Math.PI / 2;
  sunPatch.castShadow = false;

  // =========================================================================
  // 2. FURNITURE-BACK: Wardrobe, Open-Frame Low Bookshelf, Reading Chair,
  //    Bed, Nightstand & Bedside Lamp
  // =========================================================================
  // 2a. Wardrobe in back corner (x=0.68, z=-1.56)
  const wardrobe = new THREE.Group();
  wardrobe.name = 'bedroom-wardrobe';
  furnitureBack.add(wardrobe);
  addBox(wardrobe, 'wardrobe-body', 0.86, 1.88, 0.50, 'wood', 0.68, 1.16, -1.58, 0.014);
  addBox(wardrobe, 'wardrobe-crown', 0.92, 0.07, 0.54, 'woodDeep', 0.68, 2.12, -1.58, 0.012);
  for (const dx of [-0.20, 0.20]) {
    addBox(wardrobe, 'wardrobe-door', 0.36, 1.32, 0.025, 'creamDoor', 0.68 + dx, 1.34, -1.32, 0.008);
    addBox(wardrobe, 'wardrobe-drawer', 0.36, 0.32, 0.025, 'creamDoor', 0.68 + dx, 0.48, -1.32, 0.008);
  }
  for (const dx of [-0.04, 0.04]) {
    addBox(wardrobe, 'wardrobe-handle', 0.02, 0.14, 0.03, 'woodDeep', 0.68 + dx, 1.32, -1.30, 0.005);
  }

  // 2b. Open-Frame Low Bookshelf under window (x=-0.46, z=-1.64)
  // Constructed from distinct back panel, left/right side boards, and bottom/middle/top shelves
  // so the front (z=-1.49) is completely open and both upper & lower rows of books are clearly visible!
  const bookshelf = new THREE.Group();
  bookshelf.name = 'bedroom-bookshelf';
  furnitureBack.add(bookshelf);
  addBox(bookshelf, 'bedroom-bookshelf-back-panel', 0.96, 0.78, 0.03, 'shelfBack', -0.46, 0.61, -1.78, 0.006);
  addBox(bookshelf, 'bedroom-bookshelf-side-left', 0.042, 0.78, 0.30, 'wood', -0.92, 0.61, -1.64, 0.008);
  addBox(bookshelf, 'bedroom-bookshelf-side-right', 0.042, 0.78, 0.30, 'wood', 0.00, 0.61, -1.64, 0.008);
  addBox(bookshelf, 'bedroom-bookshelf-bottom-shelf', 0.92, 0.04, 0.30, 'woodDeep', -0.46, 0.24, -1.64, 0.006);
  addBox(bookshelf, 'bedroom-bookshelf-mid-shelf', 0.90, 0.035, 0.29, 'woodDeep', -0.46, 0.60, -1.64, 0.006);
  addBox(bookshelf, 'bedroom-bookshelf-top-shelf', 0.98, 0.042, 0.32, 'wood', -0.46, 0.98, -1.64, 0.008);

  const bookColors = ['lavender', 'bookMint', 'bookPeach', 'creamDoor', 'bookSky', 'lavenderDeep'];
  for (let i = 0; i < 7; i++) {
    const bx = -0.83 + i * 0.12;
    const upperH = 0.22 + (i % 3) * 0.02;
    const lowerH = 0.24 - (i % 2) * 0.02;
    addBox(
      bookshelf,
      `bedroom-book-upper-${i}`,
      0.052,
      upperH,
      0.22,
      bookColors[i % bookColors.length],
      bx,
      0.62 + upperH / 2,
      -1.60,
      0.005
    );
    addBox(
      bookshelf,
      `bedroom-book-lower-${i}`,
      0.056,
      lowerH,
      0.22,
      bookColors[(i + 2) % bookColors.length],
      bx + 0.01,
      0.26 + lowerH / 2,
      -1.60,
      0.005
    );
  }
  addBox(bookshelf, 'bedroom-shelf-notebook', 0.20, 0.03, 0.15, 'lavender', -0.70, 1.018, -1.62, 0.005);
  addMesh(bookshelf, 'bedroom-shelf-crystal-base', new THREE.CylinderGeometry(0.04, 0.045, 0.016, 12), 'brass', -0.20, 1.01, -1.62);
  addMesh(bookshelf, 'bedroom-shelf-crystal', new THREE.ConeGeometry(0.032, 0.10, 6), 'crystal', -0.20, 1.065, -1.62);
  bookshelf.traverse((o) => {
    if (o.isMesh) o.userData.bedroomSpot = 'bookshelf';
  });

  // 2c. Reading Chair in furniture-back:
  // Wide, recognizable barrel/wingback armchair oriented toward the front-left camera (-6.8, 5.6, 7.2)
  // and centered behind companionReadingBase = [-1.08, 0.65, -0.44] (chair localX = 0, localZ = +0.311).
  // Its wide seat (0.90w), wooden base frame (0.96w), rolled side armrests (localX = ±0.43, total width 1.01),
  // and wingback backrest/ears (total width 1.00) extend visibly outside both sides of the companion silhouette,
  // while every vertex above y=0.40 stays strictly behind the companion billboard plane in 3D camera depth.
  const readingChairBack = new THREE.Group();
  readingChairBack.name = 'bedroom-reading-chair-back';
  readingChairBack.position.set(-0.86, 0.22, -0.66);
  readingChairBack.rotation.y = -Math.PI / 4; // Local +X = screen-right, Local +Z = toward front-left camera
  readingChairBack.scale.set(0.78, 0.85, 0.80);
  furnitureBack.add(readingChairBack);

  addBox(readingChairBack, 'reading-chair-base-frame', 0.96, 0.08, 0.52, 'wood', 0.0, 0.14, -0.02, 0.015);
  addBox(readingChairBack, 'reading-chair-seat-piping', 0.94, 0.04, 0.54, 'lavender', 0.0, 0.19, -0.01, 0.015);
  addBox(readingChairBack, 'reading-chair-seat', 0.90, 0.15, 0.52, 'chairCream', 0.0, 0.25, -0.02, 0.035);
  addBox(readingChairBack, 'reading-chair-back-trim', 0.98, 0.78, 0.10, 'wood', 0.0, 0.56, -0.26, 0.025);
  const readingBackCushion = createSoftPillowGeometry(0.88, 0.12, 0.72);
  readingBackCushion.rotateX(Math.PI / 2);
  addMesh(readingChairBack, 'reading-chair-backrest', readingBackCushion, 'chairCream', 0.0, 0.55, -0.22);
  addBox(readingChairBack, 'reading-chair-ear-left', 0.14, 0.34, 0.22, 'chairTrim', -0.43, 0.72, -0.17, 0.025);
  addBox(readingChairBack, 'reading-chair-ear-right', 0.14, 0.34, 0.22, 'chairTrim', 0.43, 0.72, -0.17, 0.025);
  addBox(readingChairBack, 'reading-chair-wing-left', 0.15, 0.30, 0.44, 'chairTrim', -0.43, 0.38, -0.04, 0.03);
  addBox(readingChairBack, 'reading-chair-wing-right', 0.15, 0.30, 0.44, 'chairTrim', 0.43, 0.38, -0.04, 0.03);
  for (const [side, x] of [['left', -0.43], ['right', 0.43]]) {
    addBox(readingChairBack, `reading-chair-armcap-${side}`, 0.16, 0.085, 0.46, 'chairCream', x, 0.521, -0.04, 0.021);
  }
  const readingThrowPillow = createSoftPillowGeometry(0.52, 0.09, 0.24);
  readingThrowPillow.rotateX(Math.PI / 2);
  addMesh(readingChairBack, 'reading-chair-pillow', readingThrowPillow, 'cushionSage', 0.0, 0.42, -0.14);

  for (const [lx, lz] of [
    [-0.42, -0.22],
    [0.42, -0.22],
    [-0.42, 0.18],
    [0.42, 0.18]
  ]) {
    addMesh(readingChairBack, 'reading-chair-leg', new THREE.CylinderGeometry(0.032, 0.024, 0.14, 10), 'woodDeep', lx, 0.07, lz);
  }
  readingChairBack.traverse((o) => {
    if (o.isMesh) o.userData.bedroomSpot = 'reading';
  });

  // 2d. Bed against the right-back wall (headboard at x=1.81, bed extends to x=0.58, z in [-0.92, -0.02])
  const bedBack = new THREE.Group();
  bedBack.name = 'bedroom-bed-back';
  furnitureBack.add(bedBack);
  addArchedBedPanel('bed-headboard', 0.85, 0.31, 1.005, 1.126, 0.075, 1.81, 'woodDeep');
  addArchedBedPanel('bed-headboard-inset', 0.66, 0.43, 0.948, 1.052, 0.027, 1.77, 'wood');
  for (const z of [-0.90, -0.04]) {
    addBox(bedBack, 'bed-headboard-wood-post', 0.098, 0.91, 0.078, 'wood', 1.806, 0.675, z, 0.019);
  }
  addBox(bedBack, 'bed-frame-base', 1.24, 0.18, 0.92, 'wood', 1.20, 0.34, -0.47, 0.035);
  for (const [bx, bz] of [
    [1.80, -0.90],
    [1.80, -0.04],
    [0.60, -0.90],
    [0.60, -0.04]
  ]) {
    addBox(bedBack, 'bed-leg-post', 0.07, 0.28, 0.07, 'woodDeep', bx, 0.36, bz, 0.01);
  }
  addBox(bedBack, 'bed-mattress', 1.16, 0.20, 0.86, 'mattress', 1.20, 0.50, -0.47, 0.035);
  addMesh(
    bedBack,
    'bed-quilt-cream',
    createSoftQuiltGeometry(0.86, 0.22, 0.88, { puffAmp: 0.005 }),
    'quiltCream',
    1.06,
    0.51,
    -0.47
  );
  addMesh(
    bedBack,
    'bed-blanket-lavender',
    createSoftQuiltGeometry(0.44, 0.23, 0.89, { puffAmp: 0.004 }),
    'lavender',
    0.88,
    0.515,
    -0.47
  );
  for (const pz of [-0.67, -0.27]) {
    const pMesh = addMesh(
      bedBack,
      'bed-pillow-lavender',
      createSoftPillowGeometry(0.24, 0.16, 0.34),
      'lavender',
      1.62,
      0.64,
      pz
    );
    pMesh.rotation.z = 0.22;
  }
  addMesh(
    bedBack,
    'bed-pillow-front-accent',
    createSoftPillowGeometry(0.18, 0.12, 0.28),
    'lavenderDeep',
    1.48,
    0.63,
    -0.47
  );
  bedBack.traverse((o) => {
    if (o.isMesh) o.userData.bedroomSpot = 'bed';
  });

  // 2e. Nightstand & Bedside Lamp
  const nightstand = new THREE.Group();
  nightstand.name = 'bedroom-nightstand';
  furnitureBack.add(nightstand);
  addBox(nightstand, 'nightstand-wood-body', 0.38, 0.38, 0.36, 'wood', 1.66, 0.46, 0.22, 0.017);
  addBox(nightstand, 'nightstand-wood-top', 0.42, 0.04, 0.40, 'woodDeep', 1.66, 0.67, 0.22, 0.01);
  addBox(nightstand, 'nightstand-drawer', 0.025, 0.13, 0.286, 'creamDoor', 1.466, 0.558, 0.22, 0.006);
  addBox(nightstand, 'nightstand-lower-door', 0.018, 0.17, 0.276, 'woodDeep', 1.466, 0.385, 0.22, 0.004);
  addBox(nightstand, 'nightstand-wood-door-panel', 0.012, 0.133, 0.238, 'wood', 1.454, 0.385, 0.22, 0.003);
  addMesh(nightstand, 'nightstand-drawer-knob', new THREE.SphereGeometry(0.021, 12, 8), 'brass', 1.442, 0.558, 0.22);
  addMesh(nightstand, 'nightstand-door-knob', new THREE.SphereGeometry(0.014, 12, 8), 'brass', 1.444, 0.425, 0.301);
  for (const x of [1.515, 1.79]) {
    for (const z of [0.082, 0.358]) {
      addBox(nightstand, 'nightstand-wood-foot', 0.056, 0.075, 0.056, 'woodDeep', x, 0.255, z, 0.01);
    }
  }

  const lampGroup = new THREE.Group();
  lampGroup.name = 'bedroom-bedside-lamp';
  furnitureBack.add(lampGroup);
  addMesh(lampGroup, 'bedroom-lamp-base', new THREE.CylinderGeometry(0.06, 0.08, 0.03, 16), 'brass', 1.66, 0.705, 0.22);
  addMesh(lampGroup, 'bedroom-lamp-stem', new THREE.CylinderGeometry(0.018, 0.022, 0.16, 12), 'brass', 1.66, 0.79, 0.22);
  const lampShade = addMesh(lampGroup, 'bedroom-lamp-shade', new THREE.CylinderGeometry(0.08, 0.13, 0.16, 20), 'lampShade', 1.66, 0.92, 0.22);
  lampShade.castShadow = false;
  lampGroup.traverse((o) => {
    if (o.isMesh) {
      o.userData.roomLamp = true;
      o.userData.bedroomSpot = 'lamp';
    }
  });

  const bedsideLight = new THREE.PointLight('#ffc978', 0.8, 3.6, 1.8);
  bedsideLight.position.set(1.56, 0.95, 0.22);
  bedsideLight.castShadow = false;
  root.add(bedsideLight);

  // =========================================================================
  // 3. FURNITURE-FRONT: True 3D Foreground Occluders
  //    - Stairwell safety railing along inner drop edge (x=0.88, z in [0.56, 1.70])
  //      and front end (z=1.70), leaving top stair entrance (z=0.48) 100% OPEN!
  //    - Bed footboard lower frame (x=0.59, y in [0.22, 0.55])
  //    - Reading chair low outer-left footrest/apron rim (world y in [0.23, 0.34],
  //      only at ankle/lower-leg level, completely clear of hair, face, and torso!)
  // =========================================================================
  const stairRailing = new THREE.Group();
  stairRailing.name = 'bedroom-stairwell-railing';
  furnitureFront.add(stairRailing);

  addBox(stairRailing, 'bedroom-rail-top-bar', 0.055, 0.048, 1.18, 'wood', 0.88, 0.78, 1.13, 0.01);
  addBox(stairRailing, 'bedroom-rail-bottom-bar', 0.045, 0.032, 1.16, 'woodDeep', 0.88, 0.28, 1.13, 0.008);
  for (let i = 0; i < 7; i++) {
    const bz = 0.56 + i * 0.19;
    const isPost = i === 0 || i === 6;
    addBox(
      stairRailing,
      `bedroom-rail-baluster-${i}`,
      isPost ? 0.055 : 0.032,
      isPost ? 0.60 : 0.50,
      isPost ? 0.055 : 0.032,
      isPost ? 'woodDeep' : 'wood',
      0.88,
      0.52,
      bz,
      0.008
    );
  }
  addBox(stairRailing, 'bedroom-rail-front-top', 0.96, 0.048, 0.055, 'wood', 1.35, 0.78, 1.70, 0.01);
  for (let i = 1; i <= 4; i++) {
    const bx = 0.88 + i * 0.23;
    addBox(stairRailing, `bedroom-rail-front-baluster-${i}`, 0.034, 0.52, 0.034, 'wood', bx, 0.52, 1.70, 0.008);
  }

  const footboard = addBox(furnitureFront, 'bedroom-bed-footboard-front', 0.055, 0.34, 0.92, 'wood', 0.59, 0.39, -0.47, 0.013);
  footboard.userData.bedroomSpot = 'bed';
  const footPanel = addBox(furnitureFront, 'bed-footboard-inset', 0.012, 0.22, 0.73, 'woodDeep', 0.558, 0.382, -0.47, 0.003);
  footPanel.userData.bedroomSpot = 'bed';
  for (const z of [-0.885, -0.055]) {
    const post = addBox(furnitureFront, 'bed-footboard-wood-post', 0.072, 0.34, 0.076, 'wood', 0.586, 0.39, z, 0.012);
    post.userData.bedroomSpot = 'bed';
  }

  // Connected front-left lower armrest base/leg trim at the exact front-left corner of the scaled reading chair
  // (localX = -0.335, localZ = +0.144 -> world (-1.199, 0.288, -0.795)), eliminating any floating block in front of the feet.
  const frontArm = addBox(furnitureFront, 'bedroom-reading-chair-front-arm', 0.11, 0.085, 0.096, 'woodDeep', -1.199, 0.288, -0.795, 0.012);
  frontArm.rotation.y = -Math.PI / 4;
  frontArm.userData.bedroomSpot = 'reading';

  // =========================================================================
  // 4. PROPS-HOTSPOTS: Explicit 3D Hit Meshes for Stairs, Reading, Bed, Lamp, Bookshelf
  // =========================================================================
  const stairsHotspot = addBox(propsHotspots, 'bedroom-stairs-hotspot', 0.92, 0.42, 1.22, 'hotspot', 1.36, 0.26, 1.10, 0.01);
  stairsHotspot.castShadow = false;
  stairsHotspot.receiveShadow = false;
  stairsHotspot.userData.activity = 'stairs';
  stairsHotspot.userData.bedroomSpot = 'stairs';

  const readingHotspot = addBox(propsHotspots, 'bedroom-reading-hotspot', 0.78, 0.70, 0.52, 'hotspot', -0.86, 0.54, -0.66, 0.01);
  readingHotspot.rotation.y = -Math.PI / 4;
  readingHotspot.castShadow = false;
  readingHotspot.receiveShadow = false;
  readingHotspot.userData.activity = 'reading';
  readingHotspot.userData.bedroomSpot = 'reading';

  const bedHotspot = addBox(propsHotspots, 'bedroom-bed-hotspot', 1.24, 0.62, 0.92, 'hotspot', 1.20, 0.52, -0.47, 0.01);
  bedHotspot.castShadow = false;
  bedHotspot.receiveShadow = false;
  bedHotspot.userData.activity = 'bed';
  bedHotspot.userData.bedroomSpot = 'bed';

  const lampHotspot = addBox(propsHotspots, 'bedroom-lamp-hotspot', 0.30, 0.38, 0.30, 'hotspot', 1.66, 0.86, 0.22, 0.01);
  lampHotspot.castShadow = false;
  lampHotspot.receiveShadow = false;
  lampHotspot.userData.roomLamp = true;
  lampHotspot.userData.bedroomSpot = 'lamp';

  const shelfHotspot = addBox(propsHotspots, 'bedroom-bookshelf-hotspot', 0.96, 0.82, 0.34, 'hotspot', -0.46, 0.62, -1.64, 0.01);
  shelfHotspot.castShadow = false;
  shelfHotspot.receiveShadow = false;
  shelfHotspot.userData.activity = 'bookshelf';
  shelfHotspot.userData.bedroomSpot = 'bookshelf';

  function setSoftLight(enabled) {
    softLightOn = !!enabled;
    bedsideLight.intensity = softLightOn ? 2.6 : 0.75;
    materials.lampShade.emissiveIntensity = softLightOn ? 1.65 : 0.45;
  }

  const bedContact = createBedRestContactLayer(furnitureBack, furnitureFront);
  const cozyDetails = createBedroomCozyDetails({ roomBack, furnitureBack, readingChairBack });

  return {
    root,
    groups: {
      'room-back': roomBack,
      'furniture-back': furnitureBack,
      'furniture-front': furnitureFront,
      'props-hotspots': propsHotspots
    },
    hotspots: {
      stairs: stairsHotspot,
      reading: readingHotspot,
      bed: bedHotspot,
      lamp: lampHotspot,
      bookshelf: shelfHotspot
    },
    points: BEDROOM_POINTS,
    setVisible(visible) {
      root.visible = !!visible;
      if (!visible) bedContact.reset();
    },
    setSoftLight,
    syncBedContact: (opts) => bedContact.sync(opts),
    resetBedContact: () => bedContact.reset(),
    getBedContactState: () => bedContact.getState(),
    getPoint(name) {
      const pt = BEDROOM_POINTS[name];
      return pt ? [...pt] : null;
    },
    getSummary() {
      let meshCount = 0;
      root.traverse((o) => {
        if (o.isMesh) meshCount++;
      });
      return {
        visible: root.visible,
        meshCount,
        layerNames: ['room-back', 'furniture-back', 'companion', 'furniture-front', 'props-hotspots'],
        roomBackCount: roomBack.children.length,
        furnitureBackCount: furnitureBack.children.length,
        furnitureFrontCount: furnitureFront.children.length,
        hotspotCount: propsHotspots.children.length,
        stairOpeningBounds: { x: [0.88, 1.84], z: [0.48, 1.72], topLandingOpenZ: 0.48 },
        readingChairFrontMaxY: 0.33,
        readingSpriteSizeScale: 0.82,
        companionFaceMinY: 0.82,
        softLightOn,
        bedContact: bedContact.getState(),
        cozyDetails: cozyDetails.getState()
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cozyDetails.dispose();
      bedContact.dispose();
      for (const g of geometries) g.dispose();
      for (const m of Object.values(materials)) m.dispose();
      root.removeFromParent();
    }
  };
}
