import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Vector3} from 'three';
import {sampleBedroomWalk} from './bedroom-walk.mjs';
import {sampleStudyWalk, sampleStudyReturn} from './study-walk.mjs';
import {roomWalkDistance} from './room-walk-timing.mjs';

test('room walks are monotonic and stop smoothly at both ends', () => {
  let last = 0;
  for(let i = 0; i <= 100; i++) {
    const distance = roomWalkDistance(i / 100);
    assert.ok(distance >= last && distance <= 1);
    last = distance;
  }
  assert.equal(last, 1);
  assert.ok(roomWalkDistance(.01) < .0001);
  assert.ok(1 - roomWalkDistance(.99) < .0001);
});

for (const [name, sample, stoppedAt, sitAt] of [
  ['bedroom', sampleBedroomWalk, 1800, 1900],
  ['study to chair', sampleStudyWalk, 2545, 2640],
  ['study to desk', sampleStudyReturn, 1845, 1940],
]) {
  test(name + ' keeps both the destination and its final gait frame through the seating handoff', () => {
    const near = new Vector3();
    const standing = new Vector3();
    const seated = new Vector3();
    const approach = sample(stoppedAt - 1, near);
    const hold = sample(stoppedAt, standing);
    const sit = sample(sitAt + 15, seated);
    assert.ok(hold.frame === approach.frame && sit.frame === hold.frame);
    assert.ok(near.distanceTo(standing) < 1e-5);
    assert.deepEqual(seated.toArray(), standing.toArray());
    assert.equal(hold.sit, 0);
    assert.ok(sit.sit > 0);
  });
}
