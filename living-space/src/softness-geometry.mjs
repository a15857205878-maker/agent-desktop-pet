import * as THREE from 'three';

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Deterministic, bounded pillow geometry with pinched sewn edges,
 * soft rounded shoulders/corners, and a gentle central loft/dimple.
 */
export function createSoftPillowGeometry(w, h, d, options = {}) {
  const segX = options.segX ?? 12;
  const segY = options.segY ?? 6;
  const segZ = options.segZ ?? 14;
  const geo = new THREE.BoxGeometry(w, h, d, segX, segY, segZ);
  const pos = geo.attributes.position;
  const hx = w * 0.5;
  const hy = h * 0.5;
  const hz = d * 0.5;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const nx = hx > 0 ? clamp(x / hx, -1, 1) : 0;
    const ny = hy > 0 ? clamp(y / hy, -1, 1) : 0;
    const nz = hz > 0 ? clamp(z / hz, -1, 1) : 0;
    const nx2 = nx * nx;
    const nz2 = nz * nz;

    const edgeX = Math.max(0, 1 - nx2);
    const edgeZ = Math.max(0, 1 - nz2);
    const dome = Math.pow(edgeX * edgeZ, 0.32);

    const cornerFactor = 1 - 0.18 * nx2 * nz2;
    const shoulderTaper = 1 - 0.035 * (nx2 + nz2) * (1 - 0.35 * Math.abs(ny));
    x *= cornerFactor * shoulderTaper;
    z *= cornerFactor * shoulderTaper;

    const dimple = 1 - 0.045 * Math.exp(-3.2 * (nx2 + nz2));
    const seamPinch = 0.18 + 0.82 * dome * dimple;
    // Preserve gentle thickness even on side walls while pinching the seam
    y *= seamPinch * (0.86 + 0.14 * Math.abs(ny));

    pos.setXYZ(i, clamp(x, -hx, hx), clamp(y, -hy, hy), clamp(z, -hz, hz));
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Deterministic, bounded quilt/blanket geometry with gentle top shoulder bevel,
 * preserved sidewall/end mattress coverage, sparse large low-amplitude folds,
 * and preserved central top support height.
 */
export function createSoftQuiltGeometry(w, h, d, options = {}) {
  const segX = options.segX ?? 14;
  const segY = options.segY ?? 6;
  const segZ = options.segZ ?? 14;
  const puffAmp = options.puffAmp ?? 0.005;
  const geo = new THREE.BoxGeometry(w, h, d, segX, segY, segZ);
  const pos = geo.attributes.position;
  const hx = w * 0.5;
  const hy = h * 0.5;
  const hz = d * 0.5;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const nx = hx > 0 ? clamp(x / hx, -1, 1) : 0;
    const ny = hy > 0 ? clamp(y / hy, -1, 1) : 0;
    const nz = hz > 0 ? clamp(z / hz, -1, 1) : 0;
    const nx2 = nx * nx;
    const nz2 = nz * nz;

    // Gentle plan-view corner rounding that preserves full sidewall/end coverage
    x *= 1 - 0.048 * nx2 * nz2;
    z *= 1 - 0.028 * nx2 * nz2;

    if (ny > 0) {
      const upper = Math.pow(ny, 2.0);
      const radial = Math.max(Math.abs(nx), Math.abs(nz));
      const shoulderCurve = clamp((radial - 0.35) / 0.65, 0, 1);
      const shoulderPull = 1 - 0.030 * upper * shoulderCurve * shoulderCurve;
      x *= shoulderPull;
      z *= shoulderPull;

      const edgeDrop = (0.20 * Math.pow(shoulderCurve, 2.0) + 0.06 * nx2 * nz2) * upper * hy;
      const foldZone = Math.sin(Math.PI * clamp((radial - 0.28) / 0.67, 0, 1));
      const broadFold = Math.sin((nx * 0.85 + nz * 0.65 + 0.25) * Math.PI);
      const foldAmp = Math.max(puffAmp * 2.0, 0.008);
      y = y - edgeDrop + foldAmp * broadFold * foldZone * upper;
    }

    pos.setXYZ(i, clamp(x, -hx, hx), clamp(y, -hy, hy), clamp(z, -hz, hz));
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Softly tapered textile roll (e.g., folded quilt turnover cuff) oriented along Y by default.
 */
export function createSoftRollGeometry(length, radius, options = {}) {
  const radialSegments = options.radialSegments ?? 10;
  const heightSegments = options.heightSegments ?? 8;
  const geo = new THREE.CylinderGeometry(radius, radius, length, radialSegments, heightSegments);
  const pos = geo.attributes.position;
  const halfLen = length * 0.5;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const t = halfLen > 0 ? clamp(Math.abs(y) / halfLen, 0, 1) : 0;
    const endTaper = t > 0.72 ? 1 - 0.45 * Math.pow((t - 0.72) / 0.28, 1.6) : 1;
    x *= endTaper;
    z *= endTaper;
    if (z < 0) z *= 0.82;

    pos.setXYZ(i, clamp(x, -radius, radius), clamp(y, -halfLen, halfLen), clamp(z, -radius, radius));
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Deterministic, bounded organic river-stone / pebble geometry.
 * Fits strictly within [-w/2, w/2] x [-h/2, h/2] x [-d/2, d/2].
 */
export function createOrganicPebbleGeometry(w, h, d, seed = 0) {
  const geo = new THREE.BoxGeometry(1, 1, 1, 8, 4, 6);
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
    const rVar = clamp(
      0.86 +
        0.10 * Math.sin(2 * theta + seed * 1.7) +
        0.06 * Math.cos(3 * theta - seed * 2.3) +
        0.03 * Math.sin(5 * theta + seed * 0.9),
      0.72,
      1.0
    );

    const px = clamp(ux * hx * rVar, -hx, hx);
    const pz = clamp(uz * hz * rVar, -hz, hz);
    const yFactor = uy < 0 ? 0.72 : clamp(0.92 + 0.08 * Math.cos(theta + seed), 0.8, 1.0);
    const py = clamp(uy * hy * yFactor, -hy, hy);

    pos.setXYZ(i, px, py, pz);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Deterministic, bounded curved grass blade geometry with a soft tapered tip.
 */
export function createCurvedGrassBladeGeometry(baseRadius, height, arch = 0.022, twist = 0.14) {
  const geo = new THREE.CylinderGeometry(baseRadius * 0.18, baseRadius, height, 6, 4);
  const pos = geo.attributes.position;
  const hy = height * 0.5;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i) * 0.55;

    const t = height > 0 ? clamp((y + hy) / height, 0, 1) : 0;
    z += arch * t * t;

    const angle = twist * t;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rx = x * cos - z * sin;
    const rz = x * sin + z * cos;

    pos.setXYZ(i, rx, y, rz);
  }

  geo.computeVertexNormals();
  return geo;
}
