const paths = {
  home: [
    {x: -1.35, z: -.65, radius: .26},
    {x: 1.20, z: .77, radius: .27},
    {x: -.94, z: 1.45, radius: .23}
  ],
  plaza: [{x: 0, z: -.2, radius: .91}],
  orchard: [
    {x: -1.05, z: -1.05, radius: .27},
    {x: 1.02, z: -.92, radius: .28},
    {x: -1.02, z: .42, radius: .27}
  ]
};

export const orchardStops = [
  [-.46, .066, -.67],
  [.43, .066, -.51],
  [-.44, .066, .74]
];

const distance = (a, b) => Math.hypot(b[0] - a[0], b[2] - a[2]);
export const easeActor = t => t * t * (3 - 2 * t);

export function createWalkTiming(length, duration, incomingSpeed) {
  const mean = length / duration;
  const initial = Math.min(incomingSpeed, mean * 1.16);
  const acceleration = duration * .18;
  const braking = duration * .25;
  const peak = (length - initial * acceleration / 2) / (duration - (acceleration + braking) / 2);
  return { length, duration, initial, peak, acceleration, braking };
}

export function sampleWalkTiming(timing, elapsed) {
  const { length, duration, initial, peak, acceleration, braking } = timing;
  // Integral of smoothstep. Both ramps join the cruising speed smoothly.
  const integral = u => u ** 3 * (1 - u / 2);
  if (elapsed < acceleration) {
    const u = elapsed / acceleration;
    return {
      distance: initial * elapsed + (peak - initial) * acceleration * integral(u),
      speed: initial + (peak - initial) * easeActor(u)
    };
  }
  const remaining = Math.max(0, duration - elapsed);
  if (remaining < braking) {
    const u = remaining / braking;
    return { distance: length - peak * braking * integral(u), speed: peak * easeActor(u) };
  }
  return { distance: (initial + peak) * acceleration / 2 + (elapsed - acceleration) * peak, speed: peak };
}

export function orchardStop(tree) {
  return orchardStops[tree] ?? orchardStops[1];
}

export function districtGroundCheck(area, benches, furniture) {
  const fixed = paths[area] || [];
  return (x, z) => Math.abs(x) <= 1.72 && Math.abs(z) <= 1.72 &&
    (area !== 'home' || x <= -.54 || z >= .61) &&
    fixed.every(o => Math.hypot(x - o.x, z - o.z) >= o.radius) &&
    benches.every(anchor => Math.abs(x - anchor[0]) >= .56 || z <= anchor[2] - .39 || z >= anchor[2] + .17) &&
    furniture.every(box => x <= box.min.x - .14 || x >= box.max.x + .14 ||
      z <= box.min.z - .14 || z >= box.max.z + .14);
}

export function planDistrictWalk(area, start, end, benches, furniture, incoming) {
  const clear = districtGroundCheck(area,benches,furniture);
  if(!clear(end[0],end[2]))return null;
  const visible = (a, b) => {
    const count = Math.max(1, Math.ceil(distance(a, b) / .04));
    for (let i = 1; i <= count; i++) {
      const t = i / count;
      if (!clear(a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t)) return false;
    }
    return true;
  };
  if (incoming && distance(start, end) > .28) {
    const { x, z, speed } = incoming;
    const length = Math.min(.12, speed * 85, distance(start,end) / 4);
    const lead = [start[0] + x * length, start[1], start[2] + z * length];
    if (length > .045 && visible(start,lead)) {
      const onward = planDistrictWalk(area,lead,end,benches,furniture);
      if (onward) return roundDistrictCorners([start,...onward],visible);
    }
  }
  if (visible(start, end)) return [start, end];
  const cellSize = .20, edge = 8, nodes = new Map();
  const key = (i,j) => i * 32 + j;
  for (let i = -edge; i <= edge; i++) {
    for (let j = -edge; j <= edge; j++) {
      const point = [i * cellSize, .066, j * cellSize];
      if (clear(point[0], point[2])) nodes.set(key(i,j), {i,j,point});
    }
  }
  const queue = [...nodes.values()].filter(n => distance(start,n.point) < .36 && visible(start,n.point));
  const cameFrom = new Map(queue.map(n => [n,null]));
  let finish;
  for (const node of queue) {
    if (visible(node.point,end)) {
      finish = node;
      break;
    }
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const next = nodes.get(key(node.i + di,node.j + dj));
        if (!next || cameFrom.has(next) || !visible(node.point,next.point)) continue;
        cameFrom.set(next,node);
        queue.push(next);
      }
    }
  }
  if (!finish) return null;
  const raw = [end];
  for (let node = finish; node; node = cameFrom.get(node)) raw.push(node.point);
  raw.push(start);
  raw.reverse();
  const route = [start];
  for (let i = 0; i < raw.length - 1;) {
    let next = raw.length - 1;
    while (next > i + 1 && !visible(raw[i],raw[next])) next--;
    route.push(raw[next]);
    i = next;
  }
  return roundDistrictCorners(route, visible);
}

function roundDistrictCorners(route, visible) {
  const rounded = [route[0]];
  const lerp = (a, b, t) => a.map((value, axis) => value + (b[axis] - value) * t);
  for (let i = 1; i < route.length - 1; i++) {
    const previous = route[i - 1], corner = route[i], next = route[i + 1];
    const cut = Math.min(.13, distance(previous, corner) / 3, distance(corner, next) / 3);
    if (cut < .0001) continue;
    const entry = lerp(corner, previous, cut / distance(corner, previous));
    const exit = lerp(corner, next, cut / distance(corner, next));
    const arc = [entry];
    for (const t of [.25, .5, .75, 1]) {
      arc.push(lerp(lerp(entry, corner, t), lerp(corner, exit, t), t));
    }
    const staysClear = arc.every((point, j) => visible(j ? arc[j - 1] : rounded.at(-1), point));
    rounded.push(...(staysClear ? arc : [corner]));
  }
  rounded.push(route.at(-1));
  return rounded;
}

export function buildDistrictTrack(route) {
  let length = 0;
  const segments = route.slice(1).map((point,index) => {
    const from = route[index];
    const start = length;
    length += distance(from,point);
    return {from,point,start,end:length};
  });
  return {segments,length};
}

export function sampleDistrictTrack(track, fraction, position, direction) {
  const offset = track.length * fraction;
  const part = track.segments.find(segment => offset <= segment.end) || track.segments.at(-1);
  const t = part.end === part.start ? 1 : (offset - part.start) / (part.end - part.start);
  position.set(...part.from.map((value, i) => value + (part.point[i] - value) * t));
  // Camera x-right projects world x positively and world z negatively.
  const length = part.end - part.start;
  if (direction) direction.set(length ? (part.point[0] - part.from[0]) / length : 0, 0,
    length ? (part.point[2] - part.from[2]) / length : 0);
  return length
    ? (.8 * (part.point[0] - part.from[0]) - .6 * (part.point[2] - part.from[2])) / length
    : 0;
}
