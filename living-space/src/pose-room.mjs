import {STUDY_LAYOUT} from './reference-room-layout.mjs';
import {visibleSceneHits} from './room-visibility.mjs';
import { createMicroRoomDetails } from './micro-room-details.mjs';
import { createRoomAutoLife } from './room-auto-life.mjs';
import { createTownSurface } from './room-town-surface.mjs';
import { createRoomAlarm, createRoomExit } from './room-alarm.mjs';
import { createRoomWorkstation } from './room-workstation-client.mjs';
import { createRoomLighting } from './room-lighting.mjs';
import { createRoomPhone } from './room-phone.mjs';
import { createRoomHandheld, handheldAnchor } from './room-handheld.mjs';
import { buildRoomCutout } from './room-cutout.mjs';
import { createRoomActionController, AVAILABLE_COMPANION_ACTIONS } from './room-action-controller.mjs';
import { createRoomActivities } from './room-activities.mjs';
import { furnitureForHit } from './room-hotspots.mjs';
import { installRoomUI } from './pure-room-ui.mjs';
import { bedSettleStretch, motionFrame, transitionFrame, blinkFrame, demoPose } from './pose-motion.mjs';
import { loadBedroomWalkFrames, sampleBedroomWalk } from './bedroom-walk.mjs';
import { mirrorStudyWalkFrames, sampleStudyReturn, sampleStudyWalk, studySeatWarp } from './study-walk.mjs';
import {
  createStudyStairsAndLayers,
  createBedroomScene,
  STUDY_STAIRS_POINT,
  BEDROOM_POINTS
} from './bedroom-scene.mjs';
import {
  createCompanionLayer,
  getRoomPoseConfig
} from './scene-companion.mjs';
import {
  createSceneTransitions,
  isValidRoom
} from './scene-transitions.mjs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const stage = document.getElementById('stage');
const canvas = document.querySelector('canvas');
const transitionVeil = document.getElementById('room-transition-veil');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = null;
const lighting = createRoomLighting(scene, renderer);
const handheld = createRoomHandheld();
scene.add(handheld);

const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 100);
camera.position.set(-6.8, 5.6, 7.2);
camera.lookAt(0, 1.29, 0);

const companionLayer = createCompanionLayer(scene);
const bedroomScene = createBedroomScene(scene);
let studyLayers = null;
let phone = null, alarm = null, exitMat = null;
let sprite, model, textures, pose = 'back', preStretchStation = 'desk', queued = false, zoomed = false, renderCount = 0;
let bedroomWalk = null;
let studyWalk = null;
let bedroomWalkFrames = [];
let studyReturnFrames = [];
const walkPoint = new THREE.Vector3();
const assetLoadErrors = [];

const settings = { x: 0, y: 0, z: 0, size: 1.7 };
let placementStation = 'desk';
const saved = {
  desk: { ...settings },
  chair: { ...settings },
  reading: { ...settings },
  bed: { ...settings }
};

function currentConfig(poseName = pose) {
  return getRoomPoseConfig(sceneTransitions.getActiveRoom(), poseName);
}

const status = document.getElementById('status');
const actionController = createRoomActionController();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let externallyHidden = false;
let motionEnabled = !reducedMotion.matches;
let transition = null, bedPoseBlend = null, frameTimer = 0, rafId = 0, motionTime = 0, lastFrameTime = 0, poseStarted = 0, restWeight = 0, demoEnabled = true, demoTime = 0;
const BED_POSE_BLEND_MS = 220;

const blendUniforms = {
  nextPoseMap: { value: null },
  poseUvDelta: { value: new THREE.Vector2() },
  poseBlend: { value: 0 },
  poseFrameBounds: { value: new THREE.Vector2(0, 0.5) },
  nextPoseBounds: { value: new THREE.Vector2(0, 0.5) },
  eyeOnly: { value: 0 },
  sourcePoseOffset: { value: new THREE.Vector2() },
  returnPoseOffset: { value: new THREE.Vector2() },
  returnHandoff: { value: 0 },
  contactPoseOffset: { value: new THREE.Vector2() },
  contactHandoff: { value: 0 },
  seatPoseInfluence: { value: new THREE.Vector2() },
  seatFollowThrough: { value: new THREE.Vector2() }
};

// Eye centers in the existing pose artwork, measured in a single frame.
const bedFace = {
  bedSit: [.44, .64], lying: [.65, .52], rise: [.397, .616]
};
const chairSitRegistration = [.18, -.024];

function clearBedPoseBlend() {
  bedPoseBlend = null;
}

function startBedPoseBlend(fromPose, toPose) {
  if (!fromPose || !toPose || fromPose === toPose) return;
  if (bedPoseBlend && bedPoseBlend.toPose === toPose) return;
  if (bedPoseBlend && bedPoseBlend.fromPose !== fromPose) {
    applyPose(fromPose);
  }
  bedPoseBlend = {
    fromPose,
    toPose,
    elapsed: 0,
    duration: BED_POSE_BLEND_MS,
    weight: 0
  };
}

function stepBedPoseBlend(dtMs, paused) {
  if (!bedPoseBlend) return null;
  if (!paused) {
    bedPoseBlend.elapsed += Math.max(0, Number(dtMs) || 0);
  }
  const rawP = Math.min(1, bedPoseBlend.elapsed / bedPoseBlend.duration);
  const w = rawP * rawP * (3 - 2 * rawP);
  bedPoseBlend.weight = w;
  const fromFace = bedFace[bedPoseBlend.fromPose];
  const toFace = bedFace[bedPoseBlend.toPose];
  setBlend(bedPoseBlend.toPose, w, true, [fromFace[0] - toFace[0], fromFace[1] - toFace[1]]);
  const fromCfg = currentConfig(bedPoseBlend.fromPose);
  const toCfg = currentConfig(bedPoseBlend.toPose);
  const cx = fromCfg.center[0] + (toCfg.center[0] - fromCfg.center[0]) * w;
  const cy = fromCfg.center[1] + (toCfg.center[1] - fromCfg.center[1]) * w;
  const asp = (fromCfg.aspect || 1) + ((toCfg.aspect || 1) - (fromCfg.aspect || 1)) * w;
  const sc = (fromCfg.sizeScale || 1) + ((toCfg.sizeScale || 1) - (fromCfg.sizeScale || 1)) * w;
  if (rawP >= 1) {
    const doneTarget = bedPoseBlend.toPose;
    bedPoseBlend = null;
    applyPose(doneTarget);
    setBlend(doneTarget, 0);
    return null;
  }
  return { center: [cx, cy], aspect: asp, sizeScale: sc, stretch: bedSettleStretch(w) };
}

function setBlend(target, amount, allowCrossPose = false, contactRegistration = null) {
  if (!textures || !sprite) return;
  const cfg = currentConfig(pose);
  const inChairStation = cfg.station === 'chair' || cfg.station === 'reading';
  const isSingleFrame = (t) => t && (t.userData.walkFrame || t === textures.rise || t === textures.stretch || t === textures.bedSit);
  let targetTexKey = target;
  if (!allowCrossPose && inChairStation && !['relax', 'rest', 'stretch'].includes(target)) {
    targetTexKey = 'relax';
  }
  const nextTex = textures[targetTexKey] || textures.relax;
  blendUniforms.nextPoseMap.value = nextTex;
  blendUniforms.poseUvDelta.value.copy(nextTex.offset).sub(sprite.material.map.offset);
  blendUniforms.poseBlend.value =
    allowCrossPose ? amount : isSingleFrame(sprite.material.map) || isSingleFrame(nextTex) ? 0 : amount;
  blendUniforms.eyeOnly.value = allowCrossPose
    ? 0
    : Number(inChairStation && ['relax', 'rest'].includes(targetTexKey));
  blendUniforms.contactHandoff.value = Number(contactRegistration !== null);
  if (contactRegistration) blendUniforms.contactPoseOffset.value.set(...contactRegistration);
  blendUniforms.sourcePoseOffset.value.copy(sprite.material.map.offset);

  if (isSingleFrame(sprite.material.map)) {
    blendUniforms.poseFrameBounds.value.set(0, 1);
  } else {
    const curOffX = sprite.material.map.offset.x;
    blendUniforms.poseFrameBounds.value.set(curOffX, curOffX + 0.5);
  }

  if (isSingleFrame(nextTex)) {
    blendUniforms.nextPoseBounds.value.set(0, 1);
  } else {
    const nextOffX = nextTex.offset.x;
    blendUniforms.nextPoseBounds.value.set(nextOffX, nextOffX + 0.5);
  }
}

function finishTransition() {
  clearBedPoseBlend();
  if (!transition) return;
  const target = transition.target;
  const onComplete = transition.onComplete;
  transition = null;
  applyPose(target);
  if (sprite) sprite.material.opacity = 1;
  setBlend(target === 'rest' ? 'rest' : target, target === 'rest' ? 1 : 0);
  if (typeof onComplete === 'function') {
    onComplete();
  } else if (target === 'turn' && !demoEnabled && motionEnabled && !reducedMotion.matches) {
    startHead();
  }
}

function startHead() {
  const currentW = actionController.isHeadTurning() ? blendUniforms.poseBlend.value : (pose === 'turn' ? 1 : 0);
  actionController.startHead(currentW);
  if (sceneTransitions.getActiveRoom() === 'study' && currentConfig(pose).station === 'desk') {
    applyPose('turn');
    sprite.material.map = textures.back;
    sprite.material.needsUpdate = true;
    setBlend('turn', currentW);
  }
  redraw();
}

function isPausedState() {
  const menuEl = document.getElementById('context-menu');
  return (
    !motionEnabled ||
    reducedMotion.matches ||
    document.hidden ||
    externallyHidden ||
    activities.active() ||
    townSurface.active() ||
    Boolean(menuEl && !menuEl.hidden)
  );
}

function setMotion(enabled) {
  motionEnabled = !!enabled;
  if (!motionEnabled && reducedMotion.matches) {
    cancelBedroomWalk();
    cancelStudyWalk();
  }
  const walking = Boolean(bedroomWalk || studyWalk);
  clearTimeout(frameTimer);
  if (!walking) {
    clearBedPoseBlend();
    finishTransition();
  }
  if (!motionEnabled && !walking) {
    actionController.cancelAll();
    if (sprite) {
      if (pose === 'rise' || pose === 'bedSit') {
        applyPose('relax');
      } else if (pose === 'stretch') {
        applyPose(sceneTransitions.getActiveRoom() === 'study' && preStretchStation === 'desk' ? 'back' : 'relax');
      }
      sprite.material.opacity = 1;
    }
  }
  if (sprite && !walking) {
    sprite.material.opacity = 1;
    sprite.material.rotation = 0;
    setBlend(pose === 'lying' ? 'lyingRest' : pose, pose === 'rest' || pose === 'lying' ? 1 : 0);
    update();
  }
  const button = document.getElementById('motion');
  button.textContent = motionEnabled ? '暂停动作' : '开启动作';
  button.setAttribute('aria-pressed', String(motionEnabled));
  lastFrameTime = 0;
  redraw();
}

function syncReducedMotion() {
  if (!reducedMotion.matches) return false;
  let synced = false;
  if (motionEnabled) {
    setMotion(false);
    synced = true;
  }
  if (
    actionController.isLying() ||
    actionController.isRising() ||
    actionController.isStretching() ||
    transition ||
    sceneTransitions.isTransitioning()
  ) {
    actionController.cancelAll();
    sceneTransitions.cancel();
    clearBedPoseBlend();
    finishTransition();
    synced = true;
  }
  if (sprite && sprite.material.opacity < 0.99) {
    sprite.material.opacity = 1;
    synced = true;
  }
  return synced;
}

function setDemo(enabled) {
  demoEnabled = !!enabled;
  demoTime = 0;
  const button = document.getElementById('demo');
  button.setAttribute('aria-pressed', String(demoEnabled));
  if (demoEnabled) {
    setMotion(true);
    setPose(sceneTransitions.getActiveRoom() === 'bedroom' ? 'relax' : 'back', { automatic: true });
  }
  redraw();
}

document.getElementById('demo').addEventListener('click', () => setDemo(!demoEnabled));
document.getElementById('motion').addEventListener('click', () => setMotion(!motionEnabled));
document.getElementById('motion').textContent = motionEnabled ? '暂停动作' : '开启动作';
document.getElementById('motion').setAttribute('aria-pressed', String(motionEnabled));
reducedMotion.addEventListener('change', (e) => {
  setMotion(!e.matches);
  if (e.matches) {
    actionController.cancelAll();
    sceneTransitions.cancel();
  }
});

function syncRoomVisibility(roomName) {
  lighting.setRoom(roomName);
  const inStudy = roomName === 'study';
  if (model) model.visible = inStudy;
  if (studyLayers) studyLayers.setVisible(inStudy);
  handheld.visible = inStudy;
  if (phone) phone.visible = inStudy;
  if (alarm) alarm.visible = inStudy;
  if (exitMat) exitMat.visible = inStudy;
  bedroomScene.setVisible(!inStudy);

  const switchBtn = document.getElementById('room-floor-switch');
  if (switchBtn) {
    switchBtn.textContent = inStudy ? '上二楼卧室' : '回一楼书房';
  }
  document.getElementById('soft-light').textContent = inStudy ? '台灯' : '床头灯';
  if (renderer.shadowMap) {
    renderer.shadowMap.needsUpdate = true;
  }
}

const sceneTransitions = createSceneTransitions({
  initialRoom: 'study',
  durationMs: 380,
  isReducedMotion: () => reducedMotion.matches,
  isMotionEnabled: () => motionEnabled,
  isHidden: () => document.hidden || externallyHidden,
  onStartTransition: ({ immediate }) => {
    cancelBedroomWalk();
    cancelStudyWalk();
    demoEnabled = false;
    document.getElementById('demo')?.setAttribute('aria-pressed', 'false');
    finishTransition();
    if (immediate) {
      actionController.cancelAll();
    } else {
      actionController.startApproachStairs(140);
    }
    redraw();
  },
  onSwapRoom: (nextRoom) => {
    clearBedPoseBlend();
    actionController.cancelAll();
    syncRoomVisibility(nextRoom);
    const targetPose = nextRoom === 'bedroom' ? 'relax' : 'back';
    applyPose(targetPose);
    setBlend(targetPose, 0);
    cachedMask = null;
    setTimeout(sendMask, 80);
  },
  onProgress: ({ sceneOpacity, veilOpacity }) => {
    if (sprite) {
      sprite.material.opacity = sceneOpacity;
      companionLayer.sync({
        room: sceneTransitions.getActiveRoom(),
        pose,
        settings,
        stretch: 1,
        opacity: sceneOpacity
      });
    }
    if (transitionVeil) {
      transitionVeil.style.opacity = String(veilOpacity);
    }
    redraw();
  },
  onFinishTransition: () => {
    if (sprite) sprite.material.opacity = 1;
    if (transitionVeil) transitionVeil.style.opacity = '0';
    lastFrameTime = 0;
    cachedMask = null;
    setTimeout(sendMask, 80);
    redraw();
  },
  getRoomState: () => getRoomStateSnapshot()
});

const floorSwitchBtn = document.getElementById('room-floor-switch');
if (floorSwitchBtn) {
  floorSwitchBtn.addEventListener('click', () => {
    const nextRoom = sceneTransitions.getActiveRoom() === 'study' ? 'bedroom' : 'study';
    sceneTransitions.openRoom(nextRoom);
  });
}

function cancelBedroomWalk() {
  if (!bedroomWalk) return;
  bedroomWalk = null;
  applyPose('relax');
  setBlend('relax', 0);
  cachedMask = null;
}

function stepBedroomWalk(dtMs) {
  const travel = bedroomWalk;
  travel.elapsed += dtMs;
  const frame = sampleBedroomWalk(travel.elapsed, walkPoint);
  if (frame.done) {
    bedroomWalk = null;
    applyPose('bedSit');
    setBlend('bedSit', 0);
    actionController.startLieDown(1750, false, 1, true);
    cachedMask = null;
    requestAnimationFrame(sendMask);
    return;
  }

  const standing = bedroomWalkFrames[frame.frame];
  const chair = getRoomPoseConfig('bedroom', 'relax');
  const bed = getRoomPoseConfig('bedroom', 'bedSit');
  const mix = THREE.MathUtils.lerp;
  const standingHeight = travel.size * .76;
  const chairHeight = travel.size * (chair.sizeScale || 1);
  const bedHeight = saved.bed.size * (bed.sizeScale || 1);
  const seated = frame.sit > 0;
  const [x, y, z] = travel.anchor;
  sprite.position.set(
    mix(mix(x, walkPoint.x, frame.stand), bed.base[0] + saved.bed.x, frame.sit),
    mix(mix(y, walkPoint.y + frame.bob, frame.stand), bed.base[1] + saved.bed.y, frame.sit),
    mix(mix(z, walkPoint.z, frame.stand), bed.base[2] + saved.bed.z, frame.sit)
  );
  sprite.center.set(
    mix(mix(chair.center[0], standing.center[0], frame.stand), bed.center[0], frame.sit),
    mix(mix(chair.center[1], standing.center[1], frame.stand), bed.center[1], frame.sit)
  );
  sprite.scale.set(
    mix(mix(chairHeight * chair.aspect, standingHeight * standing.aspect, frame.stand), bedHeight * bed.aspect, frame.sit),
    mix(mix(chairHeight, standingHeight, frame.stand), bedHeight, frame.sit), 1
  );
  sprite.material.opacity = 1;
  sprite.material.rotation = 0;
  sprite.material.map = frame.stand < 1 ? textures.relax : standing.texture;
  setBlend(frame.stand < 1 ? 'walk' + frame.frame : seated ? 'bedSit' : 'walk' + frame.frame,
    frame.stand < 1 ? frame.stand : frame.sit, true);
  companionLayer.walkContact({
    room: 'bedroom', from: 'relax', to: 'bedSit', settings, destinationSettings: saved.bed,
    point: walkPoint, stand: frame.stand, sit: frame.sit, bob: frame.bob
  });
  bedroomScene.syncBedContact({
    active: frame.sit > 0, phase: 'bedPrep', pose: 'bedSit', opacity: frame.sit ** 2
  });
}

function canWalkInStudy(target, frames) {
  return motionEnabled && !reducedMotion.matches && frames.length === 4 &&
    [settings, saved[target]].every(offset => Math.hypot(offset.x, offset.y, offset.z) < .15);
}

function startStudyWalk() {
  const initialTurn = actionController.isHeadTurning()
    ? blendUniforms.poseBlend.value : Number(pose === 'turn');
  actionController.cancelAll();
  applyPose('turn');
  sprite.material.map = textures.back;
  sprite.material.opacity = 1;
  sprite.material.rotation = 0;
  setBlend('turn', initialTurn, true);
  studyWalk = { elapsed: 0, target: 'chair', initialTurn, anchor: sprite.position.toArray(), size: settings.size };
}

function startStudyReturn() {
  const initialEye = pose === 'rest' ? 1 : blendUniforms.poseBlend.value;
  actionController.cancelAll();
  applyPose('relax');
  sprite.material.opacity = 1;
  setBlend('rest', initialEye);
  studyWalk = { elapsed: 0, phase: 'lean', target: 'desk', initialEye, anchor: sprite.position.toArray(), size: settings.size };
}

function cancelStudyWalk() {
  if (!studyWalk) return;
  const atDesk = studyWalk.seated ? studyWalk.target === 'desk' : studyWalk.target === 'chair';
  const target = atDesk ? 'back' : 'relax';
  applyPose(target);
  sprite.material.rotation = 0;
  setBlend(target, 0);
  cachedMask = null;
}

function stepStudyWalk(dtMs) {
  const travel = studyWalk;
  travel.elapsed += dtMs;
  const toDesk = travel.target === 'desk';
  const sample = toDesk ? sampleStudyReturn(travel.elapsed, walkPoint) : sampleStudyWalk(travel.elapsed, walkPoint);
  travel.phase = sample.phase;
  blendUniforms.seatPoseInfluence.value.set(Number(sample.phase === 'settle'), Number(sample.phase === 'sit'));
  const mix = THREE.MathUtils.lerp;
  if (sample.phase === 'turn' || sample.phase === 'hold') {
    setBlend('turn', mix(travel.initialTurn, 1, sample.turn), true);
    return;
  }
  if (sample.phase === 'settle' || sample.phase === 'turnBack') {
    if (!travel.seated) {
      applyPose(toDesk ? 'turn' : 'relax');
      sprite.material.rotation = 0;
      studyWalk = travel;
      blendUniforms.seatPoseInfluence.value.set(Number(!toDesk), 0);
      travel.seated = true;
      if (toDesk) sprite.material.map = textures.back;
      cachedMask = null;
      requestAnimationFrame(sendMask);
    }
    if (toDesk) setBlend('turn', 1 - sample.turn, true);
    else setBlend('relax', 0);
    blendUniforms.seatFollowThrough.value.set(sample.hair, sample.tail);
    if (sample.done) {
      studyWalk = null;
      blendUniforms.seatPoseInfluence.value.set(0, 0);
      if (toDesk) {
        applyPose('back');
        setBlend('back', 0);
      }
    }
    return;
  }

  const desk = getRoomPoseConfig('study', 'turn');
  const chair = getRoomPoseConfig('study', 'relax');
  const source = toDesk ? chair : desk;
  const destination = toDesk ? desk : chair;
  const destinationSettings = saved[travel.target];
  const standing = (toDesk ? studyReturnFrames : bedroomWalkFrames)[sample.frame];
  const walkingHeight = travel.size * .76;
  const [x, y, z] = travel.anchor;
  const lean = sample.lean ?? 0;
  sprite.position.set(
    mix(mix(x, walkPoint.x, sample.stand), destination.base[0] + destinationSettings.x, sample.sit) - .018 * lean,
    mix(mix(y, walkPoint.y + sample.bob, sample.stand), destination.base[1] + destinationSettings.y, sample.sit) -
      .025 * lean - (sample.seatDip ?? 0),
    mix(mix(z, walkPoint.z, sample.stand), destination.base[2] + destinationSettings.z, sample.sit) + .053 * lean
  );
  sprite.center.set(
    mix(mix(source.center[0], standing.center[0], sample.stand), destination.center[0], sample.sit),
    mix(mix(source.center[1], standing.center[1], sample.stand), destination.center[1], sample.sit)
  );
  sprite.scale.set(
    mix(mix(travel.size * source.aspect, walkingHeight * standing.aspect, sample.stand), destinationSettings.size * destination.aspect, sample.sit),
    mix(mix(travel.size, walkingHeight, sample.stand), destinationSettings.size, sample.sit), 1
  );
  sprite.material.rotation = .048 * lean + (sample.seatPitch ?? -(sample.seatDip ?? 0));
  const standingKey = (toDesk ? 'returnWalk' : 'walk') + sample.frame;
  const gettingUp = sample.phase === 'lean' || sample.phase === 'stand';
  sprite.material.map = gettingUp ? (toDesk ? textures.relax : textures.turn) : standing.texture;
  if (sample.phase === 'lean') {
    setBlend('rest', travel.initialEye * (1 - lean));
  } else {
    const toChair = !toDesk && sample.phase === 'sit';
    setBlend(sample.phase === 'sit' ? (toDesk ? 'turn' : 'relax') : standingKey,
      gettingUp ? sample.stand : sample.sit, true, toChair ? chairSitRegistration : null);
  }
  if (toDesk) {
    // Register face centers across the idle, gait and seated artwork.
    const returnHandoff = sample.phase === 'stand' || sample.phase === 'sit';
    blendUniforms.returnHandoff.value = Number(returnHandoff);
    blendUniforms.returnPoseOffset.value.set(gettingUp ? .07 : .10, -.035);
  }
  blendUniforms.seatFollowThrough.value.set(sample.hair, sample.tail);

  companionLayer.walkContact({
    room: 'study', from: toDesk ? 'relax' : 'turn', to: toDesk ? 'turn' : 'relax',
    settings, destinationSettings, point: walkPoint, stand: sample.stand, sit: sample.sit, bob: sample.bob
  });
}

function animate(now) {
  if (!sprite) return;
  syncReducedMotion();
  const realDtMs = lastFrameTime ? Math.max(0, now - lastFrameTime) : 0;
  const dt = Math.min(realDtMs / 1000, 0.1);
  lastFrameTime = now;

  const paused = isPausedState();
  if (bedroomWalk) {
    stepBedroomWalk(paused ? 0 : Math.min(realDtMs, 64));
    return;
  }
  if (studyWalk) {
    stepStudyWalk(paused ? 0 : Math.min(realDtMs, 64));
    return;
  }
  if (!paused) {
    motionTime += dt * 1.5;
    if (demoEnabled) demoTime += dt * 1.5;
  }

  if (
    !paused &&
    demoEnabled &&
    !transition &&
    !sceneTransitions.isTransitioning() &&
    sceneTransitions.getActiveRoom() === 'study'
  ) {
    const target = demoPose(demoTime);
    if (target !== pose) setPose(target, { automatic: true });
  }

  const cfg = currentConfig(pose);
  const inChairStation = cfg.station === 'chair' || cfg.station === 'reading';

  const action = actionController.step(realDtMs, {
    pose,
    motionEnabled,
    reducedMotion: reducedMotion.matches,
    demoEnabled,
    transitioning: !!transition || sceneTransitions.isTransitioning(),
    gameActive: activities.active(),
    townActive: townSurface.active(),
    hidden: document.hidden || externallyHidden,
    menuOpen: !document.getElementById('context-menu').hidden
  });

  if (sceneTransitions.isTransitioning()) {
    clearBedPoseBlend();
    const st = sceneTransitions.getState();
    sprite.material.opacity = st.sceneOpacity;
  } else if (action.riseSample) {
    const rs = action.riseSample;
    const prevStation = currentConfig(pose).station;
    sprite.material.opacity = rs.opacity;
    if (rs.poseKey === 'lying' || rs.poseKey === 'rise' || rs.poseKey === 'bedSit') {
      if (prevStation !== 'bed') {
        clearBedPoseBlend();
        applyPose(rs.poseKey);
        sprite.material.opacity = 0;
      } else if (pose !== rs.poseKey) {
        startBedPoseBlend(pose, rs.poseKey);
      } else if (!bedPoseBlend) {
        setBlend(rs.poseKey === 'lying' ? 'lyingRest' : rs.poseKey, rs.poseKey === 'lying' ? rs.eyeCloseWeight : 0);
      }
    } else {
      clearBedPoseBlend();
      if (pose !== 'relax') applyPose('relax');
      if (currentConfig(pose).station !== prevStation) {
        sprite.material.opacity = 0;
      }
      setBlend('relax', 0);
    }
    if (action.riseFinished) {
      clearBedPoseBlend();
      applyPose('relax');
      setBlend('relax', 0);
      sprite.material.opacity = 1;
    }
  } else if (action.lieSample) {
    const prevStation = currentConfig(pose).station;
    sprite.material.opacity = action.lieSample.opacity;
    if (action.lieSample.poseKey === 'lying') {
      if (prevStation !== 'bed') {
        clearBedPoseBlend();
        if (pose !== 'lying') applyPose('lying');
        sprite.material.opacity = 0;
      } else if (pose !== 'lying') {
        startBedPoseBlend(pose, 'lying');
      } else if (!bedPoseBlend) {
        setBlend('lyingRest', action.lieSample.eyeCloseWeight);
      }
    } else if (action.lieSample.poseKey === 'bedSit') {
      if (prevStation !== 'bed') {
        clearBedPoseBlend();
        if (pose !== 'bedSit') applyPose('bedSit');
        sprite.material.opacity = 0;
        setBlend('bedSit', 0);
      } else if (pose !== 'bedSit') {
        startBedPoseBlend(pose, 'bedSit');
      } else if (!bedPoseBlend) {
        setBlend('bedSit', 0);
      }
    } else {
      // During fadeOut before bed swap, keep current chair pose & blend cleanly while fading out
      setBlend(pose, pose === 'rest' ? 1 : 0);
    }
  } else if (action.stretchSample) {
    const ss = action.stretchSample;
    sprite.material.opacity = ss.opacity;
    if (ss.poseKey === 'stretch') {
      if (pose !== 'stretch') applyPose('stretch');
      setBlend('stretch', 0);
    }
    if (action.stretchFinished) {
      const targetPose = sceneTransitions.getActiveRoom() === 'study' && preStretchStation === 'desk' ? 'back' : 'relax';
      applyPose(targetPose);
      setBlend(targetPose, 0);
      sprite.material.opacity = 1;
    }
  } else if (transition) {
    const f = transitionFrame((now - transition.start) / transition.duration, transition.transfer);
    const swappedThisFrame = Boolean(f.swap && !transition.swapped);
    if (swappedThisFrame) {
      transition.swapped = true;
      applyPose(transition.target);
      setBlend(transition.target, transition.target === 'rest' ? 1 : 0);
    }
    if (transition.transfer && swappedThisFrame) {
      sprite.material.opacity = 0;
    } else if (!transition.transfer && Number.isFinite(transition.startOpacity)) {
      sprite.material.opacity = transition.startOpacity + (1 - transition.startOpacity) * f.progress;
    } else {
      sprite.material.opacity = f.opacity;
    }
    if (!transition.transfer) {
      if (inChairStation) {
        setBlend('rest', transition.eyeStart + (Number(transition.target === 'rest') - transition.eyeStart) * f.blend);
      } else {
        setBlend(transition.target, f.blend);
      }
    }
    if (f.progress === 1 && !(transition.transfer && swappedThisFrame)) finishTransition();
  } else if (action.headWeight !== null) {
    sprite.material.opacity = 1;
    if (cfg.station === 'desk') {
      setBlend('turn', action.headWeight);
      if (action.headFinished) {
        applyPose('back');
        setBlend('back', 0);
      }
    } else {
      // In chair / bedroom reading chair: gentle blink/response without teleporting to desk
      setBlend('rest', Math.sin(action.headWeight * Math.PI) * 0.15);
      if (action.headFinished && pose === 'turn') {
        applyPose('relax');
        setBlend('relax', 0);
      }
    }
  } else if (action.eyeWeight !== null) {
    sprite.material.opacity = 1;
    setBlend('rest', action.eyeWeight);
    if (action.wakeFinished && pose === 'rest') {
      applyPose('relax');
      setBlend('relax', 0);
    }
  } else if (!paused && pose === 'relax') {
    sprite.material.opacity = 1;
    setBlend('rest', demoEnabled ? blinkFrame(motionTime - poseStarted) : blinkFrame((actionController.getState().blinkMs / 1000) * 1.5));
  } else if (action.focusGazeWeight !== null && cfg.station === 'desk') {
    sprite.material.opacity = 1;
    setBlend('turn', action.focusGazeWeight);
  } else {
    sprite.material.opacity = 1;
    setBlend(pose === 'lying' ? 'lyingRest' : pose, pose === 'rest' || pose === 'lying' ? 1 : 0);
  }

  if (
    !paused &&
    !demoEnabled &&
    pose === 'turn' &&
    !transition &&
    !sceneTransitions.isTransitioning() &&
    !actionController.isHeadTurning() &&
    motionTime - poseStarted > 3.2
  ) {
    setPose(sceneTransitions.getActiveRoom() === 'bedroom' ? 'relax' : 'back', { automatic: true });
  }

  const targetRest = pose === 'lying'
    ? (action.riseSample?.eyeCloseWeight ?? action.lieSample?.eyeCloseWeight ?? 1)
    : pose === 'rest' ? 1 : inChairStation ? blendUniforms.poseBlend.value : 0;
  restWeight += (targetRest - restWeight) * (1 - Math.exp(-dt / 0.45));
  const f = !paused ? motionFrame(motionTime, pose, restWeight) : { stretch: 1, rotation: 0 };
  const activeBlendMetrics = stepBedPoseBlend(realDtMs, paused);
  const stretch = (f.stretch + (action.stretchDelta || 0)) * (activeBlendMetrics?.stretch ?? 1);
  const rotation = f.rotation + (action.rotationDelta || 0);
  const activeCfg = currentConfig(pose);
  const scaleMult = activeBlendMetrics ? activeBlendMetrics.sizeScale : activeCfg.sizeScale || 1;
  const activeAspect = activeBlendMetrics ? activeBlendMetrics.aspect : activeCfg.aspect;
  if (activeBlendMetrics) {
    sprite.center.set(activeBlendMetrics.center[0], activeBlendMetrics.center[1]);
  }
  sprite.scale.set(settings.size * scaleMult * activeAspect, settings.size * scaleMult * stretch, 1);
  sprite.material.rotation = rotation;
  companionLayer.sync({
    room: sceneTransitions.getActiveRoom(),
    pose,
    settings,
    stretch,
    opacity: sprite.material.opacity
  });
  const activeRoomNow = sceneTransitions.getActiveRoom();
  const actStateNow = actionController.getState();
  if (!paused) completeRoomClick(actStateNow);
  const bedRestPhase =
    activeRoomNow !== 'bedroom' || sceneTransitions.isTransitioning()
      ? 'inactive'
      : actStateNow.rising
        ? actStateNow.risePhase
        : actStateNow.lying
          ? actStateNow.liePhase
          : pose === 'lying'
            ? 'sleep'
            : pose === 'bedSit' || pose === 'rise'
              ? 'bedSettle'
              : 'inactive';
  bedroomScene.syncBedContact({
    active: activeRoomNow === 'bedroom' && bedRestPhase !== 'inactive' && !sceneTransitions.isTransitioning(),
    phase: bedRestPhase,
    pose,
    opacity: sprite.material.opacity,
    blend: bedPoseBlend,
    breatheDelta: stretch - 1
  });
}

let cachedMask = null, maskTimer = 0;
const roomUI = installRoomUI({
  canvas,
  onMenuChange: (open) => {
    open ? activities.pause('menu') : activities.resume('menu');
    lastFrameTime = 0;
    redraw();
  },
  onMask: () => {
    if (roomUI?.native) {
      clearTimeout(maskTimer);
      maskTimer = setTimeout(sendMask, 60);
    }
  }
});

function sendMask() {
  if (!roomUI.native || !window.poseRoom.ready) return;
  const yardMask=townSurface.getNativeMask();if(yardMask){parent.postMessage({t:'room-mask',...yardMask},location.origin);return;}
  if (!cachedMask) {
    const w = canvas.width, h = canvas.height, surface = document.createElement('canvas');
    surface.width = w;
    surface.height = h;
    renderer.render(scene, camera);
    const context = surface.getContext('2d', { willReadFrequently: true });
    context.drawImage(canvas, 0, 0, w, h);
    const cutout = buildRoomCutout(context.getImageData(0, 0, w, h));
    context.putImageData(new ImageData(cutout.fringe, w, h), 0, 0);
    cachedMask = { width: w, height: h, runs: cutout.runs, edgePng: surface.toDataURL('image/png') };
  }
  const overlays = [
    ...document.querySelectorAll(
      '#context-menu:not([hidden]),#adjust-panel:not([hidden]),#furniture-feedback:not([hidden]),#room-focus-hint:not([hidden]),#room-game:not([hidden]),#room-town-surface:not([hidden])'
    )
  ]
    .flatMap((e) => {
      const parts = [...e.querySelectorAll('[data-room-surface]')];
      return parts.length ? parts : [e];
    })
    .map((e) => {
      const r = e.getBoundingClientRect();
      const sx = cachedMask.width / stage.clientWidth, sy = cachedMask.height / stage.clientHeight;
      const radius = Math.min(parseFloat(getComputedStyle(e).borderTopLeftRadius) || 0, r.width / 2, r.height / 2);
      return [r.left * sx, r.top * sy, r.right * sx, r.bottom * sx, radius * sx];
    });
  parent.postMessage({ t: 'room-mask', ...cachedMask, overlays }, location.origin);
}

window.addEventListener('message', (e) => {
  if (e.source !== parent || e.origin !== location.origin || e.data?.t !== 'room-visibility') return;
  externallyHidden = !!e.data.hidden;
  sceneTransitions.setHidden(externallyHidden || document.hidden);
  externallyHidden ? activities.pause('host') : activities.resume('host');
  clearTimeout(frameTimer);
  if (externallyHidden) {
    cancelAnimationFrame(rafId);
    queued = false;
    lastFrameTime = 0;
  } else {
    lastFrameTime = 0;
    redraw();
  }
});

function render(now) {
  queued = false;
  if (document.hidden || externallyHidden || townSurface.active()) return;
  animate(now);
  renderer.render(scene, camera);
  renderCount++;
  if (motionEnabled && !reducedMotion.matches && window.poseRoom.ready) {
    clearTimeout(frameTimer);
    frameTimer = setTimeout(redraw, 1000 / 30);
  }
}

function redraw() {
  if (!queued) {
    queued = true;
    rafId = requestAnimationFrame(render);
  }
}

function resize() {
  const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
  renderer.setSize(w, h, false);
  const span = Math.max(6.08, (7.8 * h) / w);
  camera.left = (-span * w) / h / 2;
  camera.right = (span * w) / h / 2;
  camera.top = span / 2;
  camera.bottom = -span / 2;
  camera.updateProjectionMatrix();
  cachedMask = null;
  setTimeout(sendMask, 100);
  redraw();
}

function update() {
  if (!sprite) return;
  const c = currentConfig(pose);
  const scaleMult = c.sizeScale || 1;
  sprite.position.set(c.base[0] + settings.x, c.base[1] + settings.y, c.base[2] + settings.z);
  sprite.center.set(...c.center);
  sprite.scale.set(settings.size * scaleMult * c.aspect, settings.size * scaleMult, 1);
  companionLayer.sync({
    room: sceneTransitions.getActiveRoom(),
    pose,
    settings,
    stretch: 1,
    opacity: sprite.material.opacity
  });
  redraw();
}

function applyPose(value) {
  if (!sprite) return;
  bedroomWalk = null;
  studyWalk = null;
  blendUniforms.returnPoseOffset.value.set(0, 0);
  blendUniforms.returnHandoff.value = 0;
  blendUniforms.seatFollowThrough.value.set(0, 0);
  blendUniforms.seatPoseInfluence.value.set(0, 0);
  const nextCfg = currentConfig(value);
  if (!nextCfg) return;
  const nextStation = nextCfg.station;
  if (placementStation !== nextStation && saved[nextStation]) {
    // The destination room may already be active when applyPose is called.
    // Save against the station that actually owns the current placement.
    Object.assign(saved[placementStation], settings);
    Object.assign(settings, saved[nextStation]);
    placementStation = nextStation;
    document.querySelectorAll('input').forEach((input) => {
      input.value = String(settings[input.name]);
    });
  }
  if (value !== pose) poseStarted = motionTime;
  pose = value;
  const mapKey =
    value === 'lying' || value === 'rise' || value === 'stretch' || value === 'bedSit'
      ? value
      : nextStation === 'chair' || nextStation === 'reading'
        ? 'relax'
        : value;
  sprite.material.map = textures[mapKey] || textures.relax;
  sprite.material.needsUpdate = true;
  document.querySelectorAll('[data-pose]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.pose === pose));
  });
  status.textContent = nextCfg.label;
  update();
}

function setPose(value, { immediate = false, automatic = false } = {}) {
  if (!sprite || !['back', 'turn', 'relax', 'rest'].includes(value)) return;
  if (!immediate && studyWalk?.target === 'desk' && value === 'back') return;
  if (!immediate && studyWalk?.target === 'chair' && value === 'relax') return;
  cancelBedroomWalk();
  cancelStudyWalk();
  if (!automatic) {
    demoEnabled = false;
    document.getElementById('demo').setAttribute('aria-pressed', 'false');
  }
  // If user selects desk poses ('back'/'turn') while in bedroom, stay in bedroom reading chair or handle gracefully
  const activeRoom = sceneTransitions.getActiveRoom();
  const nextCfg = currentConfig(value);
  clearBedPoseBlend();
  finishTransition();
  const oldCfg = currentConfig(pose);
  if (!immediate && window.poseRoom.ready && activeRoom === 'study' && !sceneTransitions.isTransitioning()) {
    if (value === 'relax' && oldCfg.station === 'desk' && canWalkInStudy('chair', bedroomWalkFrames)) {
      startStudyWalk();
      redraw();
      return;
    }
    if (value === 'back' && ['relax', 'rest'].includes(pose) && canWalkInStudy('desk', studyReturnFrames)) {
      startStudyReturn();
      redraw();
      return;
    }
  }
  if (!immediate && motionEnabled && !reducedMotion.matches && value === 'back' && actionController.isHeadTurning()) {
    actionController.returnHead();
    redraw();
    return;
  }
  actionController.selectPose();
  if (
    !immediate &&
    motionEnabled &&
    !reducedMotion.matches &&
    window.poseRoom.ready &&
    value === 'turn' &&
    oldCfg.station === 'desk' &&
    activeRoom === 'study' &&
    !automatic
  ) {
    startHead();
    return;
  }
  if (immediate || !motionEnabled || reducedMotion.matches || !window.poseRoom.ready || value === pose) {
    applyPose(value);
    setBlend(value, value === 'rest' ? 1 : 0);
    return;
  }
  const sameStation = nextCfg.station === oldCfg.station;
  transition = {
    target: value,
    start: performance.now(),
    duration: sameStation ? (oldCfg.station !== 'desk' ? (value === 'rest' ? 180 : 300) : 440) : 800,
    transfer: !sameStation,
    swapped: false,
    eyeStart: blendUniforms.poseBlend.value
  };
  if (oldCfg.station === 'desk') setBlend(value, 0);
  redraw();
}

document.querySelectorAll('[data-pose]').forEach((b) => b.addEventListener('click', () => setPose(b.dataset.pose)));

function setSoftLight(value) {
  lighting.setSoft(value);
  companionLayer.setSoftLight(value, {
    study: lighting.getState().lampPosition,
    bedroom: bedroomScene.getPoint('lamp')
  });
  bedroomScene.setSoftLight(lighting.getState().soft);
  document.getElementById('soft-light').setAttribute('aria-pressed', String(lighting.getState().soft));
  cachedMask = null;
  redraw();
  requestAnimationFrame(sendMask);
}

function setCompanionHints(value) {
  activities.setCompanionHints(value);
  document.getElementById('companion-hints').setAttribute('aria-pressed', String(activities.companionHints()));
}

document.getElementById('soft-light').addEventListener('click', () => setSoftLight(!lighting.getState().soft));
document.getElementById('companion-hints').addEventListener('click', () => setCompanionHints(!activities.companionHints()));

document.getElementById('zoom').addEventListener('click', () => {
  zoomed = !zoomed;
  camera.zoom = zoomed ? 1.55 : 1;
  camera.updateProjectionMatrix();
  document.getElementById('zoom').setAttribute('aria-pressed', String(zoomed));
  cachedMask = null;
  setTimeout(sendMask, 100);
  redraw();
});

document.getElementById('reset').addEventListener('click', () => {
  for (const c of Object.values(saved)) Object.assign(c, { x: 0, y: 0, z: 0, size: 1.7 });
  Object.assign(settings, { x: 0, y: 0, z: 0, size: 1.7 });
  zoomed = false;
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  document.getElementById('zoom').setAttribute('aria-pressed', 'false');
  cachedMask = null;
  setTimeout(sendMask, 100);
  document.querySelectorAll('input').forEach((input) => {
    input.value = String(settings[input.name]);
  });
  update();
  setPose(sceneTransitions.getActiveRoom() === 'bedroom' ? 'relax' : 'back', { immediate: true });
});

document.querySelectorAll('input').forEach((input) =>
  input.addEventListener('input', () => {
    settings[input.name] = Number(input.value);
    update();
  })
);

const alphaSheets = {};
const feedback = document.createElement('div');
feedback.id = 'furniture-feedback';
feedback.hidden = true;
feedback.setAttribute('role', 'status');
stage.append(feedback);
let feedbackTimer = 0, lastFurniture = null, roomActionNotice = null;

function hideFeedback() {
  clearTimeout(feedbackTimer);
  if (!feedback.hidden) {
    feedback.hidden = true;
    sendMask();
  }
}

function showFeedback(text, kind = '') {
  clearTimeout(feedbackTimer);
  feedback.textContent = text;
  feedback.dataset.kind = kind;
  feedback.hidden = false;
  sendMask();
  feedbackTimer = setTimeout(hideFeedback, 2600);
}

function completeRoomClick(actionState) {
  if (!roomActionNotice) return;
  const {room, action, done} = roomActionNotice;
  if (sceneTransitions.getActiveRoom() !== room) {
    roomActionNotice = null;
    return;
  }
  if (transition || sceneTransitions.isTransitioning() || bedroomWalk || studyWalk ||
      actionState.rising || actionState.waking || bedPoseBlend) return;
  const station = currentConfig(pose).station;
  const reached = action === 'lieDown' ? pose === 'lying' && (!actionState.lying || actionState.liePhase === 'sleep')
    : action === 'focus' ? station === 'desk'
    : station === (room === 'study' ? 'chair' : 'reading') && !actionState.lying;
  if (!reached) return;
  roomActionNotice = null;
  showFeedback(done, 'complete');
}

function startRoomClick(action, start, done) {
  companionAction(action, {start, done});
}

document.addEventListener('contextmenu', hideFeedback);
document.getElementById('adjust-toggle').addEventListener('click', hideFeedback);

const focusHint = document.createElement('p');
focusHint.id = 'room-focus-hint';
focusHint.hidden = true;
focusHint.style.cssText =
  'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:4;background:#fff9ef;color:#51475c;padding:8px 14px;border-radius:14px;font:12px sans-serif;pointer-events:none';
document.body.append(focusHint);
let lifeFocusKind = 'unknown';

const workstation = createRoomWorkstation({
  onStatus: (data) => {
    const focus = data?.focus;
    lifeFocusKind = focus?.kind || 'unknown';
    focusHint.hidden = !focus || !['running', 'paused'].includes(focus.kind) || !Number.isInteger(focus.remaining);
    if (!focusHint.hidden) {
      focusHint.textContent =
        (focus.kind === 'running' ? '小镇专注中 · ' : '小镇专注已暂停 · ') +
        Math.floor(focus.remaining / 60) +
        ':' +
        String(focus.remaining % 60).padStart(2, '0');
    }
    requestAnimationFrame(sendMask);
  }
});

let townPausedAt = null;
const townSurface = createTownSurface({
  workstation,native:roomUI.native,onCommand:action=>roomUI.send(action),
  onChange: () => requestAnimationFrame(sendMask),
  onOpen: () => {
    townPausedAt = performance.now();
    hideFeedback();
    activities.pause('town');
    clearTimeout(frameTimer);
    cancelAnimationFrame(rafId);
    queued = false;
  },
  onClose: () => {
    if (transition && townPausedAt !== null) transition.start += performance.now() - townPausedAt;
    townPausedAt = null;
    lastFrameTime = 0;
    activities.resume('town');
    redraw();
  }
});

document.getElementById('room-outdoor').onclick = () => townSurface.open('outdoor');
document.getElementById('room-alarm').onclick = () => townSurface.open('alarm');
document.getElementById('room-pat').onclick = () => parent.postMessage({ t: 'room-command', action: 'pat' }, location.origin);

const activities = createRoomActivities({
  onSurfaceChanged: () => requestAnimationFrame(sendMask),
  onOpen: () => {
    hideFeedback();
    setDemo(false);
    lastFrameTime = 0;
  },
  onClose: (result) => {
    lastFrameTime = 0;
    if (!result) {
      redraw();
      return;
    }
    showFeedback(result.gameId === 'memory' ? '配对完成啦，休息一下吧。' : `这一局 ${result.score} 分，下次一起再玩。`);
    if (motionEnabled && !reducedMotion.matches && currentConfig(pose).station === 'desk') startHead();
    else if (actionController.isNapping()) companionAction('wake');
    redraw();
  },
  onWork: () => setPose('back'),
  onNavigate: (page) =>
    page === 'town'
      ? Promise.resolve(townSurface.open('alarm'))
      : workstation
          .open(page)
          .then(() => showFeedback(page === 'town' ? '在闹钟里开始或继续专注。' : '已打开书房与放松。'))
          .catch((e) => showFeedback(e.message))
});

const autoLife = createRoomAutoLife({
  surface: townSurface,
  roomState: () => ({ ready: !!window.poseRoom?.ready, pose, night: false }),
  setPose,
  setDemo,
  isBusy: () =>
    bedroomWalk !== null ||
    studyWalk !== null ||
    activities.active() ||
    sceneTransitions.isTransitioning() ||
    !document.getElementById('context-menu').hidden ||
    !document.getElementById('adjust-panel').hidden ||
    ['running', 'paused'].includes(lifeFocusKind),
  onMask: () => requestAnimationFrame(sendMask)
});

window.addEventListener(
  'pagehide',
  () => {
    sceneTransitions.dispose();
    actionController.cancelAll();
    autoLife.dispose();
    townSurface.dispose();
    activities.dispose();
    lighting.dispose();
    studyLayers?.dispose();
    bedroomScene.dispose();
    companionLayer.dispose();
    for (const frame of bedroomWalkFrames) frame.texture.dispose();
    window.microRoomDetails?.dispose();
    workstation.dispose();
  },
  { once: true }
);

const raycaster = new THREE.Raycaster();

function sceneHit(e) {
  const r = canvas.getBoundingClientRect();
  raycaster.setFromCamera(
    new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2),
    camera
  );
  const activeRoom = sceneTransitions.getActiveRoom();
  const targets =
    activeRoom === 'bedroom'
      ? [sprite, bedroomScene.root].filter(Boolean)
      : [sprite, studyLayers?.root, model, handheld, phone, alarm, exitMat].filter(Boolean);
  return visibleSceneHits(raycaster.intersectObjects(targets, true));
}

function actorPixel(hit) {
  const station = currentConfig(pose).station;
  const sheetKey = pose === 'lying' || pose === 'rise' || pose === 'stretch' ? pose : station;
  const sheet = alphaSheets[sheetKey] || alphaSheets[station] || alphaSheets.chair;
  if (!sheet || !hit.uv) return false;
  const { pixels, width, height } = sheet;
  const uv = hit.uv.clone();
  sprite.material.map.transformUv(uv);
  const bounds = blendUniforms.poseFrameBounds.value;
  if (uv.x < bounds.x || uv.x > bounds.y) return false;
  const x = Math.min(width - 1, Math.max(0, Math.floor(uv.x * width)));
  const y = Math.min(height - 1, Math.max(0, Math.floor(uv.y * height)));
  return pixels[(y * width + x) * 4 + 3] > 30;
}

function pickScene(e) {
  if (!sprite) return null;
  const activeRoom = sceneTransitions.getActiveRoom();
  for (const hit of sceneHit(e)) {
    if (hit.object === companionLayer.shadowMesh) continue;
    if (hit.object.userData.activity === 'stairs' || hit.object.userData.bedroomSpot === 'stairs') {
      return { kind: 'stairs' };
    }
    if (['alarm', 'outdoor'].includes(hit.object.userData.activity)) {
      return { kind: hit.object.userData.activity };
    }
    if (hit.object.userData.roomLamp || hit.object.userData.bedroomSpot === 'lamp') {
      return { kind: 'lamp' };
    }
    if (hit.object.userData.activity === 'phone') return { kind: 'phone' };
    if (hit.object.userData.activity === 'snake') return { kind: 'handheld' };
    if (hit.object === sprite) {
      if (!bedroomWalk && !studyWalk && actorPixel(hit)) return { kind: 'actor' };
      continue;
    }
    if (activeRoom === 'bedroom') {
      if (hit.object.userData.bedroomSpot) {
        return { kind: hit.object.userData.bedroomSpot };
      }
      continue;
    }
    if (hit.object.userData.roomSpot === 'desk' && currentConfig().station === 'chair') return { kind: 'desk' };
    const kind = furnitureForHit(hit);
    if (kind) return { kind };
  }
  return null;
}

canvas.addEventListener('click', (e) => {
  if (!sprite || e.button !== 0 || townSurface.active() || activities.active() || !roomUI.allowSceneClick()) return;
  const hit = pickScene(e);
  if (!hit?.kind) return;

  if (hit.kind === 'lamp') {
    lastFurniture = 'lamp';
    setSoftLight(!lighting.getState().soft);
    showFeedback(lighting.getState().soft ? '暖光已开启。' : '暖光已关闭。');
    return;
  }

  if (hit.kind === 'stairs') {
    lastFurniture = 'stairs';
    const nextRoom = sceneTransitions.getActiveRoom() === 'study' ? 'bedroom' : 'study';
    if (sceneTransitions.isTransitioning()) return;
    roomActionNotice = null;
    sceneTransitions.openRoom(nextRoom);
    showFeedback(nextRoom === 'bedroom' ? '上二楼去卧室休息一会儿。' : '顺着楼梯回一楼书房。');
    return;
  }

  if (transition || sceneTransitions.isTransitioning()) return;

  if (hit.kind === 'actor') {
    lastFurniture = 'actor';
    const cfg = currentConfig(pose);
    if (sceneTransitions.getActiveRoom() === 'bedroom' && (cfg.station === 'bed' || actionController.isLying())) {
      startRoomClick('rise', '正在起身…', '已经回到阅读椅。');
      return;
    }
    if ((cfg.station === 'chair' || cfg.station === 'reading') && (actionController.isNapping() || pose === 'rest')) {
      startRoomClick('wake', '正在醒来…', '醒来啦。');
      return;
    }
    if (sceneTransitions.getActiveRoom() === 'bedroom') {
      companionAction(actionController.isHeadTurning() ? 'relax' : 'lookBack');
      return;
    }
    if (cfg.station === 'desk') {
      startRoomClick('relax', '回头看看，再去扶手椅…', '已经在扶手椅坐好。');
      return;
    }
    setPose(cfg.next);
    return;
  }

  lastFurniture = hit.kind;
  if (hit.kind === 'desk') {
    startRoomClick('focus', '正往书桌走…', '已经回到书桌，继续工作。');
    return;
  }
  if (hit.kind === 'alarm' || hit.kind === 'outdoor') {
    townSurface.open(hit.kind);
    return;
  }

  if (hit.kind === 'reading') {
    startRoomClick('relax', '正去窗边阅读椅…', '已经在窗边坐好。');
    return;
  }

  if (hit.kind === 'bed') {
    const cfg = currentConfig(pose);
    if (cfg.station === 'bed' || actionController.isLying()) {
      if (actionController.isRising()) return;
      startRoomClick('rise', '正在起身…', '已经回到阅读椅。');
    } else if (actionController.isNapping() || pose === 'rest') {
      startRoomClick('wake', '正在醒来…', '醒来啦。');
    } else {
      startRoomClick('lieDown', '正往床边走…', '已经躺好，休息一会儿。');
    }
    return;
  }

  actionController.selectPose();
  if (hit.kind === 'bookshelf') {
    workstation
      .open('reading')
      .then(() => showFeedback('已打开书房，取一本书吧。'))
      .catch((err) => showFeedback(err.message));
    return;
  }
  if (hit.kind === 'phone') activities.open('memory', { device: 'phone' });
  else if (hit.kind === 'handheld') activities.open('snake');
  else if (hit.kind === 'chair') startRoomClick('relax', '正往扶手椅走…', '已经在扶手椅坐好。');
  else if (hit.kind === 'computer') activities.open('computer');
  else if (hit.kind === 'table') activities.open();
});

const HOVER_TITLES = {
  alarm: '书桌闹钟 · 点击专注',
  outdoor: '门口 · 出门到小镇',
  bookshelf: '书架 · 点击取一本书',
  lamp: '暖光灯 · 点击开关暖光',
  phone: '桌边手机 · 点击玩翻翻乐',
  handheld: '红蓝掌机 · 点击玩贪吃蛇',
  actor: '点击角色互动',
  chair: '扶手椅 · 点击放松',
  desk: '书桌 · 点击回去工作',
  reading: '阅读椅 · 点击放松阅读',
  bed: '卧室床铺 · 点击小憩或唤醒',
  stairs: '楼梯 · 点击切换书房与卧室',
  computer: '电脑 · 点击选择活动',
  table: '茶几 · 点击玩翻翻乐'
};

canvas.addEventListener('pointermove', (e) => {
  if (e.buttons) return;
  const kind = pickScene(e)?.kind;
  canvas.style.cursor = kind ? 'pointer' : 'default';
  canvas.title = HOVER_TITLES[kind] || '';
});

function worldPoint(x, y, z) {
  const p = new THREE.Vector3(x, y, z).project(camera);
  const r = canvas.getBoundingClientRect();
  return { x: r.left + ((p.x + 1) * r.width) / 2, y: r.top + ((1 - p.y) * r.height) / 2 };
}

function artworkPoint(u, v) {
  if (!sprite) return null;
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const point = sprite.position
    .clone()
    .addScaledVector(right, (u - sprite.center.x) * sprite.scale.x)
    .addScaledVector(up, (1 - v - sprite.center.y) * sprite.scale.y)
    .project(camera);
  const r = canvas.getBoundingClientRect();
  return { x: r.left + ((point.x + 1) * r.width) / 2, y: r.top + ((1 - point.y) * r.height) / 2 };
}

function roomPoint(target) {
  if (!sprite) return null;
  const activeRoom = sceneTransitions.getActiveRoom();
  if (target === 'companion') {
    const pt = artworkPoint(0.5, 0.48);
    return pt ? { ...pt, room: activeRoom, target: 'companion' } : null;
  }
  if (target === 'stairs') {
    const coords = activeRoom === 'bedroom' ? BEDROOM_POINTS.stairs : STUDY_STAIRS_POINT;
    return { ...worldPoint(...coords), room: activeRoom, target: 'stairs' };
  }
  if (target === 'reading') {
    const coords = activeRoom === 'bedroom' ? BEDROOM_POINTS.reading : [1.14, 0.66, 1.12];
    return { ...worldPoint(...coords), room: activeRoom, target: 'reading' };
  }
  if (target === 'bed') {
    if (activeRoom !== 'bedroom') return null;
    return { ...worldPoint(...BEDROOM_POINTS.bed), room: activeRoom, target: 'bed' };
  }
  return null;
}

function companionAction(actionName, notice = null) {
  if (!sprite || !AVAILABLE_COMPANION_ACTIONS.includes(actionName)) {
    return getRoomStateSnapshot();
  }
  if (sceneTransitions.isTransitioning()) {
    return getRoomStateSnapshot();
  }
  syncReducedMotion();
  if (bedroomWalk) {
    if (actionName === 'lieDown') return getRoomStateSnapshot();
    cancelBedroomWalk();
  }
  if (studyWalk) {
    const actionInProgress = studyWalk.target === 'desk' ? 'focus' : 'relax';
    if (actionName === actionInProgress) return getRoomStateSnapshot();
    cancelStudyWalk();
  }

  demoEnabled = false;
  document.getElementById('demo')?.setAttribute('aria-pressed', 'false');
  clearBedPoseBlend();
  finishTransition();

  const activeRoom = sceneTransitions.getActiveRoom();
  const cfg = currentConfig(pose);
  roomActionNotice = notice ? {room: activeRoom, action: actionName, done: notice.done} : null;

  function recoverOrLeaveBed(targetPose, afterReady = null) {
    if (cfg.station === 'bed') {
      actionController.cancelAll();
      if (!motionEnabled || reducedMotion.matches) {
        applyPose(targetPose);
        setBlend(targetPose, 0);
        sprite.material.opacity = 1;
        if (afterReady) afterReady();
      } else {
        transition = {
          target: targetPose,
          start: performance.now(),
          duration: 360,
          transfer: true,
          swapped: false,
          eyeStart: 0,
          onComplete: afterReady
        };
      }
      return true;
    }
    if (sprite.material.opacity < 0.99 && motionEnabled && !reducedMotion.matches) {
      const startOpacity = sprite.material.opacity;
      applyPose(targetPose);
      setBlend(targetPose, 0);
      transition = {
        target: targetPose,
        start: performance.now(),
        duration: 180,
        transfer: false,
        swapped: true,
        eyeStart: 0,
        startOpacity,
        onComplete: afterReady
      };
      return true;
    }
    sprite.material.opacity = 1;
    return false;
  }

  if (actionName === 'idle') {
    const targetPose = activeRoom === 'bedroom' ? 'relax' : cfg.station === 'desk' ? 'back' : 'relax';
    actionController.startIdle();
    if (!recoverOrLeaveBed(targetPose)) {
      applyPose(targetPose);
      setBlend(targetPose, 0);
    }
  } else if (actionName === 'lookBack') {
    if (!recoverOrLeaveBed('relax', () => startHead())) {
      startHead();
    }
  } else if (actionName === 'focus') {
    const targetPose = activeRoom === 'study' ? 'back' : 'relax';
    if (activeRoom === 'study' && ['rest', 'relax'].includes(pose) && canWalkInStudy('desk', studyReturnFrames)) {
      startStudyReturn();
    } else {
      actionController.cancelAll();
      if (!recoverOrLeaveBed(targetPose, () => actionController.startFocus(3000))) {
        applyPose(targetPose);
        setBlend(targetPose, 0);
        actionController.startFocus(3000);
      }
    }
  } else if (actionName === 'relax') {
    const useStudyWalk = activeRoom === 'study' && cfg.station === 'desk' &&
      canWalkInStudy('chair', bedroomWalkFrames);
    if (useStudyWalk) {
      startStudyWalk();
    } else {
      actionController.startRelax();
      if (!recoverOrLeaveBed('relax')) {
        if (activeRoom === 'study' && cfg.station === 'desk' && motionEnabled && !reducedMotion.matches) {
          setPose('relax');
        } else {
          applyPose('relax');
          setBlend('relax', 0);
        }
      }
    }
  } else if (actionName === 'doze') {
    actionController.cancelAll();
    if (!recoverOrLeaveBed('relax', () => {
      applyPose('relax');
      setBlend('rest', 0);
      actionController.startDoze();
    })) {
      applyPose('relax');
      setBlend('rest', 0);
      actionController.startDoze();
    }
  } else if (actionName === 'wake') {
    if (activeRoom === 'study' && cfg.station === 'desk' && !actionController.isNapping()) {
      // Already awake at study desk: keep desk station & pose as a safe no-op (while cancelling any head/focus/stretch)
      actionController.wake(0);
      if (pose !== 'back' && pose !== 'turn') {
        applyPose('back');
      }
      setBlend(pose, 0);
      sprite.material.opacity = 1;
    } else if (cfg.station === 'bed') {
      actionController.cancelAll();
      if (!recoverOrLeaveBed('relax', () => actionController.wake(0))) {
        applyPose('relax');
        setBlend('rest', 0);
        actionController.wake(0);
      }
    } else {
      const currentEye =
        pose === 'rest'
          ? 1
          : actionController.isNapping()
            ? actionController.currentEyeCloseWeight(pose)
            : cfg.station !== 'desk' && Number.isFinite(blendUniforms.poseBlend.value)
              ? blendUniforms.poseBlend.value
              : 0;
      // Stay in the current room's seat (chair in study, reading chair in bedroom), never jump to study desk
      actionController.wake(currentEye);
      if (!recoverOrLeaveBed('relax', () => {
        applyPose('relax');
        setBlend('rest', currentEye);
      })) {
        applyPose('relax');
        setBlend('rest', currentEye);
      }
    }
  } else if (actionName === 'lieDown') {
    if (activeRoom !== 'bedroom') {
      // Safely ignore lieDown in study without secretly teleporting across rooms
      return getRoomStateSnapshot();
    }
    const alreadyOnBed = pose === 'lying' && sprite.material.opacity >= 0.99;
    if (!motionEnabled || reducedMotion.matches) {
      actionController.cancelAll();
      applyPose('lying');
      setBlend('lyingRest', 1);
      sprite.material.opacity = 1;
    } else if (cfg.station === 'reading' && bedroomWalkFrames.length === 4 &&
      Math.abs(settings.x) < .12 && Math.abs(settings.z) < .12 && Math.abs(settings.y) < .12) {
      actionController.cancelAll();
      applyPose('relax');
      bedroomWalk = { elapsed: 0, anchor: sprite.position.toArray(), size: settings.size };
      status.textContent = '走到床边';
    } else {
      // Only skip fadeOut when already settled in lying pose at full opacity;
      // from reading chair or mid-rise (pose === 'rise'), fade out from current opacity and swap at opacity === 0.
      actionController.startLieDown(1750, alreadyOnBed, sprite.material.opacity);
    }
  } else if (actionName === 'rise') {
    if (activeRoom === 'study' && cfg.station === 'desk' && !actionController.isNapping()) {
      // Safe no-op when already awake at study desk
      return getRoomStateSnapshot();
    }
    if (activeRoom === 'bedroom' && cfg.station !== 'bed' && actionController.isLying()) {
      // Pending lieDown (< 240ms) interrupted before reaching the bed: cancel back to reading chair smoothly, NEVER jump to bed!
      actionController.cancelAll();
      if (!recoverOrLeaveBed('relax')) {
        applyPose('relax');
        setBlend('relax', 0);
        sprite.material.opacity = 1;
      }
    } else if (activeRoom === 'bedroom' && cfg.station === 'bed') {
      const currentEye = actionController.getState().lieEyeWeight ?? blendUniforms.poseBlend.value ?? 1;
      if (!motionEnabled || reducedMotion.matches) {
        actionController.cancelAll();
        applyPose('relax');
        setBlend('relax', 0);
        sprite.material.opacity = 1;
      } else {
        actionController.startRise(currentEye, 1780);
        setBlend('lyingRest', currentEye);
      }
    } else {
      return companionAction('wake');
    }
  } else if (actionName === 'stretch') {
    // Only stretch in chair or reading chair; safely ignore at study desk or while lying on bed (no teleporting!)
    if ((cfg.station !== 'chair' && cfg.station !== 'reading') || actionController.isLying() || actionController.isRising()) {
      return getRoomStateSnapshot();
    }
    preStretchStation = cfg.station;
    if (!motionEnabled || reducedMotion.matches) {
      return getRoomStateSnapshot();
    }
    applyPose('stretch');
    setBlend('stretch', 0);
    actionController.startStretch(1500);
  }

  if (notice) {
    completeRoomClick(actionController.getState());
    if (roomActionNotice) showFeedback(notice.start, 'pending');
  }
  redraw();
  return getRoomStateSnapshot();
}

function getRoomStateSnapshot() {
  const activeRoom = sceneTransitions.getActiveRoom();
  const cfg = currentConfig(pose);
  const actionState = actionController.getState();
  const bedRestPhase =
    activeRoom !== 'bedroom' || sceneTransitions.isTransitioning()
      ? 'inactive'
      : actionState.rising
        ? actionState.risePhase
        : actionState.lying
          ? actionState.liePhase
          : pose === 'lying'
            ? 'sleep'
            : pose === 'bedSit' || pose === 'rise'
              ? 'bedSettle'
              : 'inactive';
  return {
    activeRoom,
    transitioning: Boolean(transition) || sceneTransitions.isTransitioning(),
    roomTransition: sceneTransitions.getState(),
    action: bedroomWalk ? 'lieDown' : studyWalk ? (studyWalk.target === 'desk' ? 'focus' : 'relax') : actionController.getActiveActionName(pose),
    walkingToBed: bedroomWalk !== null,
    walkElapsed: bedroomWalk?.elapsed ?? null,
    studyMovePhase: studyWalk?.phase ?? null,
    studyMoveElapsed: studyWalk?.elapsed ?? null,
    studyMoveTarget: studyWalk?.target ?? null,
    actionState,
    pose,
    station: cfg.station,
    bedRest: {
      active: activeRoom === 'bedroom' && bedRestPhase !== 'inactive',
      phase: bedRestPhase,
      pose,
      blending: Boolean(bedPoseBlend),
      blendFrom: bedPoseBlend ? bedPoseBlend.fromPose : null,
      blendTo: bedPoseBlend ? bedPoseBlend.toPose : null,
      blendWeight: bedPoseBlend ? Number(bedPoseBlend.weight.toFixed(4)) : null,
      anchor: [...cfg.base],
      contact: bedroomScene.getBedContactState()
    },
    paused: isPausedState(),
    reducedMotion: reducedMotion.matches,
    motionEnabled,
    visibleCompanions: companionLayer.countVisibleCompanions(),
    renderCount,
    frameCount: renderCount,
    availableActions: [...AVAILABLE_COMPANION_ACTIONS],
    availableRooms: ['study', 'bedroom'],
    layers: {
      study: studyLayers ? studyLayers.getSummary() : null,
      bedroom: bedroomScene.getSummary(),
      companionShadow: companionLayer.getShadowState()
    },
    resources: {
      geometries: renderer.info?.memory?.geometries ?? 0,
      textures: renderer.info?.memory?.textures ?? 0
    },
    assetErrors: [...assetLoadErrors]
  };
}

function openRoom(targetRoom, options = {}) {
  if (!isValidRoom(targetRoom)) {
    return Promise.resolve(getRoomStateSnapshot());
  }
  return sceneTransitions.openRoom(targetRoom, options);
}

window.poseRoom = {
  ready: false,
  openRoom,
  roomState: getRoomStateSnapshot,
  roomPoint,
  companionAction,
  townView: () => townSurface.getView(),
  spatialState: () => townSurface.getState(),
  openTown: (view) => townSurface.open(view),
  alarmPoint: () => (alarm && sceneTransitions.getActiveRoom() === 'study' ? worldPoint(alarm.position.x, alarm.position.y, alarm.position.z) : null),
  exitPoint: () => (exitMat && sceneTransitions.getActiveRoom() === 'study' ? worldPoint(...exitMat.position.toArray()) : null),
  bookshelfPoint: () =>
    sceneTransitions.getActiveRoom() === 'bedroom'
      ? worldPoint(...BEDROOM_POINTS.bookshelf)
      : worldPoint(1.55, 1.05, -0.6),
  lampPoint: () => {
    if (sceneTransitions.getActiveRoom() === 'bedroom') {
      return worldPoint(...BEDROOM_POINTS.lamp);
    }
    const p = lighting.getState().lampPosition;
    return p ? worldPoint(...p) : null;
  },
  setSoftLight,
  setCompanionHints,
  phonePoint: () => {
    if (!phone || sceneTransitions.getActiveRoom() !== 'study') return null;
    const p = phone.localToWorld(new THREE.Vector3(0, 0.17, 0.017));
    return worldPoint(p.x, p.y, p.z);
  },
  handheldPoint: () =>
    sceneTransitions.getActiveRoom() === 'study'
      ? worldPoint(...handheldAnchor.map((v, i) => (i === 1 ? v + 0.04 : v)))
      : null,
  setPose,
  setMotion,
  setDemo,
  artworkPoint,
  worldPoint,
  tablePoint:()=>worldPoint(STUDY_LAYOUT.sideTable.center[0]-.08,STUDY_LAYOUT.sideTable.tabletopY+.004,STUDY_LAYOUT.sideTable.center[2]+.12),
  gameState: () => activities.getState(),
  getStatus: () => ({
    activeRoom: sceneTransitions.getActiveRoom(),
    microDetails: window.microRoomDetails?.getState(),
    bedroomDetails: bedroomScene.getSummary(),
    autoLife: autoLife.state(),
    ready: window.poseRoom.ready,
    lighting: lighting.getState(),
    companionHints: activities.companionHints(),
    phone: phone
      ? {
          anchor: phone.position.toArray(),
          depthTest: phone.children.every((o) => o.material.depthTest),
          meshCount: phone.children.length
        }
      : null,
    handheld: {
      anchor: [...handheldAnchor],
      depthTest: handheld.children.every((o) => o.material.depthTest),
      meshCount: handheld.children.length
    },
    actions: actionController.getState(),
    lastFurniture,
    pose,
    station: currentConfig(pose).station,
    aspect: currentConfig(pose).aspect,
    demoEnabled,
    demoTime,
    eyeOnly: blendUniforms.eyeOnly.value,
    motionEnabled,
    motionTime,
    transition: transition ? { target: transition.target, transfer: transition.transfer } : null,
    roomTransition: sceneTransitions.getState(),
    opacity: sprite?.material.opacity,
    blend: blendUniforms.poseBlend.value,
    scale: sprite?.scale.toArray(),
    rotation: sprite?.material.rotation,
    renderCount,
    spriteId: sprite?.uuid,
    spriteCount: companionLayer.countVisibleCompanions(),
    position: sprite?.position.toArray(),
    size: settings.size,
    texture: sprite?.material.map.uuid,
    depthTest: sprite?.material.depthTest,
    settings: { ...settings }
  })
};

new ResizeObserver(resize).observe(stage);
document.addEventListener('visibilitychange', () => {
  sceneTransitions.setHidden(document.hidden || externallyHidden);
  clearTimeout(frameTimer);
  if (document.hidden) {
    cancelAnimationFrame(rafId);
    queued = false;
    lastFrameTime = 0;
  } else {
    lastFrameTime = 0;
    redraw();
  }
});

(async () => {
  try {
    const loaded = await new GLTFLoader().loadAsync(window.poseAssets.room);
    model = loaded.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.set(center.x, -bounds.min.y, -center.z);
    model.scale.x = -1;
    scene.add(model);

    window.microRoomDetails = createMicroRoomDetails(model);
    studyLayers = createStudyStairsAndLayers(model, scene);
    lighting.bindModel(model);
    phone = createRoomPhone(model);
    scene.add(phone);
    alarm = createRoomAlarm(model);
    scene.add(alarm);
    exitMat = createRoomExit(model);
    scene.add(exitMat);

    const maps = await Promise.all(
      [window.poseAssets.actor, window.poseAssets.armchair].map((url) => new THREE.TextureLoader().loadAsync(url))
    );
    for (const [i, station] of ['desk', 'chair'].entries()) {
      const map = maps[i];
      map.colorSpace = THREE.SRGBColorSpace;
      const c = document.createElement('canvas');
      c.width = map.image.width;
      c.height = map.image.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(map.image, 0, 0);
      alphaSheets[station] = {
        width: c.width,
        height: c.height,
        pixels: ctx.getImageData(0, 0, c.width, c.height).data
      };
    }
    alphaSheets.reading = alphaSheets.chair;

    textures = {
      back: maps[0].clone(),
      turn: maps[0].clone(),
      relax: maps[1].clone(),
      rest: maps[1].clone()
    };
    for (const [name, t] of Object.entries(textures)) {
      t.repeat.set(0.5, 1);
      t.offset.set(name === 'back' ? 20 / 1774 : ['turn', 'rest'].includes(name) ? 0.5 : 0, 0);
      if (name === 'rest') t.offset.x -= 36 / 1254;
      t.needsUpdate = true;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
    }

    // Load dedicated bed lying, rising, and stretch pose assets (inlined as room-*.png by build-room.mjs)
    const extraPoseAssets = [
      ['lying', 'room-lying.png', true],
      ['rise', 'room-rise.png', false],
      ['stretch', 'room-stretch.png', false],
      ['bedSit', 'room-bed-sit.png', false]
    ];
    for (const [key, assetKey, isTwoFrame] of extraPoseAssets) {
      const url = window.poseAssets?.[assetKey];
      if (!url) continue;
      try {
        const extraMap = await new THREE.TextureLoader().loadAsync(url);
        extraMap.colorSpace = THREE.SRGBColorSpace;
        const ec = document.createElement('canvas');
        ec.width = extraMap.image.width;
        ec.height = extraMap.image.height;
        const ectx = ec.getContext('2d');
        ectx.drawImage(extraMap.image, 0, 0);
        alphaSheets[key] = {
          width: ec.width,
          height: ec.height,
          pixels: ectx.getImageData(0, 0, ec.width, ec.height).data
        };
        if (isTwoFrame) {
          const tOpen = extraMap.clone();
          const tClosed = extraMap.clone();
          tOpen.repeat.set(0.5, 1);
          tOpen.offset.set(0, 0);
          tClosed.repeat.set(0.5, 1);
          tClosed.offset.set(0.5, 0);
          for (const t of [tOpen, tClosed]) {
            t.needsUpdate = true;
            t.generateMipmaps = true;
            t.minFilter = THREE.LinearMipmapLinearFilter;
            t.magFilter = THREE.LinearFilter;
          }
          textures.lying = tOpen;
          textures.lyingRest = tClosed;
        } else {
          extraMap.repeat.set(1, 1);
          extraMap.offset.set(0, 0);
          extraMap.needsUpdate = true;
          extraMap.generateMipmaps = true;
          extraMap.minFilter = THREE.LinearMipmapLinearFilter;
          extraMap.magFilter = THREE.LinearFilter;
          textures[key] = extraMap;
        }
      } catch (err) {
        const safeErr = err instanceof Error ? err.message.replace(/[A-Za-z]:[\\/][^\s]+/g, '<path>') : `${assetKey}_load_failed`;
        assetLoadErrors.push(`${assetKey}:${safeErr}`);
      }
    }

    try {
      bedroomWalkFrames = await loadBedroomWalkFrames(window.poseAssets?.['room-walk.png']);
      bedroomWalkFrames.forEach((frame, index) => { textures['walk' + index] = frame.texture; });
      studyReturnFrames = mirrorStudyWalkFrames(bedroomWalkFrames);
      studyReturnFrames.forEach((frame, index) => { textures['returnWalk' + index] = frame.texture; });
    } catch (error) {
      console.warn('Optional bedroom walk atlas could not be loaded.', error);
    }

    sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textures.back,
        transparent: true,
        alphaTest: 0.12,
        depthTest: true,
        depthWrite: false,
        toneMapped: false
      })
    );
    sprite.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, blendUniforms);
      shader.fragmentShader =
        'uniform sampler2D nextPoseMap;uniform vec2 poseUvDelta;uniform float poseBlend;uniform vec2 poseFrameBounds;uniform vec2 nextPoseBounds;uniform float eyeOnly;uniform vec2 sourcePoseOffset;uniform vec2 seatFollowThrough;uniform vec2 seatPoseInfluence;uniform vec2 returnPoseOffset;uniform float returnHandoff;uniform vec2 contactPoseOffset;uniform float contactHandoff;\n' + studySeatWarp +
        `vec2 poseRegistration(float y) {
            // Keep faces aligned through the artwork change. Lower limbs
            // stay in the contact coordinates of their original pose.
            return returnHandoff * returnPoseOffset + contactHandoff * contactPoseOffset * smoothstep(.23, .53, y);
          }\n` +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        THREE.ShaderChunk.map_fragment.replace(
          'texture2D( map, vMapUv )',
          `texture2D( map, studySeatUv(
             vMapUv + poseRegistration(vMapUv.y) * poseBlend * vec2(poseFrameBounds.y - poseFrameBounds.x, 1.0),
             poseFrameBounds, seatPoseInfluence.x
           ) )`
        ).replace(
          'diffuseColor *= sampledDiffuseColor;',
          `
            float frameSpan = max(.0001, poseFrameBounds.y - poseFrameBounds.x);
            float uNorm=clamp((vMapUv.x-poseFrameBounds.x)/frameSpan,0.0,1.0);
            vec2 poseShift = poseRegistration(vMapUv.y);
            vec2 sourceUv = vMapUv + poseShift * poseBlend * vec2(frameSpan, 1.0);
            sampledDiffuseColor.a *= step(poseFrameBounds.x, sourceUv.x) * step(sourceUv.x, poseFrameBounds.y)
              * step(0.0, sourceUv.y) * step(sourceUv.y, 1.0);
            vec2 nextUv=vec2(mix(nextPoseBounds.x,nextPoseBounds.y,uNorm),vMapUv.y);
            nextUv -= poseShift * (1.0 - poseBlend) * vec2(nextPoseBounds.y - nextPoseBounds.x, 1.0);
            vec4 nextColor = texture2D(nextPoseMap, studySeatUv(nextUv, nextPoseBounds, seatPoseInfluence.y));
            nextColor.a *= step(nextPoseBounds.x, nextUv.x) * step(nextUv.x, nextPoseBounds.y)
              * step(0.0, nextUv.y) * step(nextUv.y, 1.0);
            vec2 localUv = vec2(uNorm, 1.0 - vMapUv.y);
            float eyeDistance = length((localUv - vec2(.49,.326)) / vec2(.235,.078));
            float eyeMask=1.0-smoothstep(.82,1.0,eyeDistance);
            float blendWeight = poseBlend * mix(1.0, eyeMask, eyeOnly);
            // Resolve the lower body just ahead of the head. Give intersecting
            // contours more overlap than exposed edges to keep one clear outline.
            float sharedCoverage = smoothstep(.12, .76, min(sampledDiffuseColor.a, nextColor.a));
            float handoffProgress = blendWeight + (localUv.y - .5) * .14;
            float contourBlend = smoothstep(.46 + .025 * contactHandoff, .54 - .025 * contactHandoff, handoffProgress);
            float insideBlend = smoothstep(.32, .68, handoffProgress);
            blendWeight = mix(blendWeight, mix(contourBlend, insideBlend, sharedCoverage), max(returnHandoff, contactHandoff));
            float outA=mix(sampledDiffuseColor.a,nextColor.a,blendWeight);
            vec3 outRgb = outA > .0001
              ? mix(sampledDiffuseColor.rgb * sampledDiffuseColor.a, nextColor.rgb * nextColor.a, blendWeight) / outA
              : sampledDiffuseColor.rgb;
            diffuseColor *= vec4(outRgb, outA);
          `
        )
      );
    };
    sprite.material.customProgramCacheKey = () => 'pose-transition-v5-contact-registration';
    setBlend('back', 0);
    sprite.center.set(0.49, 0.27);
    companionLayer.bindSprite(sprite);
    syncRoomVisibility('study');
    update();
    setPose('back', { immediate: true, automatic: true });
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    window.poseRoom.ready = true;
    resize();
    if (roomUI.native) parent.postMessage({ t: 'room-ready' }, location.origin);
  } catch (error) {
    status.textContent = '素材加载失败，请重新打开预览。';
    const safeMsg = error instanceof Error ? error.message.replace(/[A-Za-z]:[\\/][^\s]+/g, '<path>') : 'asset_load_failed';
    assetLoadErrors.push(safeMsg);
    window.poseRoom.error = safeMsg;
    console.error(error);
  }
})();
