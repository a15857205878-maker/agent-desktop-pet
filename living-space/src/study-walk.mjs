import * as THREE from 'three';
import {roomWalkDistance} from './room-walk-timing.mjs';

// Step away from the desk chair, then cross the open side of the rug.
const route = new THREE.CatmullRomCurve3([
  [-.44, .235, -.48],
  [-.35, .23, -.04],
  [.04, .225, .19],
  [.39, .225, .18],
  [.54, .225, .13]
].map(point => new THREE.Vector3(...point)));
route.updateArcLengths();

const turnEnd = 500;
const holdEnd = turnEnd + 560;
const standEnd = holdEnd + 340;
const plantTime = 95;
const walkEnd = standEnd + 1240;
const sitEnd = walkEnd + 360;
const settleEnd = sitEnd + 620;
const clamp = t => Math.max(0, Math.min(t, 1));
const smooth = t => t * t * (3 - 2 * t);
const progress = (time, start, end) => clamp((time - start) / (end - start));

function swing(time, delay, duration, amplitude) {
  const t = progress(time, delay, delay + duration);
  return amplitude * (1 - t) ** 2 * Math.sin(t * 3.4 * Math.PI);
}

export function sampleStudyWalk(time, point) {
  const walkingTime = progress(time, standEnd, walkEnd - plantTime);
  const distance = roomWalkDistance(walkingTime);
  route.getPointAt(distance, point);
  const stride = distance * 2;
  const impact = time - (walkEnd + 280);
  const sitting = progress(time, walkEnd, sitEnd);
  const load = 16 * (sitting * (1 - sitting)) ** 2;
  return {
    phase: time < turnEnd ? 'turn' : time < holdEnd ? 'hold' : time < standEnd ? 'stand'
      : time < walkEnd ? 'walk' : time < sitEnd ? 'sit' : 'settle',
    turn: smooth(progress(time, 0, turnEnd)),
    stand: smooth(progress(time, holdEnd, standEnd)),
    sit: smooth(sitting),
    seatDip: .025 * load,
    seatPitch: .037 * load,
    frame: Math.min(7, Math.floor(stride * 4)) % 4,
    bob: .016 * Math.sin(2 * Math.PI * stride) ** 2 * Math.sin(Math.PI * walkingTime),
    hair: swing(impact, 0, 540, .024),
    tail: swing(impact, 72, 600, .041),
    done: time >= settleEnd
  };
}

const returnLeanEnd = 190;
const returnStandEnd = 550;
const returnWalkEnd = 1940;
const returnSitEnd = 2380;
const returnTurnEnd = 2980;

export function sampleStudyReturn(time, point) {
  const walkingTime = progress(time, returnStandEnd, returnWalkEnd - plantTime);
  const distance = roomWalkDistance(walkingTime);
  route.getPointAt(1 - distance, point);
  const stride = distance * 2;
  const stand = smooth(progress(time, returnLeanEnd, returnStandEnd));
  const sittingTime = progress(time, returnWalkEnd, returnSitEnd);
  const turningTime = progress(time, returnSitEnd, returnTurnEnd);
  return {
    phase: time < returnLeanEnd ? 'lean' : time < returnStandEnd ? 'stand' : time < returnWalkEnd ? 'walk'
      : time < returnSitEnd ? 'sit' : 'turnBack',
    stand,
    lean: smooth(progress(time, 0, returnLeanEnd)) * (1 - stand),
    sit: smooth(sittingTime),
    turn: smooth(progress(turningTime, .12, .96)),
    seatDip: .029 * Math.sin(Math.PI * sittingTime) * sittingTime,
    frame: Math.min(7, Math.floor(stride * 4)) % 4,
    bob: .015 * Math.sin(2 * Math.PI * stride) ** 2 * Math.sin(Math.PI * walkingTime),
    hair: 0,
    tail: 0,
    done: time >= returnTurnEnd
  };
}

// Give the returning character a left-facing gait while preserving each
// frame's foot pivot and the shared atlas used in the bedroom.
export function mirrorStudyWalkFrames(frames) {
  return frames.map(frame => {
    const canvas = document.createElement('canvas');
    canvas.width = frame.texture.image.width;
    canvas.height = frame.texture.image.height;
    const context = canvas.getContext('2d');
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(frame.texture.image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = frame.texture.colorSpace;
    texture.minFilter = frame.texture.minFilter;
    texture.userData.walkFrame = true;
    return { ...frame, texture, center: [1 - frame.center[0], frame.center[1]] };
  });
}

export const studySeatWarp = `
vec2 studySeatUv(vec2 uv, vec2 frame, float influence) {
  if (influence == 0.0 || dot(seatFollowThrough, seatFollowThrough) < 0.00000001) return uv;
  float span = frame.y - frame.x;
  vec2 local = vec2((uv.x - frame.x) / span, 1.0 - uv.y);
  float fringe = 1.0 - smoothstep(.17, .25, local.y);
  float sides = 1.0 - smoothstep(.22, .31, local.x) + smoothstep(.65, .77, local.x);
  float hair = max(fringe, sides * (1.0 - smoothstep(.43, .59, local.y)));
  float tail = smoothstep(.59, .75, local.x) * smoothstep(.52, .69, local.y);
  vec2 shift = seatFollowThrough.x * hair * vec2(1.0, -.2)
             + seatFollowThrough.y * tail * vec2(-.36, 1.0);
  return clamp(
    uv + influence * shift * vec2(span, 1.0),
    vec2(frame.x + .0001, 0.0), vec2(frame.y - .0001, 1.0)
  );
}
`;
