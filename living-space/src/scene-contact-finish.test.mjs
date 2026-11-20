import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createReferenceStudyRoom } from './reference-study-room.mjs';
import { createBedroomScene } from './bedroom-scene.mjs';
import { createRoomAtmosphere } from './room-atmosphere.mjs';
import { createCozyYardFinish } from './yard-cozy-finish.mjs';
import { createTownDepthDetails } from './town-depth-details.mjs';
import { createCozyTownDistrictDetails } from './cozy-town-districts.mjs';
import { createTownTree } from './town-trees.mjs';

test('the desk chair spokes meet the rug and the small shadow lies on its surface', () => {
  const scene = new THREE.Scene();
  const model = new THREE.Group();
  model.scale.x = -1;
  scene.add(model);
  const study = createReferenceStudyRoom(model);
  const finish = createRoomAtmosphere(scene, model);
  scene.updateMatrixWorld(true);
  try {
    const steel = study.root.getObjectByName('study-desk-charcoal');
    const rugRay = new THREE.Raycaster(new THREE.Vector3(-.30, .229, -.73), new THREE.Vector3(0, 1, 0), 0, .05);
    const hit = rugRay.intersectObject(steel, false)[0];
    assert.ok(hit && hit.point.y >= .232 && hit.point.y <= .235, 'the visible spoke should reach the carpet');
    const contact = model.getObjectByName('desk-chair-rug-contact');
    assert.ok(contact?.position.y > .233 && contact.position.y < .239);
    assert.equal(contact.material.depthWrite, false);
  } finally {
    finish.dispose();
    study.dispose();
  }
});

test('bedroom cloth edging stays below the bed support and the rug has a single broad braid', () => {
  const scene = new THREE.Scene();
  const bedroom = createBedroomScene(scene);
  const finish = createRoomAtmosphere(scene, null);
  scene.updateMatrixWorld(true);
  try {
    const hem = bedroom.root.getObjectByName('bed-mattress-piped-hem');
    assert.ok(hem);
    const bounds = new THREE.Box3().setFromObject(hem);
    assert.ok(bounds.max.y < .575 && bounds.min.y > .525);
    assert.ok(bounds.getSize(new THREE.Vector3()).x > 1.14);
    assert.ok(bounds.getSize(new THREE.Vector3()).z > .84);
    const threads = [];
    bedroom.root.traverse(object => {
      if (object.name === 'braided-reading-rug' || object.userData.parts?.includes('bedroom-rug-braid-stitch')) threads.push(object);
    });
    assert.equal(threads.length, 1);
    const rug = bedroom.root.getObjectByName('bedroom-reading-rug-border');
    assert.ok(new THREE.Box3().setFromObject(threads[0]).min.y >= new THREE.Box3().setFromObject(rug).max.y);
  } finally {
    finish.dispose();
    bedroom.dispose();
  }
});

test('yard contact shades align with the visible tree and porch bases', () => {
  const model = new THREE.Group();
  const finish = createCozyYardFinish(model);
  try {
    const tree = finish.root.getObjectByName('cozy-yard-tree-contact');
    assert.deepEqual([tree.position.x, tree.position.z], [-1.35, -.65]);
    for (const [name, x] of [['porch-left', -.025], ['porch-right', .915]]) {
      const pad = finish.root.getObjectByName(`cozy-yard-${name}-contact`);
      assert.deepEqual([pad.position.x, pad.position.z], [x, .28]);
      assert.ok(pad.position.y > .015 && pad.position.y < .023);
    }
  } finally {
    finish.dispose();
  }
});

test('plaza bench pads meet the lawn directly below each wood leg', () => {
  const plaza = new THREE.Group();
  const orchard = new THREE.Group();
  const bench = new THREE.Group();
  bench.userData.benchAnchor = [-1.22, .415, -1.03];
  const fountain = new THREE.Group();
  fountain.name = 'town-stone-fountain';
  plaza.add(bench, fountain);
  const details = createTownDepthDetails({ plaza, orchard });
  try {
    const pads = plaza.getObjectByName('plaza-contact-shadows').children.slice(1, 5);
    const rounded = n => Math.round(n * 100) / 100;
    const locations = pads.map(({position}) => [rounded(position.x),rounded(position.z)]);
    assert.deepEqual(locations, [[-1.60,-1.26],[-1.60,-.98],[-.84,-1.26],[-.84,-.98]]);
    assert.ok(pads.every(mesh => mesh.position.y > .025 && mesh.position.y < .033));
  } finally {
    details.dispose();
  }
});

test('fruit twigs are part of the existing bark mesh and move with the canopy', () => {
  const orchard = new THREE.Group();
  const tree = createTownTree({ x:1.02, z:-.92, action:'harvest' });
  orchard.add(tree);
  const bark = tree.getObjectByName('tree-bark');
  const original = bark.geometry;
  const firstTwig = original.attributes.position.count;
  const details = createCozyTownDistrictDetails({ orchard });
  try {
    assert.ok(bark.geometry.attributes.position.count > firstTwig);
    assert.equal(bark.parent, tree);
    orchard.updateMatrixWorld(true);
    const point = new THREE.Vector3().fromBufferAttribute(bark.geometry.attributes.position, firstTwig);
    const before = bark.localToWorld(point.clone());
    tree.rotation.z = .021;
    orchard.updateMatrixWorld(true);
    const after = bark.localToWorld(point.clone());
    assert.ok(before.distanceTo(after) > .02);
  } finally {
    details.dispose();
    assert.equal(bark.geometry, original);
  }
});
