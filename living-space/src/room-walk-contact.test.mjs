import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCompanionLayer } from './scene-companion.mjs';

test('the walking shadow settles under the planted foot and blends into both seats', () => {
  const layer = createCompanionLayer(new THREE.Scene());
  try {
    const step = {
      room: 'bedroom', from: 'relax', to: 'bedSit',
      settings: { x: .01, z: 0 }, destinationSettings: { x: .03, z: .06 },
      point: new THREE.Vector3(.22, .225, .14), stand: 0, sit: 0, bob: 0
    };
    layer.sync({ room: 'bedroom', pose: 'relax', settings: step.settings });
    const start = layer.getShadowState();
    const seatedWidth = layer.shadowMesh.scale.x;
    layer.walkContact(step);
    assert.deepEqual(layer.getShadowState(), start);

    layer.walkContact({ ...step, stand: 1 });
    assert.deepEqual(layer.getShadowState().position, [.22, .225, .14]);
    assert.ok(layer.shadowMesh.scale.x < seatedWidth * .8);
    const plantedOpacity = layer.getShadowState().opacity;
    layer.walkContact({ ...step, stand: 1, bob: .016 });
    assert.ok(layer.getShadowState().opacity < plantedOpacity);
    assert.deepEqual(layer.getShadowState().position, [.22, .225, .14]);

    layer.walkContact({ ...step, stand: 1, sit: 1 });
    const arrived = layer.getShadowState();
    layer.sync({ room: 'bedroom', pose: 'bedSit', settings: step.destinationSettings });
    assert.deepEqual(arrived, layer.getShadowState());
  } finally {
    layer.dispose();
  }
});
