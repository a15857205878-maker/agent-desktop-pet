import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createBroadleafTuftGeometry,
  createPetalFlowerheadGeometry
} from './miniature-garden-plants.mjs';
import { addTownMapDetails } from './town-map-details.mjs';
import { createOutdoorDistricts } from './outdoor-districts.mjs';

function withCanvasStub(fn) {
  const prevDoc = globalThis.document;
  if (!prevDoc) {
    globalThis.document = {
      createElement(tag) {
        if (tag !== 'canvas') return {};
        return {
          width: 256,
          height: 180,
          getContext() {
            return {
              fillStyle: '',
              strokeStyle: '',
              lineWidth: 0,
              font: '',
              textAlign: '',
              textBaseline: '',
              fillRect() {},
              strokeRect() {},
              fillText() {}
            };
          }
        };
      }
    };
  }
  try {
    return fn();
  } finally {
    if (!prevDoc) {
      delete globalThis.document;
    }
  }
}

function assertValidPlantGeometry(geo, label, { maxTriangles, maxRadius, minY, maxY }) {
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  const index = geo.index;

  assert.ok(pos && pos.count > 0, `${label}: missing position`);
  assert.ok(norm && norm.count === pos.count, `${label}: missing or mismatched normal`);
  assert.ok(uv && uv.count === pos.count, `${label}: missing or mismatched uv`);
  assert.ok(index, `${label}: expected indexed geometry`);
  assert.equal(geo.userData?.__cottageUvApplied, true, `${label}: expected __cottageUvApplied flag`);

  const triCount = index.count / 3;
  assert.ok(triCount > 0 && triCount <= maxTriangles, `${label}: triCount ${triCount} exceeds ${maxTriangles}`);

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = norm.getX(i);
    const ny = norm.getY(i);
    const nz = norm.getZ(i);
    const u = uv.getX(i);
    const v = uv.getY(i);

    assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z), `${label}: non-finite pos at ${i}`);
    assert.ok(Number.isFinite(nx) && Number.isFinite(ny) && Number.isFinite(nz), `${label}: non-finite normal at ${i}`);
    assert.ok(Math.hypot(nx, ny, nz) > 1e-4, `${label}: zero normal at ${i}`);
    assert.ok(Number.isFinite(u) && Number.isFinite(v), `${label}: non-finite uv at ${i}`);

    const rXZ = Math.hypot(x, z);
    assert.ok(rXZ <= maxRadius + 1e-5, `${label}: XZ radius ${rXZ} exceeds ${maxRadius}`);
    assert.ok(y >= minY - 1e-5 && y <= maxY + 1e-5, `${label}: Y ${y} outside [${minY}, ${maxY}]`);

    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }

  assert.ok(maxU - minU > 1e-4, `${label}: degenerate U span`);
  assert.ok(maxV - minV > 1e-4, `${label}: degenerate V span`);

  // Closed 2-manifold check and non-degenerate triangles
  const edgeCounts = new Map();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const cross = new THREE.Vector3();

  for (let t = 0; t < triCount; t++) {
    const ia = index.getX(t * 3);
    const ib = index.getX(t * 3 + 1);
    const ic = index.getX(t * 3 + 2);
    a.fromBufferAttribute(pos, ia);
    b.fromBufferAttribute(pos, ib);
    c.fromBufferAttribute(pos, ic);
    e1.subVectors(b, a);
    e2.subVectors(c, a);
    cross.crossVectors(e1, e2);
    assert.ok(cross.lengthSq() > 1e-14, `${label}: degenerate triangle ${t}`);

    for (const [u, v] of [[ia, ib], [ib, ic], [ic, ia]]) {
      const key = `${u}->${v}`;
      edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
    }
  }

  for (const [key, count] of edgeCounts.entries()) {
    const [u, v] = key.split('->');
    assert.equal(edgeCounts.get(`${v}->${u}`), count, `${label}: open or non-manifold edge ${key}`);
  }
}

test('createBroadleafTuftGeometry is closed, bounded <= 96 tris, deterministic, with valid normals and UVs', () => {
  const g0a = createBroadleafTuftGeometry({ seed: 15, leafCount: 4, radius: 0.068, height: 0.085 });
  const g0b = createBroadleafTuftGeometry({ seed: 15, leafCount: 4, radius: 0.068, height: 0.085 });
  const g1 = createBroadleafTuftGeometry({ seed: 42, leafCount: 4, radius: 0.068, height: 0.085 });

  assertValidPlantGeometry(g0a, 'broadleaf-tuft-seed15', {
    maxTriangles: 96,
    maxRadius: 0.068,
    minY: 0,
    maxY: 0.085
  });
  assertValidPlantGeometry(g1, 'broadleaf-tuft-seed42', {
    maxTriangles: 96,
    maxRadius: 0.068,
    minY: 0,
    maxY: 0.085
  });

  const p0a = g0a.attributes.position.array;
  const p0b = g0b.attributes.position.array;
  assert.equal(p0a.length, p0b.length);
  for (let i = 0; i < p0a.length; i++) {
    assert.equal(p0a[i], p0b[i]);
  }

  const p1 = g1.attributes.position.array;
  let maxDiff = 0;
  for (let i = 0; i < Math.min(p0a.length, p1.length); i++) {
    maxDiff = Math.max(maxDiff, Math.abs(p0a[i] - p1[i]));
  }
  assert.ok(maxDiff > 1e-4, 'different seeds must produce distinct tufts');

  g0a.dispose();
  g0b.dispose();
  g1.dispose();
});

test('createPetalFlowerheadGeometry is closed, bounded <= 120 tris, deterministic, with valid normals and UVs', () => {
  const g0a = createPetalFlowerheadGeometry({ seed: 23, petalCount: 5, radius: 0.066, height: 0.092 });
  const g0b = createPetalFlowerheadGeometry({ seed: 23, petalCount: 5, radius: 0.066, height: 0.092 });
  const g1 = createPetalFlowerheadGeometry({ seed: 99, petalCount: 5, radius: 0.066, height: 0.092 });

  assertValidPlantGeometry(g0a, 'petal-flowerhead-seed23', {
    maxTriangles: 120,
    maxRadius: 0.066,
    minY: -0.046,
    maxY: 0.046
  });
  assertValidPlantGeometry(g1, 'petal-flowerhead-seed99', {
    maxTriangles: 120,
    maxRadius: 0.066,
    minY: -0.046,
    maxY: 0.046
  });

  const p0a = g0a.attributes.position.array;
  const p0b = g0b.attributes.position.array;
  assert.equal(p0a.length, p0b.length);
  for (let i = 0; i < p0a.length; i++) {
    assert.equal(p0a[i], p0b[i]);
  }

  const p1 = g1.attributes.position.array;
  let maxDiff = 0;
  for (let i = 0; i < Math.min(p0a.length, p1.length); i++) {
    maxDiff = Math.max(maxDiff, Math.abs(p0a[i] - p1[i]));
  }
  assert.ok(maxDiff > 1e-4, 'different seeds must produce distinct flowerheads');

  g0a.dispose();
  g0b.dispose();
  g1.dispose();
});

test('addTownMapDetails stays <= 8000 triangles and preserves UVs on new plant buckets only', () => {
  const plaza = new THREE.Group();
  const orchard = new THREE.Group();
  const home = new THREE.Group();
  const detail = addTownMapDetails({ plaza, orchard, home });

  assert.ok(detail.triangles > 0 && detail.triangles <= 8000, `town-map triangles ${detail.triangles} exceeds 8000`);
  assert.ok(detail.meshes > 0);

  const plantNames = new Set(['detail-sage', 'detail-leaf', 'detail-flower', 'detail-gold']);
  for (const root of [plaza, orchard, home]) {
    root.traverse((obj) => {
      if (!obj.isMesh) return;
      if (plantNames.has(obj.name)) {
        assert.ok(obj.geometry.attributes.uv, `${obj.name} must preserve UV attribute`);
      } else {
        assert.equal(obj.geometry.attributes.uv, undefined, `${obj.name} must keep legacy UV-free state`);
      }
    });
  }
});

test('createOutdoorDistricts keeps budgets, map detail <= 8000, and orthographic picking valid', () => {
  withCanvasStub(() => {
    const { plaza, orchard, detail, refinement, points, disposeDetails } = createOutdoorDistricts();
    const state = refinement.getState();

    assert.ok(state.meshCount <= 28, `meshCount ${state.meshCount} exceeds 28`);
    assert.ok(state.triangleCount <= 45000, `triangleCount ${state.triangleCount} exceeds 45000`);
    assert.ok(detail.triangles <= 8000, `detail.triangles ${detail.triangles} exceeds 8000`);

    const camera = new THREE.OrthographicCamera(-3.5, 3.5, 3.5, -3.5, 0.1, 50);
    camera.position.set(6, 4.8, 8);
    camera.lookAt(0, 1, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    const fruitMeshes = [];
    orchard.traverse((o) => {
      if (o.isMesh && o.userData?.townAction === 'harvest') fruitMeshes.push(o);
    });
    assert.equal(fruitMeshes.length, 9);

    const raycaster = new THREE.Raycaster();
    for (const fruit of fruitMeshes) {
      const wp = new THREE.Vector3();
      fruit.getWorldPosition(wp);
      const ndc = wp.project(camera);
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      const hit = raycaster.intersectObject(orchard, true).find((h) => h.object.visible);
      assert.ok(hit);
      assert.notEqual(hit.object.userData?.decorativeOnly, true);
    }

    assert.ok(points.harvest);
    assert.ok(plaza);
    disposeDetails();
  });
});
