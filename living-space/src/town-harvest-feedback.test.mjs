import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTownHarvestFeedback } from './town-harvest-feedback.mjs';
import { orchardStops } from './town-actor-motion.mjs';

test('the confirmed fruit begins at the selected branch, clears the actor, and lands in the basket', () => {
  const orchard = new THREE.Group();
  const camera = new THREE.OrthographicCamera(-3, 3, 2, -2, .1, 100);
  camera.position.set(6, 4.8, 8);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld(true);
  const view = camera.getWorldDirection(new THREE.Vector3()).negate();
  const geometries = [new THREE.SphereGeometry(.085), new THREE.SphereGeometry(.082), new THREE.SphereGeometry(.087)];
  const material = new THREE.MeshBasicMaterial();
  const fruit = geometries.map(geometry => new THREE.Mesh(geometry, material));
  orchard.add(...fruit);
  const effect = createTownHarvestFeedback(orchard);
  const trees = [[-1.05, -1.05], [1.02, -.92], [-1.02, .42]];
  const offsets = [[-.20, 1.16, .46], [.26, 1.42, .46], [.45, 1.08, .18]];
  for (const [index, [x, z]] of trees.entries()) {
    const actorPosition = new THREE.Vector3().fromArray(orchardStops[index]);
    fruit.forEach((mesh, id) => mesh.position.set(x + offsets[id][0], offsets[id][1], z + offsets[id][2]));
    effect.play(fruit, actorPosition, camera);
    const moving = orchard.getObjectByName('orchard-confirmed-fruit');
    const source = fruit[index === 1 ? 2 : 0];
    assert.deepEqual(moving.position.toArray(), source.position.toArray());
    assert.equal(moving.geometry, source.geometry);
    assert.equal(moving.material, source.material);
    const headCenter = actorPosition.clone().add(new THREE.Vector3(0, 1.12, 0)).project(camera);
    for (let elapsed = 0; elapsed <= 780; elapsed += 15) {
      effect.step(elapsed, true);
      const screen = moving.position.clone().project(camera);
      if (Math.abs(screen.x - headCenter.x) < .116 && Math.abs(screen.y - headCenter.y) < .15) {
        assert.ok(moving.position.clone().sub(actorPosition).dot(view) < -.085, 'fruit must pass behind the head');
      }
    }
    assert.ok(moving.position.distanceTo(new THREE.Vector3(1.45, .14, .15)) < .09);
    const paused = moving.position.clone();
    effect.step(2000, false);
    effect.step(4000, true);
    assert.ok(moving.position.distanceTo(paused) < 1e-8, 'hidden time must not advance the fruit');
    effect.step(4060, true);
    effect.step(4120, true);
    assert.equal(effect.state().active, false);
  }
  effect.dispose();
  geometries.forEach(geometry => geometry.dispose());
  material.dispose();
});
