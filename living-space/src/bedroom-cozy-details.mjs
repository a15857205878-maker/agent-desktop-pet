import * as THREE from 'three';
import { miniatureParts } from './miniature-parts.mjs';
import { createSoftPillowGeometry, createSoftRollGeometry } from './softness-geometry.mjs';

/**
 * Cozy bedroom architectural, furniture, and safe character-contact details.
 * Integrates into bedroom-scene's roomBack and furnitureBack layers so
 * foreground occlusion, companion face/horns, stair landing, and all anchors stay intact.
 */
export function createBedroomCozyDetails({ roomBack, furnitureBack, readingChairBack }) {
  const backDetails = miniatureParts(roomBack, 'bedroom-cozy-room-back', {
    brass: { color: '#c7aa70', metalness: 0.25, roughness: 0.6 },
    ceramic: '#eee1cc',
    lavender: '#b89ec9',
    leaf: '#8da16f',
    rugStitch: '#d3bda4'
  });

  // 1. Curtain rod brass finials & wall brackets (winX = -0.46, y = 2.54, z = -1.78)
  for (const x of [-1.24, 0.32]) {
    backDetails.add('bedroom-rod-finial', new THREE.SphereGeometry(0.026, 12, 8), 'brass', x, 2.54, -1.78);
  }
  for (const x of [-1.08, 0.16]) {
    backDetails.box('bedroom-rod-bracket', 0.028, 0.042, 0.06, 'brass', x, 2.54, -1.82);
  }

  // 2. Small windowsill ceramic bud vase with lavender sprigs (right side of sill)
  backDetails.add('bedroom-sill-bud-vase', new THREE.CylinderGeometry(0.026, 0.034, 0.075, 12), 'ceramic', -0.14, 1.244, -1.74);
  for (let i = 0; i < 3; i++) {
    const dx = (i - 1) * 0.016;
    backDetails.add('bedroom-sill-sprig-stem', new THREE.CylinderGeometry(0.004, 0.005, 0.055, 5), 'leaf', -0.14 + dx, 1.30, -1.74);
    backDetails.add('bedroom-sill-sprig-bloom', new THREE.IcosahedronGeometry(0.016, 0), 'lavender', -0.14 + dx, 1.33, -1.74);
  }

  // 3. Subtle braided stitch ring on the reading rug
  const rugStitch = backDetails.add(
    'bedroom-rug-braid-stitch',
    new THREE.RingGeometry(0.46, 0.510, 64),
    'rugStitch',
    -0.92,
    0.2365,
    -0.34
  );
  rugStitch.rotation.x = -Math.PI / 2;
  rugStitch.scale.set(1.16, 0.88, 1);

  backDetails.finish();

  const furnitureDetails = miniatureParts(furnitureBack, 'bedroom-cozy-furniture-back', {
    brass: { color: '#c7aa70', metalness: 0.25, roughness: 0.6 },
    ceramic: '#eee1cc',
    lavender: '#b89ec9',
    lavenderDeep: '#9b81ba',
    cream: '#f3e7d4',
    leaf: '#8da16f',
    tea: '#996d47'
  });

  // 4. Wardrobe brass backplates behind handles
  for (const dx of [-0.04, 0.04]) {
    furnitureDetails.box('wardrobe-handle-plate', 0.034, 0.17, 0.008, 'brass', 0.68 + dx, 1.32, -1.304);
  }

  // 5. Low bookshelf center mini potted plant (between notebook at -0.70 and crystal at -0.20)
  furnitureDetails.add('bedroom-shelf-mini-pot', new THREE.CylinderGeometry(0.042, 0.032, 0.062, 12), 'ceramic', -0.45, 1.032, -1.62);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.35;
    const leaf = furnitureDetails.add(
      'bedroom-shelf-mini-leaf',
      new THREE.IcosahedronGeometry(0.028, 0),
      'leaf',
      -0.45 + Math.sin(a) * 0.022,
      1.072 + (i % 2) * 0.008,
      -1.62 + Math.cos(a) * 0.022
    );
    leaf.scale.set(1, 0.5, 1);
  }

  // 6. Nightstand bedtime book & small warm tea mug (front-left of lamp, on nightstand top y=0.69)
  const bookX = 1.56, bookZ = 0.09, bookAngle = 0.22;
  for (const [name, width, height, depth, color, y] of [
    ['bottom-cover', 0.14, 0.005, 0.11, 'lavenderDeep', 0.693],
    ['pages', 0.129, 0.014, 0.102, 'cream', 0.702],
    ['top-cover', 0.14, 0.006, 0.11, 'lavender', 0.712]
  ]) {
    const part = furnitureDetails.box(`nightstand-bedtime-book-${name}`, width, height, depth, color, bookX, y, bookZ);
    part.rotation.y = bookAngle;
  }
  furnitureDetails.add('nightstand-mug', new THREE.CylinderGeometry(0.026, 0.022, 0.052, 12), 'ceramic', 1.72, 0.716, 0.08);
  const handle = furnitureDetails.add('nightstand-mug-handle', new THREE.TorusGeometry(0.014, 0.0038, 6, 12), 'ceramic', 1.72, 0.718, 0.105);
  handle.rotation.y = Math.PI / 2;
  const mugTea = furnitureDetails.add('nightstand-mug-tea', new THREE.CircleGeometry(0.022, 12), 'tea', 1.72, 0.743, 0.08);
  mugTea.rotation.x = -Math.PI / 2;

  // 6b. Subtle draped quilt turnover cuff & stitched blanket hem (in furnitureBack, clear of face/horns)
  const quiltCuff = furnitureDetails.add(
    'bed-quilt-turnover-cuff',
    createSoftRollGeometry(0.84, 0.022),
    'cream',
    1.44,
    0.616,
    -0.47
  );
  quiltCuff.rotation.x = Math.PI / 2;
  quiltCuff.scale.set(1.06, 1, 0.90);
  quiltCuff.userData.bedroomSpot = 'bed';

  // The atmosphere layer owns surface-sampled threadwork. Separate rigid hem
  // bars would project beyond the rolled cloth edge, so keep this layer to cuff.

  furnitureDetails.finish();

  // 7. Safe character-contact cushion on the reading chair (in furnitureBack, behind companion)
  let chairCushionDetails = null;
  if (readingChairBack) {
    chairCushionDetails = miniatureParts(readingChairBack, 'bedroom-reading-chair-cushion-detail', {
      cushion: '#ede2f4'
    });
    chairCushionDetails.add(
      'reading-chair-seat-pad',
      createSoftPillowGeometry(0.76, 0.032, 0.42),
      'cushion',
      0.0,
      0.336,
      -0.02
    );
    chairCushionDetails.finish();
    chairCushionDetails.root.traverse((o) => {
      if (o.isMesh) o.userData.bedroomSpot = 'reading';
    });
  }

  let disposed = false;

  return {
    roots: [backDetails.root, furnitureDetails.root, ...(chairCushionDetails ? [chairCushionDetails.root] : [])],
    getState() {
      return {
        disposed,
        roomBackMeshes: backDetails.root.children.length,
        furnitureBackMeshes: furnitureDetails.root.children.length,
        chairCushionMeshes: chairCushionDetails ? chairCushionDetails.root.children.length : 0
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      backDetails.dispose();
      furnitureDetails.dispose();
      chairCushionDetails?.dispose();
    }
  };
}
