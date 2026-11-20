import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBedRestContactLayer } from './bed-rest-contact.mjs';
import { sampleStudyWalk } from './study-walk.mjs';
import { bindTownPoseBlend } from './town-pose-blend.mjs';

test('bed contact follows the displayed bed pose and fades with the departing actor', () => {
  const layer = createBedRestContactLayer(new THREE.Group(), new THREE.Group());
  const options = { active:true, pose:'lying', opacity:1 };
  try {
    const start = layer.sync({ ...options, phase:'wake' });
    const beginning = layer.sync({ ...options, phase:'pushUp', blend:{ toPose:'rise', weight:0 } });
    assert.equal(beginning.tuckWeight, start.tuckWeight);
    assert.equal(beginning.bolsterWeight, start.bolsterWeight);
    const middle = layer.sync({ ...options, phase:'pushUp', blend:{ toPose:'rise', weight:.5 } });
    const rise = layer.sync({ ...options, phase:'pushUp', pose:'rise' });
    assert.ok(start.tuckWeight > middle.tuckWeight && middle.tuckWeight > rise.tuckWeight);
    assert.equal(layer.sync({ ...options, phase:'fadeOut', pose:'rise', opacity:.5 }).tuckWeight, rise.tuckWeight * .5);
    assert.equal(layer.sync({ ...options, phase:'returnChair', pose:'relax' }).active, false);
  } finally {
    layer.dispose();
  }
});

test('the study chair absorbs the landing and delayed tail follows without moving the seat anchor', () => {
  const point = new THREE.Vector3();
  const approach = sampleStudyWalk(2640, point);
  const planted = point.clone();
  const halfway = sampleStudyWalk(2860, point);
  const landing = sampleStudyWalk(3000, point);
  assert.equal(approach.seatDip, 0);
  assert.ok(halfway.seatDip > .01 && halfway.seatDip < .05);
  assert.equal(landing.seatDip, 0);
  assert.notEqual(landing.hair, 0);
  assert.equal(sampleStudyWalk(2900, point).tail, 0);
  assert.notEqual(sampleStudyWalk(3050, point).tail, 0);
  assert.deepEqual(point.toArray(), planted.toArray());
});

test('planted plaza blend registers both poses at their sole as the upper body turns', () => {
  const material = new THREE.SpriteMaterial({ map: new THREE.Texture() });
  const sprite = new THREE.Sprite(material);
  const controller = bindTownPoseBlend(sprite);
  const shader = { uniforms:{}, fragmentShader:'#include <map_fragment>' };
  material.onBeforeCompile(shader);
  const start = { texture:material.map, center:[.28,.02], face:[.26,.65], width:1.1, height:1.4 };
  const end = { texture:new THREE.Texture(), center:[.44,.03], face:[.42,.65], width:1.4, height:1.45 };
  controller.show(start, end, .45, true);
  const { planted, fromFeet, toFeet, blendedFeet } = shader.uniforms;
  assert.equal(planted?.value, 1);
  assert.deepEqual(fromFeet.value.toArray(), start.center);
  assert.deepEqual(toFeet.value.toArray(), end.center);
  assert.deepEqual(blendedFeet.value.toArray(), sprite.center.toArray());
  controller.show(end);
  assert.equal(planted.value, 0);
  start.texture.dispose();
  end.texture.dispose();
  material.dispose();
});
