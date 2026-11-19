const VALID_ROOMS = new Set(['study', 'bedroom']);
const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const smoothstep = (t) => {
  const p = clamp(t, 0, 1);
  return p * p * (3 - 2 * p);
};

export function isValidRoom(room) {
  return VALID_ROOMS.has(room);
}

/**
 * Computes the room transition curve (0.3-0.5s, default 380ms):
 * - First 35%: approach/converge + fade out
 * - Midpoint (50%): swap room meshes & move companion to target safe landing spot
 * - Second 50%: fade in cleanly at target room
 */
export function sampleRoomTransition(elapsedMs, durationMs = 380) {
  const dur = Math.max(300, Math.min(500, Number(durationMs) || 380));
  const p = clamp((Number(elapsedMs) || 0) / dur, 0, 1);
  const swap = p >= 0.5;
  const halfProgress = swap ? (p - 0.5) * 2 : p * 2;
  const eased = smoothstep(halfProgress);
  const sceneOpacity = swap ? eased : 1 - eased;
  const veilOpacity = 1 - sceneOpacity;
  const phase = p < 0.32 ? 'approachStairs' : p < 0.5 ? 'fadeOut' : p < 1 ? 'fadeIn' : 'done';
  return {
    progress: p,
    swap,
    sceneOpacity: +sceneOpacity.toFixed(4),
    veilOpacity: +veilOpacity.toFixed(4),
    phase,
    done: p >= 1
  };
}

export function createSceneTransitions({
  initialRoom = 'study',
  durationMs = 380,
  isReducedMotion = () => false,
  isMotionEnabled = () => true,
  isHidden = () => false,
  onStartTransition = () => {},
  onSwapRoom = () => {},
  onProgress = () => {},
  onFinishTransition = () => {},
  getRoomState = () => ({})
} = {}) {
  let activeRoom = isValidRoom(initialRoom) ? initialRoom : 'study';
  let current = null; // { id, from, to, elapsedMs, durationMs, swapped, phase, veilOpacity, sceneOpacity }
  let seq = 0;
  let ticker = null;
  let lastTickAt = 0;
  let disposed = false;
  let waiters = [];

  function stopTicker() {
    if (ticker !== null) {
      clearInterval(ticker);
      ticker = null;
    }
    lastTickAt = 0;
  }

  function resolveAllWaiters() {
    if (!waiters.length) return;
    const pending = waiters;
    waiters = [];
    const snapshot = getRoomState();
    for (const w of pending) {
      try {
        w.resolve(snapshot);
      } catch {
        // Ignore individual listener errors
      }
    }
  }

  function completeCurrentNow(targetRoom) {
    stopTicker();
    const finalRoom = isValidRoom(targetRoom) ? targetRoom : (current ? current.to : activeRoom);
    const changed = activeRoom !== finalRoom || (current && !current.swapped);
    activeRoom = finalRoom;
    current = null;
    if (changed) {
      onSwapRoom(activeRoom);
    }
    onProgress({
      progress: 1,
      swap: true,
      sceneOpacity: 1,
      veilOpacity: 0,
      phase: 'done',
      done: true,
      activeRoom
    });
    onFinishTransition(activeRoom);
    resolveAllWaiters();
  }

  function step(dtMs) {
    if (disposed || !current) return null;
    if (isHidden()) {
      stopTicker();
      return getState();
    }
    if (isReducedMotion() || !isMotionEnabled()) {
      completeCurrentNow(current.to);
      return getState();
    }

    const delta = Math.max(0, Math.min(120, Number(dtMs) || 0));
    current.elapsedMs += delta;
    const sample = sampleRoomTransition(current.elapsedMs, current.durationMs);
    current.phase = sample.phase;
    current.veilOpacity = sample.veilOpacity;
    current.sceneOpacity = sample.sceneOpacity;

    if (sample.swap && !current.swapped) {
      current.swapped = true;
      if (activeRoom !== current.to) {
        activeRoom = current.to;
        onSwapRoom(activeRoom);
      }
    }

    onProgress({ ...sample, activeRoom });

    if (sample.done) {
      completeCurrentNow(current.to);
    }

    return getState();
  }

  function startTicker() {
    stopTicker();
    if (disposed || isHidden() || !current) return;
    lastTickAt = performance.now();
    ticker = setInterval(() => {
      if (disposed || !current || isHidden()) {
        stopTicker();
        return;
      }
      const now = performance.now();
      const dt = Math.max(8, now - lastTickAt);
      lastTickAt = now;
      step(dt);
    }, 16);
  }

  function openRoom(targetRoom, options = {}) {
    if (disposed || !isValidRoom(targetRoom)) {
      return Promise.resolve(getRoomState());
    }

    // If not transitioning and already in targetRoom, treat as a pure no-op BEFORE any side effects
    if (!current && activeRoom === targetRoom) {
      return Promise.resolve(getRoomState());
    }

    const immediate =
      options?.immediate === true ||
      isReducedMotion() ||
      !isMotionEnabled();

    // Always cancel active companion actions/timers when a room switch or in-flight redirect is requested
    onStartTransition({ from: activeRoom, to: targetRoom, immediate });

    if (immediate) {
      completeCurrentNow(targetRoom);
      return Promise.resolve(getRoomState());
    }

    // Coalesce rapid consecutive requests: only the last valid targetRoom wins
    const id = ++seq;
    const dur = Math.max(300, Math.min(500, Number(options?.durationMs) || durationMs));

    if (current) {
      // Update in-flight transition to point to the latest requested targetRoom
      current.id = id;
      current.to = targetRoom;
      current.durationMs = dur;
      if (activeRoom === targetRoom) {
        // Already displaying targetRoom (either before midpoint swap or after midpoint swap):
        // smoothly fade back in during second half
        current.from = targetRoom;
        current.swapped = true;
        current.elapsedMs = Math.max(dur * 0.5, dur * (1 - current.veilOpacity * 0.5));
      } else {
        // Need to swap from activeRoom to targetRoom
        current.from = activeRoom;
        current.swapped = false;
        current.elapsedMs = Math.min(dur * 0.35, current.elapsedMs);
      }
    } else {
      current = {
        id,
        from: activeRoom,
        to: targetRoom,
        elapsedMs: 0,
        durationMs: dur,
        swapped: false,
        phase: 'approachStairs',
        veilOpacity: 0,
        sceneOpacity: 1
      };
    }

    return new Promise((resolve) => {
      waiters.push({ resolve });
      if (!isHidden()) {
        startTicker();
      }
    });
  }

  function setHidden(hidden) {
    if (hidden) {
      stopTicker();
    } else if (current && !disposed) {
      if (isReducedMotion() || !isMotionEnabled()) {
        completeCurrentNow(current.to);
      } else {
        startTicker();
      }
    }
  }

  function cancel() {
    if (!current) return;
    stopTicker();
    current = null;
    onProgress({
      progress: 1,
      swap: true,
      sceneOpacity: 1,
      veilOpacity: 0,
      phase: 'done',
      done: true,
      activeRoom
    });
    resolveAllWaiters();
  }

  function getState() {
    return {
      activeRoom,
      transitioning: current !== null,
      from: current ? current.from : activeRoom,
      to: current ? current.to : activeRoom,
      phase: current ? current.phase : 'stable',
      progress: current ? +(current.elapsedMs / current.durationMs).toFixed(3) : 1,
      veilOpacity: current ? current.veilOpacity : 0,
      sceneOpacity: current ? current.sceneOpacity : 1
    };
  }

  function dispose() {
    disposed = true;
    stopTicker();
    current = null;
    resolveAllWaiters();
  }

  return {
    openRoom,
    step,
    setHidden,
    cancel,
    getActiveRoom: () => activeRoom,
    isTransitioning: () => current !== null,
    getState,
    dispose
  };
}
