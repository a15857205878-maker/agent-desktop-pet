// Distance over the walking portion, with zero speed at both ends.
export function roomWalkDistance(progress) {
  const ramp = .20;
  const time = Math.max(0, Math.min(1, progress));
  const edge = offset => {
    const t = offset / ramp;
    return ramp * t ** 3 * (1 - t / 2) / (1 - ramp);
  };
  if (time < ramp) return edge(time);
  if (time > 1 - ramp) return 1 - edge(1 - time);
  return (time - ramp / 2) / (1 - ramp);
}
