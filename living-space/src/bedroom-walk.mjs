import * as THREE from 'three';
import {roomWalkDistance} from './room-walk-timing.mjs';

// The front of the bench leads around the foot of the bed. The last point
// is beside the mattress, before the stair opening and bedside cabinet.
const route = new THREE.CatmullRomCurve3([
  [-1.04, .244, -.32],
  [-.64, .237, -.06],
  [-.13, .225, .14],
  [.46, .225, .14],
  [.97, .225, .015],
].map(point => new THREE.Vector3(...point)));
route.updateArcLengths();

const standTime = 320;
const travelTime = 1480;
const plantTime = 100;
const sitTime = 340;
const ease = t => t * t * (3 - 2 * t);
const clamp = t => Math.max(0, Math.min(1, t));

export function sampleBedroomWalk(elapsed, point) {
  const travel = clamp((elapsed - standTime) / travelTime);
  const distance = roomWalkDistance(travel);
  route.getPointAt(distance, point);
  const stride = distance * 3;
  return {
    stand: ease(clamp(elapsed / standTime)),
    sit: ease(clamp((elapsed - standTime - travelTime - plantTime) / sitTime)),
    frame: Math.min(11, Math.floor(stride * 4)) % 4,
    bob: elapsed > standTime && travel < 1
      ? .016 * Math.sin(2 * Math.PI * stride) ** 2 * Math.sin(Math.PI * travel)
      : 0,
    walking: elapsed >= standTime && travel < 1,
    done: elapsed >= standTime + travelTime + plantTime + sitTime,
  };
}

export async function loadBedroomWalkFrames(url) {
  if (!url) return [];
  const atlas = await new THREE.TextureLoader().loadAsync(url);
  try {
    const source = document.createElement('canvas');
    source.width = atlas.image.width;
    source.height = atlas.image.height;
    const context = source.getContext('2d', { willReadFrequently: true });
    context.drawImage(atlas.image, 0, 0);
    const { width, height } = source;
    const { data } = context.getImageData(0, 0, width, height);
    const tiles = [];
    for (let index = 0; index < 4; index++) {
      const first = Math.round(width * index / 4);
      const last = Math.round(width * (index + 1) / 4);
      let left = last, right = first, top = height, bottom = 0;
      for (let y = 0; y < height; y++) {
        for (let x = first; x < last; x++) {
          if (data[(y * width + x) * 4 + 3] < 96) continue;
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
      if (right - left < 20 || bottom - top < 40) return [];
      let footLeft = right, footRight = left;
      for (let y = bottom - 8; y <= bottom; y++) {
        for (let x = left; x <= right; x++) {
          if (data[(y * width + x) * 4 + 3] >= 128) {
            footLeft = Math.min(footLeft, x);
            footRight = Math.max(footRight, x);
          }
        }
      }
      tiles.push({ left, right, top, bottom, foot: (footLeft + footRight) * .5 });
    }

    const maxHeight = Math.max(...tiles.map(t => t.bottom - t.top + 1));
    return tiles.map(tile => {
      const canvas = document.createElement('canvas');
      canvas.width = tile.right - tile.left + 9;
      canvas.height = maxHeight + 8;
      const tileHeight = tile.bottom - tile.top + 1;
      // The source gait leads with the foot at screen left. Flip the
      // tile so the stride leads toward the bed on screen right.
      const tileContext = canvas.getContext('2d');
      tileContext.translate(canvas.width, 0);
      tileContext.scale(-1, 1);
      tileContext.drawImage(source, tile.left, tile.top,
        canvas.width - 8, tileHeight, 4, maxHeight - tileHeight + 4, canvas.width - 8, tileHeight);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.userData.walkFrame = true;
      return { texture, aspect: canvas.width / canvas.height, center: [1 - (tile.foot - tile.left + 4) / canvas.width, 4 / canvas.height] };
    });
  } finally {
    atlas.dispose();
  }
}
