import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
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

function assertValidUVs(geo, label) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  assert.ok(pos && pos.count > 0, `${label}: missing position attribute`);
  assert.ok(uv, `${label}: missing uv attribute`);
  assert.equal(uv.itemSize, 2, `${label}: uv itemSize must be 2`);
  assert.equal(uv.count, pos.count, `${label}: uv count must match position count`);

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    assert.ok(Number.isFinite(u) && Number.isFinite(v), `${label}: non-finite UV at vertex ${i}`);
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }

  assert.ok(maxU - minU > 1e-4, `${label}: U span is zero`);
  assert.ok(maxV - minV > 1e-4, `${label}: V span is zero`);
}

function getTownAction(obj) {
  let cur = obj;
  while (cur) {
    if (cur.userData?.townAction) return cur.userData.townAction;
    cur = cur.parent;
  }
  return null;
}

function raycastFirstVisibleAction(root, camera, worldPoint) {
  root.updateMatrixWorld(true);
  const ndc = worldPoint.clone().project(camera);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  const hits = raycaster.intersectObject(root, true).filter((h) => {
    let cur = h.object;
    while (cur) {
      if (!cur.visible) return false;
      cur = cur.parent;
    }
    return true;
  });
  return hits[0] || null;
}

test('cozy town districts respect budgets, UVs, bounds, visibility restore, and idempotent dispose', () => {
  withCanvasStub(() => {
    const districts = createOutdoorDistricts();
    const { plaza, orchard, refinement, disposeDetails } = districts;
    const state = refinement.getState();

    assert.ok(state.meshCount > 0 && state.meshCount <= 28, `meshCount ${state.meshCount} out of budget <= 28`);
    assert.ok(state.materialCount > 0 && state.materialCount <= 14, `materialCount ${state.materialCount} out of budget <= 14`);
    assert.ok(state.triangleCount > 100 && state.triangleCount <= 45000, `triangleCount ${state.triangleCount} out of budget <= 45000`);
    assert.equal(state.crownRoots, 3, 'expected 3 harvest-owned crown roots');
    assert.equal(state.disposed, false);
    assert.equal(state.night, false);

    // Check UVs, decorativeOnly flags, no lights, and bounds on decorative roots
    for (const [label, root] of [['plaza', refinement.roots.plaza], ['orchard', refinement.roots.orchard]]) {
      const box = new THREE.Box3().setFromObject(root);
      assert.ok(box.min.x >= -2.05 && box.max.x <= 2.05, `${label} X bounds exceeded: [${box.min.x}, ${box.max.x}]`);
      assert.ok(box.min.z >= -2.05 && box.max.z <= 2.05, `${label} Z bounds exceeded: [${box.min.z}, ${box.max.z}]`);
      assert.ok(box.min.y >= -0.26, `${label} min Y below -0.25: ${box.min.y}`);

      let meshes = 0;
      root.traverse((obj) => {
        assert.equal(obj.isLight, undefined, `${label} must not contain any lights`);
        if (!obj.isMesh) return;
        meshes++;
        assert.equal(obj.userData.decorativeOnly, true, `${obj.name} must set decorativeOnly: true`);
        assert.equal(obj.userData.townAction, undefined, `${obj.name} must not set townAction`);
        assert.equal(obj.userData.roomSpot, undefined, `${obj.name} must not set roomSpot`);
        assertValidUVs(obj.geometry, `${label}/${obj.name}`);
      });
      assert.ok(meshes > 0, `${label} refinement root has no meshes`);
    }

    // Check replacement tree crowns: parented under town-tree, inherit harvest, finite UVs, no decorativeOnly
    assert.equal(refinement.roots.crowns.length, 3);
    for (let i = 0; i < refinement.roots.crowns.length; i++) {
      const crown = refinement.roots.crowns[i];
      assert.equal(crown.parent?.name, 'town-tree', `crown ${i} must be child of town-tree`);
      assert.equal(crown.parent?.userData?.townAction, 'harvest');
      let crownMeshCount = 0;
      crown.traverse((obj) => {
        assert.equal(obj.isLight, undefined, `crown ${i} must not contain lights`);
        if (!obj.isMesh) return;
        crownMeshCount++;
        assert.notEqual(obj.userData.decorativeOnly, true, `crown ${i} mesh must not be decorativeOnly`);
        assert.equal(getTownAction(obj), 'harvest', `crown ${i} mesh must resolve harvest action`);
        assertValidUVs(obj.geometry, `crown-${i}/${obj.name}`);
      });
      assert.ok(crownMeshCount > 0, `crown ${i} has no meshes`);
    }

    // Tagged original base/path parts and original tree foliage must be hidden while active
    const taggedParts = [];
    for (const g of [plaza, orchard]) {
      g.traverse((o) => {
        if (o.isMesh && o.userData?.townBasePart) {
          taggedParts.push(o);
          assert.equal(o.visible, false, `tagged base part ${o.userData.townBasePart} should be hidden`);
        }
      });
    }
    assert.equal(taggedParts.length, 7, 'expected 7 tagged base/path parts across plaza + orchard');

    const treeFoliage = [];
    orchard.traverse((o) => {
      if (o.isMesh && (o.name === 'tree-leaf' || o.name === 'tree-shade' || o.name === 'tree-light')) {
        treeFoliage.push(o);
        assert.equal(o.visible, false, `original ${o.name} should be hidden`);
      }
    });
    assert.equal(treeFoliage.length, 9, 'expected 9 original tree foliage meshes across 3 orchard trees');

    // Night toggle sync
    districts.setNight(true);
    assert.equal(refinement.getState().night, true);
    districts.setNight(false);
    assert.equal(refinement.getState().night, false);

    // Dispose and idempotency
    disposeDetails();
    assert.equal(refinement.getState().disposed, true);
    assert.equal(refinement.roots.plaza.parent, null);
    assert.equal(refinement.roots.orchard.parent, null);
    for (const crown of refinement.roots.crowns) {
      assert.equal(crown.parent, null, 'crown root must detach on dispose');
    }

    for (const part of taggedParts) {
      assert.equal(part.visible, true, `tagged base part ${part.userData.townBasePart} must restore visibility on dispose`);
    }
    for (const leaf of treeFoliage) {
      assert.equal(leaf.visible, true, `original ${leaf.name} must restore visibility on dispose`);
    }

    // Second dispose call must be a safe no-op
    refinement.dispose();
    assert.equal(refinement.getState().disposed, true);
  });
});

test('preserves points, fruits availability, benches, and orthographic raycast picking', () => {
  withCanvasStub(() => {
    const districts = createOutdoorDistricts();
    const { plaza, orchard, points, setFruitAvailable, disposeDetails } = districts;

    // Points preserved
    assert.ok(points.harvest.distanceTo(new THREE.Vector3(1.28, 1.42, -0.46)) < 1e-6);
    assert.ok(points.plazaHome && points.plazaOrchard && points.orchardPlaza && points.homePlaza);

    // Bench anchors preserved
    const expectedBenches = [
      ['bench--1.22--1.1', [-1.22, 0.415, -1.03]],
      ['bench-1.22--1.1', [1.22, 0.415, -1.03]],
      ['bench-1.17-1.1', [1.17, 0.415, 1.17]]
    ];
    for (const [name, anchor] of expectedBenches) {
      const b = plaza.getObjectByName(name) || orchard.getObjectByName(name);
      assert.ok(b, `missing bench ${name}`);
      assert.equal(b.userData.townAction, `bench:${name}`);
      assert.ok(b.userData.benchAnchor.every((v,i)=>Math.abs(v-anchor[i])<1e-12));
    }

    // Fruits availability preserved
    const fruitMeshes = [];
    orchard.traverse((o) => {
      if (o.isMesh && o.userData?.townAction === 'harvest') {
        fruitMeshes.push(o);
      }
    });
    assert.equal(fruitMeshes.length, 9, 'expected 9 harvest fruit meshes');
    setFruitAvailable(false);
    assert.ok(fruitMeshes.every((m) => m.visible === false));
    setFruitAvailable(true);
    assert.ok(fruitMeshes.every((m) => m.visible === true));

    // Raycast from OrthographicCamera(6, 4.8, 8) looking at (0, 1, 0)
    const camera = new THREE.OrthographicCamera(-3.5, 3.5, 3.5, -3.5, 0.1, 50);
    camera.position.set(6, 4.8, 8);
    camera.lookAt(0, 1, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    const plazaTargets = [
      ['manage', new THREE.Vector3(0, 0.85, -1.345)],
      ['home', new THREE.Vector3(-1.25, 0.5, 1.45)],
      ['orchard', new THREE.Vector3(1.25, 0.5, 1.45)],
      ['bench:bench--1.22--1.1', new THREE.Vector3(-1.22, 0.38, -1.1)],
      ['bench:bench-1.22--1.1', new THREE.Vector3(1.22, 0.38, -1.1)]
    ];
    for (const [expectedAction, pt] of plazaTargets) {
      const hit = raycastFirstVisibleAction(plaza, camera, pt);
      assert.ok(hit, `plaza raycast missed ${expectedAction}`);
      assert.notEqual(hit.object.userData?.decorativeOnly, true, `plaza decorative mesh occluded ${expectedAction}`);
      assert.equal(getTownAction(hit.object), expectedAction, `plaza raycast hit wrong target for ${expectedAction}`);
    }

    const orchardTargets = [
      ['plaza', new THREE.Vector3(-0.8, 0.5, 1.53)],
      ['bench:bench-1.17-1.1', new THREE.Vector3(1.17, 0.38, 1.1)],
      ['harvest', points.harvest]
    ];
    for (const [expectedAction, pt] of orchardTargets) {
      const hit = raycastFirstVisibleAction(orchard, camera, pt);
      assert.ok(hit, `orchard raycast missed ${expectedAction}`);
      assert.notEqual(hit.object.userData?.decorativeOnly, true, `orchard decorative mesh occluded ${expectedAction}`);
      assert.equal(getTownAction(hit.object), expectedAction, `orchard raycast hit wrong target for ${expectedAction}`);
    }

    // All 9 harvest spheres must resolve existing harvest action (fruit or its own harvest tree) without decorative leaf occlusion
    for (let i = 0; i < fruitMeshes.length; i++) {
      const worldPos = new THREE.Vector3();
      fruitMeshes[i].getWorldPosition(worldPos);
      const hit = raycastFirstVisibleAction(orchard, camera, worldPos);
      assert.ok(hit, `fruit ${i} raycast missed`);
      assert.notEqual(hit.object.userData?.decorativeOnly, true, `fruit ${i} was occluded by decorative mesh ${hit.object.name}`);
      assert.equal(getTownAction(hit.object), 'harvest', `fruit ${i} hit ${hit.object.name} did not resolve harvest`);
    }

    // Front-facing tree canopy hits must resolve harvest, while decorative corner plants have no action
    for (const [tx, tz] of [[-1.05, -1.05], [1.02, -0.92], [-1.02, 0.42]]) {
      const hit = raycastFirstVisibleAction(orchard, camera, new THREE.Vector3(tx, 1.56, tz + 0.10));
      assert.ok(hit, `tree canopy at (${tx}, ${tz}) raycast missed`);
      assert.equal(getTownAction(hit.object), 'harvest', `tree canopy hit ${hit.object.name} must resolve harvest`);
    }
    const cornerHit = raycastFirstVisibleAction(orchard, camera, new THREE.Vector3(-1.70, 0.08, -1.70));
    if (cornerHit && cornerHit.object.userData?.decorativeOnly) {
      assert.equal(getTownAction(cornerHit.object), null, 'decorative corner plants must have no townAction');
    }

    disposeDetails();
  });
});
