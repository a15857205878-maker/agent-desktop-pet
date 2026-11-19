import * as THREE from 'three';

export const DEFAULT_UV_DENSITY = 1.0;
export const DEFAULT_MIN_UV_SPAN = 0.015;
export const DEFAULT_MAX_UV_SPAN = 8.0;

const ORTHO_AXES = [
  [2, 1], // normal dominant X -> (Z, Y)
  [0, 2], // normal dominant Y -> (X, Z)
  [0, 1]  // normal dominant Z -> (X, Y)
];

function getCoord(attr, index, axis) {
  if (axis === 0) return attr.getX(index);
  if (axis === 1) return attr.getY(index);
  return attr.getZ(index);
}

function dominantAxis(nx, ny, nz) {
  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  const az = Math.abs(nz);
  if (ax >= ay && ax >= az) return 0;
  if (ay >= az) return 1;
  return 2;
}

function chooseUVAxes(normalAxis, longestAxis, size) {
  const [a0, a1] = ORTHO_AXES[normalAxis];
  if (longestAxis !== normalAxis) {
    return {
      uAxis: a0 === longestAxis ? a1 : a0,
      vAxis: longestAxis
    };
  }
  return size[a1] >= size[a0]
    ? { uAxis: a0, vAxis: a1 }
    : { uAxis: a1, vAxis: a0 };
}

function computeAxisScales(size, density, minSpan, maxSpan) {
  return size.map((s) => {
    if (s <= 1e-7) return 0;
    const rawSpan = s * density;
    const clampedSpan = Math.min(maxSpan, Math.max(minSpan, rawSpan));
    return clampedSpan / s;
  });
}

function computeBounds(posAttr) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    if (x < min[0]) min[0] = x;
    if (y < min[1]) min[1] = y;
    if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x;
    if (y > max[1]) max[1] = y;
    if (z > max[2]) max[2] = z;
  }
  const size = [
    Math.max(0, max[0] - min[0]),
    Math.max(0, max[1] - min[1]),
    Math.max(0, max[2] - min[2])
  ];
  return { min, max, size };
}

function findLongestAxis(size) {
  if (size[1] >= size[0] && size[1] >= size[2]) return 1;
  if (size[0] >= size[2]) return 0;
  return 2;
}

function computeFaceNormal(posAttr, normAttr, ia, ib, ic) {
  const ax = posAttr.getX(ia);
  const ay = posAttr.getY(ia);
  const az = posAttr.getZ(ia);
  const e1x = posAttr.getX(ib) - ax;
  const e1y = posAttr.getY(ib) - ay;
  const e1z = posAttr.getZ(ib) - az;
  const e2x = posAttr.getX(ic) - ax;
  const e2y = posAttr.getY(ic) - ay;
  const e2z = posAttr.getZ(ic) - az;

  const nx = e1y * e2z - e1z * e2y;
  const ny = e1z * e2x - e1x * e2z;
  const nz = e1x * e2y - e1y * e2x;
  const len = Math.hypot(nx, ny, nz);
  if (len > 1e-10) {
    return [nx / len, ny / len, nz / len];
  }

  if (normAttr) {
    const vnx = normAttr.getX(ia) + normAttr.getX(ib) + normAttr.getX(ic);
    const vny = normAttr.getY(ia) + normAttr.getY(ib) + normAttr.getY(ic);
    const vnz = normAttr.getZ(ia) + normAttr.getZ(ib) + normAttr.getZ(ic);
    const vlen = Math.hypot(vnx, vny, vnz);
    if (vlen > 1e-10) {
      return [vnx / vlen, vny / vlen, vnz / vlen];
    }
  }

  return [0, 1, 0];
}

function writePlanarVertexUV(uvArray, posAttr, vertIdx, min, scales, uAxis, vAxis) {
  const u = (getCoord(posAttr, vertIdx, uAxis) - min[uAxis]) * scales[uAxis];
  const v = (getCoord(posAttr, vertIdx, vAxis) - min[vAxis]) * scales[vAxis];
  uvArray[vertIdx * 2] = Number.isFinite(u) ? u : 0;
  uvArray[vertIdx * 2 + 1] = Number.isFinite(v) ? v : 0;
}

function applyPlanarComponentUV(geometry, posAttr, normAttr, bounds, scales, longestAxis) {
  const { min, size } = bounds;
  const uvArray = new Float32Array(posAttr.count * 2);
  const indexAttr = geometry.index;

  if (indexAttr && normAttr) {
    for (let i = 0; i < posAttr.count; i++) {
      const nAxis = dominantAxis(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
      const { uAxis, vAxis } = chooseUVAxes(nAxis, longestAxis, size);
      writePlanarVertexUV(uvArray, posAttr, i, min, scales, uAxis, vAxis);
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
    return geometry;
  }

  const triCount = indexAttr
    ? Math.floor(indexAttr.count / 3)
    : Math.floor(posAttr.count / 3);

  for (let t = 0; t < triCount; t++) {
    const base = t * 3;
    const ia = indexAttr ? indexAttr.getX(base) : base;
    const ib = indexAttr ? indexAttr.getX(base + 1) : base + 1;
    const ic = indexAttr ? indexAttr.getX(base + 2) : base + 2;

    const [nx, ny, nz] = computeFaceNormal(posAttr, normAttr, ia, ib, ic);
    const nAxis = dominantAxis(nx, ny, nz);
    const { uAxis, vAxis } = chooseUVAxes(nAxis, longestAxis, size);

    writePlanarVertexUV(uvArray, posAttr, ia, min, scales, uAxis, vAxis);
    writePlanarVertexUV(uvArray, posAttr, ib, min, scales, uAxis, vAxis);
    writePlanarVertexUV(uvArray, posAttr, ic, min, scales, uAxis, vAxis);
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
  return geometry;
}

function applyCylinderComponentUV(geometry, posAttr, normAttr, bounds, scales, options) {
  const { min, max, size } = bounds;
  const density = options.density ?? DEFAULT_UV_DENSITY;
  const minSpan = options.minSpan ?? DEFAULT_MIN_UV_SPAN;
  const maxSpan = options.maxSpan ?? DEFAULT_MAX_UV_SPAN;
  const axisName = options.axis ?? 'y';
  const axisIdx = axisName === 'x' ? 0 : axisName === 'z' ? 2 : 1;
  const rAxisA = axisIdx === 0 ? 1 : 0;
  const rAxisB = axisIdx === 2 ? 1 : 2;

  const centerA = (min[rAxisA] + max[rAxisA]) * 0.5;
  const centerB = (min[rAxisB] + max[rAxisB]) * 0.5;
  const avgRadius = Math.max(0.25 * (size[rAxisA] + size[rAxisB]), 1e-4);
  const circumference = 2 * Math.PI * avgRadius;
  const uSpan = Math.min(maxSpan, Math.max(minSpan, circumference * density));
  const vScale = scales[axisIdx];

  const uvArray = new Float32Array(posAttr.count * 2);
  const indexAttr = geometry.index;
  const triCount = indexAttr
    ? Math.floor(indexAttr.count / 3)
    : Math.floor(posAttr.count / 3);

  for (let t = 0; t < triCount; t++) {
    const base = t * 3;
    const indices = indexAttr
      ? [indexAttr.getX(base), indexAttr.getX(base + 1), indexAttr.getX(base + 2)]
      : [base, base + 1, base + 2];

    const n = computeFaceNormal(posAttr, normAttr, indices[0], indices[1], indices[2]);
    const isCap = Math.abs(n[axisIdx]) >= 0.85;

    if (isCap) {
      for (const idx of indices) {
        const u = (getCoord(posAttr, idx, rAxisA) - min[rAxisA]) * scales[rAxisA];
        const v = (getCoord(posAttr, idx, rAxisB) - min[rAxisB]) * scales[rAxisB];
        uvArray[idx * 2] = Number.isFinite(u) ? u : 0;
        uvArray[idx * 2 + 1] = Number.isFinite(v) ? v : 0;
      }
      continue;
    }

    const rawT = indices.map((idx) => {
      const ca = getCoord(posAttr, idx, rAxisA) - centerA;
      const cb = getCoord(posAttr, idx, rAxisB) - centerB;
      return (Math.atan2(cb, ca) + Math.PI) / (2 * Math.PI);
    });

    const minT = Math.min(rawT[0], rawT[1], rawT[2]);
    const maxT = Math.max(rawT[0], rawT[1], rawT[2]);
    const wrapFix = !indexAttr && maxT - minT > 0.5;

    for (let k = 0; k < 3; k++) {
      const idx = indices[k];
      const tNorm = wrapFix && rawT[k] < 0.5 ? rawT[k] + 1.0 : rawT[k];
      const u = tNorm * uSpan;
      const v = (getCoord(posAttr, idx, axisIdx) - min[axisIdx]) * vScale;
      uvArray[idx * 2] = Number.isFinite(u) ? u : 0;
      uvArray[idx * 2 + 1] = Number.isFinite(v) ? v : 0;
    }
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
  return geometry;
}

/**
 * Assign deterministic, finite, non-degenerate per-component UVs to an owned
 * temporary BufferGeometry BEFORE rigid transforms or merging.
 *
 * - Aligns V along the component's local longest axis on side faces so wood
 *   grain follows beams, posts, pickets, and limbs naturally.
 * - Uses consistent world-unit density with clamped repeats on tiny trims.
 * - Leaves position, normal, index, and bounding box unchanged.
 *
 * @param {THREE.BufferGeometry} geometry - Owned temporary geometry.
 * @param {object} [options]
 * @param {string} [options.kind='wood'] - Material/surface kind.
 * @param {number} [options.density=1.0] - Repeats per world unit.
 * @param {'auto'|'planar'|'cylinder'} [options.shape='auto'] - Projection mode.
 * @param {'x'|'y'|'z'} [options.axis='y'] - Cylinder axis for cylinder mode.
 * @param {number} [options.minSpan=0.015] - Minimum UV span clamp.
 * @param {number} [options.maxSpan=8.0] - Maximum UV span clamp.
 * @returns {THREE.BufferGeometry} The input geometry with updated 'uv' attribute.
 */
export function applyComponentUV(geometry, options = {}) {
  const posAttr = geometry?.attributes?.position;
  if (!posAttr || posAttr.count === 0) return geometry;

  const normAttr = geometry.attributes.normal ?? null;
  const density = options.density ?? DEFAULT_UV_DENSITY;
  const minSpan = options.minSpan ?? DEFAULT_MIN_UV_SPAN;
  const maxSpan = options.maxSpan ?? DEFAULT_MAX_UV_SPAN;

  const bounds = computeBounds(posAttr);
  const scales = computeAxisScales(bounds.size, density, minSpan, maxSpan);
  const longestAxis = findLongestAxis(bounds.size);

  const shape = options.shape ?? (geometry.type === 'CylinderGeometry' ? 'cylinder' : 'auto');
  if (shape === 'cylinder') {
    return applyCylinderComponentUV(geometry, posAttr, normAttr, bounds, scales, options);
  }

  return applyPlanarComponentUV(geometry, posAttr, normAttr, bounds, scales, longestAxis);
}
