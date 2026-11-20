import * as THREE from 'three';

const TRAVEL = 780;
const END = 900;

// This cue reuses the harvested fruit's geometry and material. The orchard
// owns both resources and confirms the transaction before the cue begins.
export function createTownHarvestFeedback(orchard) {
  const origin = new THREE.Vector3();
  const first = new THREE.Vector3();
  const second = new THREE.Vector3();
  const view = new THREE.Vector3();
  const screenRight = new THREE.Vector3();
  const relative = new THREE.Vector3();
  const basket = new THREE.Vector3(1.45, .14, .15);
  const path = new THREE.CubicBezierCurve3(origin, first, second, basket);
  let fruit = null;
  let elapsed = 0;
  let lastTime = null;

  function reset() {
    fruit?.removeFromParent();
    fruit = null;
    lastTime = null;
  }

  function play(branchFruit, actorPosition, camera) {
    reset();
    screenRight.setFromMatrixColumn(camera.matrixWorld, 0);
    let source = null;
    let separation = -1;
    for (const candidate of branchFruit) {
      const distance = Math.abs(relative.subVectors(candidate.position, actorPosition).dot(screenRight));
      if (distance <= separation) continue;
      separation = distance;
      source = candidate;
    }
    if (!source) return;
    origin.copy(source.position);
    camera.getWorldDirection(view);
    view.y = 0;
    view.normalize();
    first.copy(origin).addScaledVector(view, .77);
    first.y -= .36;
    second.copy(basket).addScaledVector(view, 1.18);
    second.y = .27;
    fruit = source.clone();
    fruit.name = 'orchard-confirmed-fruit';
    fruit.userData = {};
    fruit.castShadow = false;
    fruit.raycast = () => {};
    fruit.visible = true;
    orchard.add(fruit);
    elapsed = 0;
  }

  function step(now, playing) {
    if (!fruit) return;
    if (playing && lastTime !== null) elapsed += Math.min(60, Math.max(0, now - lastTime));
    lastTime = playing ? now : null;
    if (elapsed >= END) {
      reset();
      return;
    }
    const progress = Math.min(1, elapsed / TRAVEL);
    path.getPoint(progress * progress * (3 - 2 * progress), fruit.position);
    fruit.rotation.set(progress * 2.9, progress * 4.1, progress * 1.2);
    fruit.scale.setScalar(1 - .7 * THREE.MathUtils.smoothstep(elapsed, 660, END));
  }

  return { play, step, state: () => ({ active: fruit !== null, elapsed }), reset, dispose: reset };
}
