// Fade the canvas without disturbing its WebGL hit mask. If WebView stops
// delivering animation frames, the timeout still releases the transition.
export function createTownRouteFade(canvas, {isHidden, reduceMotion}) {
  let current = null;
  let motion = null;

  function begin(from, to) {
    if (current || reduceMotion()) return false;
    current = {from, to, phase: 'preparing', opacity: 1,
      styleOpacity: canvas.style.opacity, styleTransition: canvas.style.transition};
    canvas.style.transition = 'none';
    canvas.style.opacity = '1';
    return true;
  }

  function clearScheduled(active) {
    if (active.frame !== null) cancelAnimationFrame(active.frame);
    clearTimeout(active.timer);
    active.frame = null;
    active.timer = null;
  }

  function stopMotion(completed) {
    if (!motion) return;
    const active = motion;
    motion = null;
    clearScheduled(active);
    if (completed) setOpacity(active.to);
    active.done(completed);
  }

  function setOpacity(value) {
    current.opacity = value;
    canvas.style.opacity = String(value);
  }

  function frame() {
    const active = motion;
    if (!active || !current) return;
    active.frame = null;
    if (isHidden()) {
      pause();
      return;
    }
    const elapsed = active.elapsed + performance.now() - active.started;
    const progress = reduceMotion() ? 1 : Math.min(1, elapsed / active.duration);
    if (progress >= 1) {
      stopMotion(true);
      return;
    }
    const smooth = progress * progress * (3 - 2 * progress);
    setOpacity(active.from + (active.to - active.from) * smooth);
    active.frame = requestAnimationFrame(frame);
  }

  function resume() {
    const active = motion;
    if (!active || active.started !== null || isHidden()) return;
    if (reduceMotion() || active.elapsed >= active.duration) {
      stopMotion(true);
      return;
    }
    active.started = performance.now();
    active.frame = requestAnimationFrame(frame);
    active.timer = setTimeout(() => {
      if (motion !== active) return;
      if (isHidden()) pause();
      else stopMotion(true);
    }, active.duration - active.elapsed + 80);
  }

  function pause() {
    const active = motion;
    if (!active || active.started === null) return;
    active.elapsed = Math.min(active.duration, active.elapsed + performance.now() - active.started);
    active.started = null;
    clearScheduled(active);
  }

  function fade(phase, to, duration) {
    if (!current) return Promise.resolve(false);
    current.phase = phase;
    return new Promise(done => {
      motion = {from: current.opacity, to, duration, elapsed: 0, started: null, frame: null, timer: null, done};
      resume();
    });
  }

  function finish() {
    if (!current) return;
    stopMotion(false);
    canvas.style.opacity = current.styleOpacity;
    canvas.style.transition = current.styleTransition;
    current = null;
  }

  return {begin, fade, finish, pause, resume, active: () => current !== null,
    entering: () => current?.phase === 'in',
    state: () => current ? {from: current.from, to: current.to, phase: current.phase, opacity: current.opacity} : null};
}

